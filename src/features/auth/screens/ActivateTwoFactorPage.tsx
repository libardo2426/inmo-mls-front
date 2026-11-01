import { useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { secretFromTotpUri } from '../api/totp-uri';
import { BackupCodes } from '../components/BackupCodes';
import { AuthCard } from '../components/AuthCard';
import { useAuthApi } from '../hooks/useAuthApi';
import { useAuthNavigation } from '../hooks/useAuthNavigation';
import { authErrorMessage } from '../messages';
import { ME_QUERY_KEY } from '../session/me';

type Step =
  | { name: 'password' }
  | { name: 'scan'; totpURI: string; backupCodes: readonly string[] }
  | { name: 'codes'; backupCodes: readonly string[] };

type Feedback = { text: string; alreadyEnabled?: boolean } | null;

export function ActivateTwoFactorPage() {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const { go } = useAuthNavigation();
  const ids = { password: useId(), code: useId() };

  // Los códigos de respaldo y la clave viven solo en este estado: nunca en almacenamiento.
  const [step, setStep] = useState<Step>({ name: 'password' });
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const submitting = useRef(false);
  const otpRef = useRef<HTMLInputElement>(null);
  const [refocus, setRefocus] = useState(0);

  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (refocus > 0 && !pending) otpRef.current?.focus();
  }, [refocus, pending]);

  // En el paso de contraseña el foco pasa a la alerta; en el de escaneo vuelve al campo del código.
  const onPasswordStep = step.name === 'password';
  useEffect(() => {
    if (feedback !== null && onPasswordStep) alertRef.current?.focus();
  }, [feedback, onPasswordStep]);

  async function run(action: () => Promise<void>) {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setFeedback(null);
    try {
      await action();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TOTP_ALREADY_ENABLED') {
        setFeedback({ text: es.auth.activate.alreadyEnabled, alreadyEnabled: true });
      } else {
        setFeedback({ text: authErrorMessage(error) });
      }
      throw error;
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  async function onPassword(event: FormEvent) {
    event.preventDefault();
    if (password === '') return;
    try {
      await run(async () => {
        const result = await api.enableTwoFactor(password);
        setPassword('');
        setStep({ name: 'scan', totpURI: result.totpURI, backupCodes: result.backupCodes });
      });
    } catch {
      setPassword('');
    }
  }

  async function onVerify(value: string) {
    if (step.name !== 'scan' || value.length !== 6) return;
    const { backupCodes } = step;
    try {
      await run(async () => {
        await api.verifyTotp(value);
        setCode('');
        setStep({ name: 'codes', backupCodes });
      });
    } catch {
      setCode('');
      setRefocus((n) => n + 1);
    }
  }

  async function copySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setSecretCopied(true);
    } catch {
      setSecretCopied(false);
    }
  }

  // Con la sesión a medias, /iniciar-sesion rebotaría aquí: primero se cierra la sesión.
  async function leave() {
    try {
      await api.signOut();
    } catch {
      /* si falla el cierre, la guarda decide con lo que responda /me */
    }
    queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
    go('/iniciar-sesion');
  }

  function finish() {
    queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
    go('/');
  }

  const alert = feedback ? (
    <Alert variant="destructive" ref={alertRef} tabIndex={-1}>
      <AlertDescription>
        {feedback.text}
        {feedback.alreadyEnabled ? (
          <>
            {' '}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => void leave()}
            >
              {es.auth.activate.goToLogin}
            </Button>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  ) : null;

  if (step.name === 'codes') {
    return (
      <AuthCard title={es.auth.activate.codesTitle}>
        <BackupCodes codes={step.backupCodes} onContinue={finish} />
      </AuthCard>
    );
  }

  if (step.name === 'scan') {
    const secret = secretFromTotpUri(step.totpURI);
    return (
      <AuthCard title={es.auth.activate.scanTitle} description={es.auth.activate.scanHelp}>
        <FieldGroup>
          {alert}
          {/* El QR necesita fondo claro para que las aplicaciones lo lean también en modo oscuro. */}
          <div className="mx-auto w-fit rounded-lg bg-white p-3">
            <QRCodeSVG
              value={step.totpURI}
              size={176}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
              role="img"
              aria-label={es.auth.activate.qrLabel}
            />
          </div>
          {secret ? (
            <Field>
              <FieldDescription>{es.auth.activate.secretLabel}</FieldDescription>
              <div className="flex items-center gap-2">
                <code className="bg-muted flex-1 rounded-md px-2 py-1 font-mono text-sm break-all">
                  {secret}
                </code>
                <Button type="button" variant="outline" onClick={() => void copySecret(secret)}>
                  {secretCopied ? es.auth.activate.copied : es.auth.activate.copySecret}
                </Button>
              </div>
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor={ids.code}>{es.auth.activate.code}</FieldLabel>
            <InputOTP
              id={ids.code}
              ref={otpRef}
              maxLength={6}
              inputMode="numeric"
              pattern="^[0-9]*$"
              autoComplete="one-time-code"
              disabled={pending}
              value={code}
              onChange={setCode}
              onComplete={(value) => void onVerify(value)}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </Field>
          <Button
            type="button"
            disabled={pending || code.length !== 6}
            onClick={() => void onVerify(code)}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? es.auth.activate.verifying : es.auth.activate.verify}
          </Button>
        </FieldGroup>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={es.auth.activate.title} description={es.auth.activate.intro}>
      <form onSubmit={(event) => void onPassword(event)} noValidate>
        <FieldGroup>
          {alert}
          <Field>
            <FieldLabel htmlFor={ids.password}>{es.auth.activate.password}</FieldLabel>
            <Input
              id={ids.password}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? es.auth.activate.starting : es.auth.activate.start}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
