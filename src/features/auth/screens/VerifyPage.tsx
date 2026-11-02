import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { AuthCard } from '../components/AuthCard';
import { useAuthApi } from '../hooks/useAuthApi';
import { useAuthNavigation } from '../hooks/useAuthNavigation';
import { useCountdown } from '@/hooks/useCountdown';
import { authErrorMessage } from '../messages';
import { safeRedirect } from '../session/guard';
import { ME_QUERY_KEY } from '../session/me';

type Feedback = { kind: 'text'; text: string } | { kind: 'rate' } | null;

export function VerifyPage({ redirectTo }: { redirectTo?: string | undefined }) {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const { go, goHref } = useAuthNavigation();
  const countdown = useCountdown();
  const ids = { otp: useId(), backup: useId() };

  const [useBackup, setUseBackup] = useState(false);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const submitting = useRef(false);
  const otpRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const [refocus, setRefocus] = useState(0);

  const locked = pending || countdown.remaining > 0;
  const message =
    feedback?.kind === 'rate'
      ? countdown.remaining > 0
        ? es.auth.errors.rateLimited(countdown.remaining)
        : null
      : (feedback?.text ?? null);

  // Tras un error el campo se vacía y vuelve a recibir el foco (cuando ya está habilitado).
  useEffect(() => {
    if (refocus === 0 || locked) return;
    (useBackup ? backupRef : otpRef).current?.focus();
  }, [refocus, locked, useBackup]);

  async function submit(value: string) {
    if (submitting.current || countdown.remaining > 0) return;
    const trimmed = value.trim();
    if (trimmed === '') return;

    submitting.current = true;
    setPending(true);
    setFeedback(null);
    try {
      if (useBackup) await api.verifyBackupCode(trimmed);
      else await api.verifyTotp(trimmed);
      queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
      goHref(safeRedirect(redirectTo));
    } catch (error) {
      setCode('');
      if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds) {
        countdown.start(error.retryAfterSeconds);
        setFeedback({ kind: 'rate' });
      } else {
        setFeedback({ kind: 'text', text: authErrorMessage(error) });
      }
      setRefocus((n) => n + 1);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit(code);
  }

  function toggleMode() {
    setUseBackup((v) => !v);
    setCode('');
    setFeedback(null);
    setRefocus((n) => n + 1);
  }

  return (
    <AuthCard title={es.auth.verify.title}>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          {message ? (
            <Alert variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          {useBackup ? (
            <Field>
              <FieldLabel htmlFor={ids.backup}>{es.auth.verify.backupCode}</FieldLabel>
              <Input
                id={ids.backup}
                ref={backupRef}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={locked}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor={ids.otp}>{es.auth.verify.code}</FieldLabel>
              <InputOTP
                id={ids.otp}
                ref={otpRef}
                maxLength={6}
                inputMode="numeric"
                pattern="^[0-9]*$"
                autoComplete="one-time-code"
                autoFocus
                disabled={locked}
                value={code}
                onChange={setCode}
                onComplete={(value) => void submit(value)}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </Field>
          )}
          <Button type="submit" disabled={locked}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? es.auth.verify.pending : es.auth.verify.submit}
          </Button>
          <Button type="button" variant="ghost" onClick={toggleMode} disabled={pending}>
            {useBackup ? es.auth.verify.useTotp : es.auth.verify.useBackup}
          </Button>
          <Button type="button" variant="link" onClick={() => go('/iniciar-sesion')}>
            {es.auth.verify.backToLogin}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
