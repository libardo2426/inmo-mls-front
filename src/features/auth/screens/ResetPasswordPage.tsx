import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
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
import { authErrorMessage } from '../messages';

const MIN_PASSWORD_LENGTH = 12;

type Feedback = { text: string; tokenInvalid?: boolean } | null;

function tokenFromHash(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? '';
}

export function ResetPasswordPage() {
  const api = useAuthApi();
  const router = useRouter();
  const { go } = useAuthNavigation();
  const hash = useRouterState({ select: (state) => state.location.hash });
  const ids = { password: useId(), confirm: useId() };

  // El token se toma del hash una sola vez y vive solo en este estado.
  const [token] = useState(() => tokenFromHash(hash));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const submitting = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);

  // El token no debe quedarse en la URL, el historial ni el Referer.
  useEffect(() => {
    if (router.state.location.hash === '') return;
    const { pathname, searchStr } = router.state.location;
    router.history.replace(`${pathname}${searchStr}`);
  }, [router]);

  useEffect(() => {
    if (feedback !== null) alertRef.current?.focus();
  }, [feedback]);

  const requestNew = (
    <Link to="/recuperar" className="text-sm underline underline-offset-4">
      {es.auth.reset.requestNew}
    </Link>
  );

  if (token === '') {
    return (
      <AuthCard title={es.auth.reset.title}>
        <FieldGroup>
          <Alert variant="destructive">
            <AlertDescription>{es.auth.errors.tokenInvalid}</AlertDescription>
          </Alert>
          {requestNew}
        </FieldGroup>
      </AuthCard>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFeedback({ text: es.auth.reset.tooShort });
      return;
    }
    if (password !== confirm) {
      setFeedback({ text: es.auth.reset.mismatch });
      return;
    }

    submitting.current = true;
    setPending(true);
    setFeedback(null);
    try {
      await api.resetPassword({ newPassword: password, token });
      go('/iniciar-sesion', { search: { restablecida: '1' } });
    } catch (error) {
      setPassword('');
      setConfirm('');
      setFeedback({
        text: authErrorMessage(error),
        tokenInvalid: error instanceof ApiError && error.code === 'INVALID_TOKEN',
      });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <AuthCard title={es.auth.reset.title}>
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <FieldGroup>
          {feedback ? (
            <Alert variant="destructive" ref={alertRef} tabIndex={-1}>
              <AlertDescription>{feedback.text}</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor={ids.password}>{es.auth.reset.password}</FieldLabel>
            <Input
              id={ids.password}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={ids.confirm}>{es.auth.reset.confirm}</FieldLabel>
            <Input
              id={ids.confirm}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? es.auth.reset.pending : es.auth.reset.submit}
          </Button>
          {feedback?.tokenInvalid ? requestNew : null}
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
