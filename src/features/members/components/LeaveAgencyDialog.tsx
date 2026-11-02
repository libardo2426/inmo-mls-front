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
import { useCountdown } from '@/hooks/useCountdown';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { useLeaveAgency } from '../hooks/useLeaveAgency';
import { memberErrorMessage } from '../messages';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

/** Confirmación para dejar la inmobiliaria (renuncia propia). */
export function LeaveAgencyDialog({ open, onOpenChange, onDone }: Props) {
  const text = es.members.leave;
  const mutation = useLeaveAgency();
  const countdown = useCountdown();
  // Sin `DialogTrigger`, Radix no devuelve el foco: se guarda quién lo tenía al abrir.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  const waiting = countdown.remaining > 0;
  const canSubmit = !mutation.isPending && !waiting;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    mutation.mutate(undefined, {
      onSuccess: () => onDone(),
      onError: (error) => {
        if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds) {
          countdown.start(error.retryAfterSeconds);
        }
      },
    });
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
