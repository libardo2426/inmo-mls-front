import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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

const credentialsSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

type Feedback = { kind: 'text'; text: string } | { kind: 'rate' } | null;

type LoginPageProps = { redirectTo?: string | undefined; passwordChanged?: boolean };

export function LoginPage({ redirectTo, passwordChanged = false }: LoginPageProps) {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const { go, goHref } = useAuthNavigation();
  const countdown = useCountdown();
  const ids = { email: useId(), password: useId() };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const submitting = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);

  const message =
    feedback?.kind === 'rate'
      ? countdown.remaining > 0
        ? es.auth.errors.rateLimited(countdown.remaining)
        : null
      : (feedback?.text ?? null);

  useEffect(() => {
    if (feedback !== null) alertRef.current?.focus();
  }, [feedback]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || countdown.remaining > 0) return;

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFeedback({ kind: 'text', text: es.auth.login.validation });
      return;
    }

    submitting.current = true;
    setPending(true);
    setFeedback(null);
    try {
      const result = await api.signInEmail(parsed.data);
      if (result.kind === 'two-factor') {
        go('/verificar', redirectTo ? { search: { redirect: redirectTo } } : {});
        return;
      }
      // La sesión ya existe en la cookie: se descarta lo cacheado y la guarda decide el destino.
      queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
      goHref(safeRedirect(redirectTo));
    } catch (error) {
      setPassword('');
      if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds) {
        countdown.start(error.retryAfterSeconds);
        setFeedback({ kind: 'rate' });
      } else {
        setFeedback({ kind: 'text', text: authErrorMessage(error) });
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <AuthCard title={es.auth.login.title}>
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <FieldGroup>
          {passwordChanged ? (
            <Alert role="status">
              <AlertDescription>{es.auth.reset.done}</AlertDescription>
            </Alert>
          ) : null}
          {message ? (
            <Alert variant="destructive" ref={alertRef} tabIndex={-1}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor={ids.email}>{es.auth.login.email}</FieldLabel>
            <Input
              id={ids.email}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={ids.password}>{es.auth.login.password}</FieldLabel>
            <Input
              id={ids.password}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={pending || countdown.remaining > 0}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? es.auth.login.pending : es.auth.login.submit}
          </Button>
          <Link to="/recuperar" className="text-sm underline underline-offset-4">
            {es.auth.login.forgot}
          </Link>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
