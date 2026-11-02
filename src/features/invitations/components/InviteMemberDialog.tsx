import { useState, type FormEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useCountdown } from '@/hooks/useCountdown';
import {
  INVITABLE_ROLES,
  type InvitableRole,
  type InvitationWithWarnings,
} from '@/lib/api/schemas';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { useInviteMember } from '../hooks/useInviteMember';
import { invitationErrorMessage } from '../messages';

type Props = {
  agencyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (result: InvitationWithWarnings) => void;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const NAME_MAX = 200;

const isInvitable = (role: string): role is InvitableRole =>
  (INVITABLE_ROLES as readonly string[]).includes(role);

/** Invitar a una persona a la inmobiliaria: correo, nombre y rol. */
export function InviteMemberDialog({ agencyId, open, onOpenChange, onDone }: Props) {
  const text = es.invitations.invite;
  const mutation = useInviteMember(agencyId);
  const countdown = useCountdown();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<string>('agent');
  // Sin `DialogTrigger`, Radix no devuelve el foco: se guarda quién lo tenía al abrir.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  const cleanEmail = email.trim();
  const cleanName = fullName.trim();
  const valid =
    EMAIL.test(cleanEmail) &&
    cleanEmail.length <= EMAIL_MAX &&
    cleanName.length > 0 &&
    cleanName.length <= NAME_MAX &&
    isInvitable(role);
  const waiting = countdown.remaining > 0;
  const canSubmit = valid && !mutation.isPending && !waiting;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !isInvitable(role)) return;
    mutation.mutate(
      { email: cleanEmail, fullName: cleanName, role },
      {
        onSuccess: (result) => onDone(result),
        onError: (error) => {
          if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds) {
            countdown.start(error.retryAfterSeconds);
          }
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (mutation.isPending ? undefined : onOpenChange(next))}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener?.focus();
        }}
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{text.title}</DialogTitle>
            <DialogDescription>{text.description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="invite-email">{text.email}</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="invite-name">{text.fullName}</Label>
            <Input
              id="invite-name"
              autoComplete="off"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="invite-role">{text.role}</Label>
            <NativeSelect
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {INVITABLE_ROLES.map((value) => (
                <option key={value} value={value}>
                  {es.members.roles[value]}
                </option>
              ))}
            </NativeSelect>
          </div>
          {mutation.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {waiting
                  ? es.invitations.errors.rateLimited(countdown.remaining)
                  : invitationErrorMessage(mutation.error)}
              </AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              {text.cancel}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {text.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
