import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCountdown } from '@/hooks/useCountdown';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { useAuthApi } from '../hooks/useAuthApi';
import { authErrorMessage } from '../messages';
import { ME_QUERY_KEY } from '../session/me';

const MIN_PASSWORD_LENGTH = 12;

type Mode = 'create' | 'signin';
type Feedback = { kind: 'text'; text: string; userExists?: boolean } | { kind: 'rate' } | null;

type Props = {
  /** Correo de la invitación: la cuenta tiene que ser esta. */
  email: string;
  fullName: string;
  signedIn: boolean;
  /** Cambió la sesión (se inició o se cerró): quien lo usa vuelve a consultar el estado. */
  onChanged: () => void;
};

/**
 * Autenticación de quien abre un enlace de invitación: crear la cuenta o entrar con la que ya
 * tiene. El correo es siempre el invitado; no se edita.
 */
export function InvitationAuthPanel({ email, fullName, signedIn, onChanged }: Props) {
  const t = es.auth.invitation;
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const countdown = useCountdown();
  const ids = { name: useId(), email: useId(), password: useId() };

  const [mode, setMode] = useState<Mode>('create');
  const [name, setName] = useState(fullName);
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const submitting = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedback !== null) alertRef.current?.focus();
  }, [feedback]);

  const waiting = countdown.remaining > 0;
  const message =
    feedback?.kind === 'rate'
      ? waiting
        ? es.auth.errors.rateLimited(countdown.remaining)
        : null
      : (feedback?.text ?? null);
  const valid =
    password.length >= MIN_PASSWORD_LENGTH && (mode === 'signin' || name.trim().length > 0);

  /** La sesión cambió en la cookie: se descarta lo cacheado de `/me` y se avisa. */
  const changed = () => {
    queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
    onChanged();
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || waiting || !valid) return;
    submitting.current = true;
    setPending(true);
    setFeedback(null);
    try {
      if (mode === 'create') await api.signUpEmail({ name: name.trim(), email, password });
      const result = await api.signInEmail({ email, password });
      if (result.kind === 'two-factor') {
        setFeedback({ kind: 'text', text: t.twoFactorRequired });
        return;
      }
      changed();
    } catch (error) {
      setPassword('');
      if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds) {
        countdown.start(error.retryAfterSeconds);
        setFeedback({ kind: 'rate' });
      } else {
        setFeedback({
          kind: 'text',
          text: authErrorMessage(error),
          userExists: error instanceof ApiError && error.code === 'USER_ALREADY_EXISTS',
        });
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  async function leaveAccount() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    try {
      await api.signOut();
    } catch {
      /* el cierre en el servidor es de mejor esfuerzo: la guarda confirma con `/me` */
    } finally {
      submitting.current = false;
      setPending(false);
      changed();
    }
  }

  if (signedIn) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="type-data">
          {t.signedIn}
        </p>
        <Button variant="outline" disabled={pending} onClick={() => void leaveAccount()}>
          {t.useOtherAccount}
        </Button>
      </div>
    );
  }

  const form = (current: Mode) => (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <FieldGroup>
        {message ? (
          <Alert variant="destructive" role="alert" ref={alertRef} tabIndex={-1}>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        {feedback?.kind === 'text' && feedback.userExists ? (
          <Button type="button" variant="outline" onClick={() => switchTo('signin')}>
            {t.switchToSignIn}
          </Button>
        ) : null}
        {current === 'create' ? (
          <Field>
            <FieldLabel htmlFor={ids.name}>{t.name}</FieldLabel>
            <Input
              id={ids.name}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor={ids.email}>{t.email}</FieldLabel>
          <Input id={ids.email} type="email" autoComplete="username" value={email} readOnly />
        </Field>
        <Field>
          <FieldLabel htmlFor={ids.password}>{t.password}</FieldLabel>
          <Input
            id={ids.password}
            type="password"
            autoComplete={current === 'create' ? 'new-password' : 'current-password'}
            aria-describedby={current === 'create' ? `${ids.password}-hint` : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {current === 'create' ? (
            <p id={`${ids.password}-hint`} className="text-text-muted text-sm">
              {t.passwordHint}
            </p>
          ) : null}
        </Field>
        <Button type="submit" disabled={pending || waiting || !valid}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? t.pending : current === 'create' ? t.submitCreate : t.submitSignIn}
        </Button>
      </FieldGroup>
    </form>
  );

  function switchTo(next: Mode) {
    setMode(next);
    setPassword('');
    setFeedback(null);
  }

  return (
    <Tabs value={mode} onValueChange={(next) => switchTo(next === 'signin' ? 'signin' : 'create')}>
      <TabsList aria-label={t.modeLabel}>
        <TabsTrigger value="create">{t.create}</TabsTrigger>
        <TabsTrigger value="signin">{t.haveAccount}</TabsTrigger>
      </TabsList>
      <TabsContent value="create">{form('create')}</TabsContent>
      <TabsContent value="signin">{form('signin')}</TabsContent>
    </Tabs>
  );
}
