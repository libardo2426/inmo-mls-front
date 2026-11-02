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
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useCountdown } from '@/hooks/useCountdown';
import { INVITABLE_ROLES, type InvitableRole, type Member } from '@/lib/api/schemas';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { useChangeMemberRole } from '../hooks/useChangeMemberRole';
import { memberErrorMessage } from '../messages';

type Props = {
  member: Member;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

const isInvitable = (role: string): role is InvitableRole =>
  (INVITABLE_ROLES as readonly string[]).includes(role);

/** Cambio de rol de un miembro entre los cuatro roles de inmobiliaria. */
export function ChangeRoleDialog({ member, open, onOpenChange, onDone }: Props) {
  const text = es.members.changeRole;
  const mutation = useChangeMemberRole();
  const countdown = useCountdown();
  const [role, setRole] = useState<string>(member.role);
  // Sin `DialogTrigger`, Radix no devuelve el foco: se guarda quién lo tenía al abrir.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  const waiting = countdown.remaining > 0;
  const canSubmit = isInvitable(role) && role !== member.role && !mutation.isPending && !waiting;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !isInvitable(role)) return;
    mutation.mutate(
      { memberId: member.memberId, role },
      {
        onSuccess: () => onDone(),
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
            <DialogTitle>{text.title(member.fullName)}</DialogTitle>
            <DialogDescription>{text.description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="change-role">{text.roleLabel}</Label>
            <NativeSelect
              id="change-role"
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
                  ? es.members.errors.rateLimited(countdown.remaining)
                  : memberErrorMessage(mutation.error)}
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
              {es.members.terminate.cancel}
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
