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
import { Textarea } from '@/components/ui/textarea';
import type { AgencyApplication } from '@/lib/api/schemas';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { useReviewAgency } from '../hooks/useReviewAgency';
import { agencyErrorMessage } from '../messages';
import { matchesName, REASON_MAX, type ReviewAction } from '../review-rules';

type Props = {
  action: ReviewAction;
  agency: AgencyApplication;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (action: ReviewAction) => void;
  /** Otra persona ya revisó la solicitud (409 `agency_not_reviewable`). */
  onConflict?: () => void;
};

/** Confirmación de una acción de revisión; rechazar exige además escribir el nombre comercial. */
export function ReviewDialog({ action, agency, open, onOpenChange, onDone, onConflict }: Props) {
  const text = es.agencies.review;
  const mutation = useReviewAgency();
  const [reason, setReason] = useState('');
  const [typedName, setTypedName] = useState('');

  const needsReason = action !== 'approve';
  const trimmed = reason.trim();
  const reasonOk = !needsReason || (trimmed.length > 0 && trimmed.length <= REASON_MAX);
  const nameOk = action !== 'reject' || matchesName(typedName, agency.tradeName);
  const canSubmit = reasonOk && nameOk && !mutation.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    mutation.mutate(
      { id: agency.id, action, ...(needsReason ? { reason: trimmed } : {}) },
      {
        onSuccess: () => onDone(action),
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'agency_not_reviewable') {
            onOpenChange(false);
            onConflict?.();
          }
        },
      },
    );
  };

  const conflict =
    mutation.error instanceof ApiError && mutation.error.code === 'agency_not_reviewable';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (mutation.isPending ? undefined : onOpenChange(next))}
    >
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{text.titles[action]}</DialogTitle>
            <DialogDescription>{text.descriptions[action]}</DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">{text.twoFactorNotice}</p>
          {needsReason ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="review-reason">{text.reasonLabel}</Label>
              <Textarea
                id="review-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-describedby="review-reason-help"
              />
              <p id="review-reason-help" className="text-muted-foreground text-xs">
                {text.reasonHelp(REASON_MAX)}
              </p>
            </div>
          ) : null}
          {action === 'reject' ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="review-name">{text.confirmNameLabel(agency.tradeName)}</Label>
              <Input
                id="review-name"
                value={typedName}
                autoComplete="off"
                onChange={(event) => setTypedName(event.target.value)}
              />
            </div>
          ) : null}
          {mutation.isError && !conflict ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{agencyErrorMessage(mutation.error)}</AlertDescription>
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
            <Button
              type="submit"
              variant={action === 'reject' ? 'destructive' : 'default'}
              disabled={!canSubmit}
            >
              {text.actions[action]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
