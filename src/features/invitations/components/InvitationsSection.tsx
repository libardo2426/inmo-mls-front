import { useIsMutating } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Section } from '@/components/shared/Section';
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
import type { Invitation, InvitationStatus, InvitationWithWarnings } from '@/lib/api/schemas';
import { formatDate } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useCancelInvitation } from '../hooks/useCancelInvitation';
import { useInvitations } from '../hooks/useInvitations';
import { useResendInvitation } from '../hooks/useResendInvitation';
import { invitationErrorMessage } from '../messages';
import { InvitationStatusBadge } from './InvitationStatusBadge';
import { InviteMemberDialog } from './InviteMemberDialog';

const STATUSES: readonly InvitationStatus[] = ['pending', 'expired', 'accepted', 'cancelled'];

/** Aviso tras una acción; si el correo no salió, queda con «Reenviar» para esa invitación. */
type Notice = { text: string; retry?: Invitation };

const noticeFor = (done: string, result: InvitationWithWarnings): Notice =>
  result.warnings.some((warning) => warning.code === 'email_not_sent')
    ? { text: es.invitations.emailNotSent, retry: result.invitation }
    : { text: done };

function CancelInvitationDialog({
  agencyId,
  invitation,
  onClose,
  onDone,
}: {
  agencyId: string;
  invitation: Invitation;
  onClose: () => void;
  onDone: () => void;
}) {
  const mutation = useCancelInvitation(agencyId);
  // Sin `DialogTrigger`, Radix no devuelve el foco: se guarda quién lo tenía al abrir.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  return (
    <Dialog open onOpenChange={(open) => (open || mutation.isPending ? undefined : onClose())}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{es.invitations.cancelConfirmTitle}</DialogTitle>
          <DialogDescription>
            {es.invitations.cancelConfirmDescription(invitation.email)}
          </DialogDescription>
        </DialogHeader>
        {mutation.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{invitationErrorMessage(mutation.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
            {es.invitations.keep}
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(invitation.id, { onSuccess: onDone })}
          >
            {es.invitations.cancelConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Invitaciones de la inmobiliaria: listado por estado, invitar, reenviar y cancelar. */
export function InvitationsSection({ agencyId }: { agencyId: string }) {
  const [status, setStatus] = useState<InvitationStatus>('pending');
  const query = useInvitations(agencyId, status);
  const resend = useResendInvitation(agencyId);
  const busy =
    useIsMutating({
      predicate: (mutation) => mutation.options.mutationKey?.[0] === 'invitations',
    }) > 0;
  const [inviting, setInviting] = useState(false);
  const [cancelling, setCancelling] = useState<Invitation | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  // El foco pasa al aviso tras una acción (el botón de origen puede desaparecer). Va en un
  // `setTimeout` para ganarle a la devolución de foco de Radix al cerrar el diálogo.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => noticeRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [notice]);

  const rows = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  const doResend = (invitation: Invitation) => {
    setNotice(null);
    resend.mutate(invitation.id, {
      onSuccess: (result) => setNotice(noticeFor(es.invitations.resendDone, result)),
    });
  };

  const columns: Column<Invitation>[] = [
    { id: 'email', header: es.invitations.columns.email, cell: (item) => item.email },
    { id: 'name', header: es.invitations.columns.name, cell: (item) => item.fullName },
    {
      id: 'role',
      header: es.invitations.columns.role,
      cell: (item) => (es.members.roles as Record<string, string>)[item.role] ?? item.role,
    },
    {
      id: 'status',
      header: es.invitations.columns.status,
      cell: (item) => <InvitationStatusBadge status={item.status} />,
    },
    {
      id: 'expires',
      header: es.invitations.columns.expires,
      cell: (item) => formatDate(item.expiresAt),
    },
    {
      id: 'actions',
      header: es.invitations.columns.actions,
      cell: (item) => (
        <div className="flex gap-2">
          {item.status === 'pending' || item.status === 'expired' ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              aria-label={es.invitations.resendFor(item.email)}
              onClick={() => doResend(item)}
            >
              {es.invitations.resend}
            </Button>
          ) : null}
          {item.status === 'pending' ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              aria-label={es.invitations.cancelFor(item.email)}
              onClick={() => {
                setNotice(null);
                setCancelling(item);
              }}
            >
              {es.invitations.cancel}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <Section title={es.invitations.title}>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="invitation-status">{es.invitations.filterLabel}</Label>
          <NativeSelect
            id="invitation-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as InvitationStatus)}
            className="w-48"
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {es.invitations.status[value]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button
          onClick={() => {
            setNotice(null);
            setInviting(true);
          }}
        >
          {es.invitations.invite.action}
        </Button>
      </div>
      {notice ? (
        <div
          ref={noticeRef}
          role="status"
          tabIndex={-1}
          className="type-data flex items-center gap-3"
        >
          <span>{notice.text}</span>
          {notice.retry ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              aria-label={es.invitations.resendFor(notice.retry.email)}
              onClick={() => notice.retry && doResend(notice.retry)}
            >
              {es.invitations.resend}
            </Button>
          ) : null}
        </div>
      ) : null}
      {resend.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{invitationErrorMessage(resend.error)}</AlertDescription>
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(item) => item.id}
        caption={es.invitations.caption}
        isLoading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={{ title: es.invitations.empty.title, description: es.invitations.empty.description }}
        hasMore={query.hasNextPage}
        onLoadMore={() => void query.fetchNextPage()}
        isLoadingMore={query.isFetchingNextPage}
      />
      {inviting ? (
        <InviteMemberDialog
          agencyId={agencyId}
          open
          onOpenChange={(open) => (open ? undefined : setInviting(false))}
          onDone={(result) => {
            setInviting(false);
            setNotice(noticeFor(es.invitations.invite.done, result));
          }}
        />
      ) : null}
      {cancelling ? (
        <CancelInvitationDialog
          key={cancelling.id}
          agencyId={agencyId}
          invitation={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null);
            setNotice({ text: es.invitations.cancelDone });
          }}
        />
      ) : null}
    </Section>
  );
}
