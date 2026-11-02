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
import { AuthCard } from '@/components/shared/AuthCard';
import { useAuthApi } from '../hooks/useAuthApi';
import { useCountdown } from '@/hooks/useCountdown';
import { authErrorMessage } from '../messages';

type Feedback = { kind: 'text'; text: string } | { kind: 'rate' } | null;

const emailSchema = z.email();

export function RequestResetPage() {
  const api = useAuthApi();
  const countdown = useCountdown();
  const emailId = useId();

  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
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

    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setFeedback({ kind: 'text', text: es.auth.recover.validation });
      return;
    }

    submitting.current = true;
    setPending(true);
    setFeedback(null);
    try {
      await api.requestPasswordReset(parsed.data);
      setSent(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds) {
        countdown.start(error.retryAfterSeconds);
        setFeedback({ kind: 'rate' });
      } else if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        // Un correo inexistente no puede distinguirse de uno válido: misma respuesta para ambos.
        setSent(true);
      } else {
        setFeedback({ kind: 'text', text: authErrorMessage(error) });
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  const back = (
    <Link to="/iniciar-sesion" className="text-sm underline underline-offset-4">
      {es.auth.recover.backToLogin}
    </Link>
  );

  if (sent) {
    return (
      <AuthCard title={es.auth.recover.title}>
        <FieldGroup>
          <Alert role="status">
            <AlertDescription>{es.auth.recover.sent}</AlertDescription>
          </Alert>
          {back}
        </FieldGroup>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={es.auth.recover.title} description={es.auth.recover.intro}>
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <FieldGroup>
          {message ? (
            <Alert variant="destructive" ref={alertRef} tabIndex={-1}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor={emailId}>{es.auth.recover.email}</FieldLabel>
            <Input
              id={emailId}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={pending || countdown.remaining > 0}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? es.auth.recover.pending : es.auth.recover.submit}
          </Button>
          {back}
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
