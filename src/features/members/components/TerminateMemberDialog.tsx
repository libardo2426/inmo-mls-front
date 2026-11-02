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
import { Textarea } from '@/components/ui/textarea';
import { useCountdown } from '@/hooks/useCountdown';
import type { Member } from '@/lib/api/schemas';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { useTerminateMember } from '../hooks/useTerminateMember';
import { memberErrorMessage } from '../messages';
import { REASON_MAX } from '../terminate-rules';

type Props = {
  member: Member;
  /** Obligatorio solo para el `admin` del MLS; al broker se le deja opcional. */
  reasonRequired: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

/** Confirmación de la terminación de un miembro; el motivo es obligatorio. */
export function TerminateMemberDialog({
  member,
  reasonRequired,
  open,
  onOpenChange,
  onDone,
}: Props) {
  const text = es.members.terminate;
  const mutation = useTerminateMember();
  const countdown = useCountdown();
  const [reason, setReason] = useState('');
  // Sin `DialogTrigger`, Radix no devuelve el foco: se guarda quién lo tenía al abrir.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  const trimmed = reason.trim();
  const reasonOk = trimmed.length <= REASON_MAX && (!reasonRequired || trimmed.length > 0);
  const waiting = countdown.remaining > 0;
  const canSubmit = reasonOk && !mutation.isPending && !waiting;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    mutation.mutate(
      { memberId: member.memberId, ...(trimmed ? { reason: trimmed } : {}) },
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
            <DialogDescription>{text.description(member.fullName)}</DialogDescription>
          </DialogHeader>
          {reasonRequired ? (
            <p className="text-muted-foreground text-sm">{text.twoFactorNotice}</p>
          ) : null}
          <div className="flex flex-col gap-1">
            <Label htmlFor="terminate-reason">{text.reasonLabel}</Label>
            <Textarea
              id="terminate-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-describedby="terminate-reason-help"
            />
            <p id="terminate-reason-help" className="text-muted-foreground text-xs">
              {reasonRequired ? text.reasonHelp(REASON_MAX) : text.reasonOptionalHelp(REASON_MAX)}
            </p>
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
              {text.cancel}
            </Button>
            <Button type="submit" variant="destructive" disabled={!canSubmit}>
              {text.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
