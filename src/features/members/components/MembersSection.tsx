import { useIsMutating } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Section } from '@/components/shared/Section';
import { Button } from '@/components/ui/button';
import type { Member } from '@/lib/api/schemas';
import { formatDate } from '@/lib/format';
import { es } from '@/lib/i18n/es';
import { useMe } from '@/lib/permissions';
import { useMembers } from '../hooks/useMembers';
import { canChangeRole, canTerminateMember, reasonRequiredFor } from '../terminate-rules';
import { ChangeRoleDialog } from './ChangeRoleDialog';
import { MemberDetailSheet } from './MemberDetailSheet';
import { MemberStatusBadge } from './MemberStatusBadge';
import { TerminateMemberDialog } from './TerminateMemberDialog';

type Pending = { kind: 'terminate' | 'role'; member: Member };

/** Activos primero y, dentro de cada grupo, los más antiguos primero. */
function sortMembers(members: readonly Member[]): Member[] {
  const rank = (member: Member) => (member.status === 'active' ? 0 : 1);
  return [...members].sort(
    (a, b) => rank(a) - rank(b) || Date.parse(a.since) - Date.parse(b.since),
  );
}

/**
 * Miembros de una inmobiliaria. Las acciones salen de los permisos de la sesión: el `admin` del
 * MLS termina, el `broker` termina y cambia roles. Con `detail` el nombre abre un panel lateral.
 */
export function MembersSection({
  agencyId,
  detail = false,
}: {
  agencyId: string;
  detail?: boolean;
}) {
  const query = useMembers(agencyId);
  const me = useMe();
  const busy =
    useIsMutating({ predicate: (mutation) => mutation.options.mutationKey?.[0] === 'members' }) > 0;
  const [pending, setPending] = useState<Pending | null>(null);
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  // El foco pasa al aviso tras el éxito (el botón de origen puede desaparecer). Va en un
  // `setTimeout` para ganarle a la devolución de foco de Radix al cerrar el diálogo.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => noticeRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [notice]);

  const rows = useMemo(() => sortMembers(query.data ?? []), [query.data]);
  const showActions = rows.some(
    (member) => canTerminateMember(me, member) || canChangeRole(me, member),
  );
  const dim = (member: Member) => (member.status === 'active' ? '' : 'text-text-muted');

  const actions = (member: Member, onPick?: () => void) => {
    const open = (kind: Pending['kind']) => () => {
      setNotice(null);
      onPick?.();
      setPending({ kind, member });
    };
    return (
      <>
        {canChangeRole(me, member) ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            aria-label={es.members.changeRole.actionFor(member.fullName)}
            onClick={open('role')}
          >
            {es.members.changeRole.action}
          </Button>
        ) : null}
        {canTerminateMember(me, member) ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            aria-label={es.members.terminate.actionFor(member.fullName)}
            onClick={open('terminate')}
          >
            {es.members.terminate.action}
          </Button>
        ) : null}
      </>
    );
  };

  const columns: Column<Member>[] = [
    {
      id: 'name',
      header: es.members.columns.name,
      cell: (member) =>
        detail ? (
          <button
            type="button"
            aria-label={es.members.detail.open(member.fullName)}
            className={`type-data text-left underline-offset-4 hover:underline ${dim(member)}`}
            onClick={() => setDetailMember(member)}
          >
            {member.fullName}
          </button>
        ) : (
          <span className={dim(member)}>{member.fullName}</span>
        ),
    },
    {
      id: 'email',
      header: es.members.columns.email,
      cell: (member) => <span className={dim(member)}>{member.email}</span>,
    },
    {
      id: 'role',
      header: es.members.columns.role,
      cell: (member) => (
        <span className={dim(member)}>
          {(es.members.roles as Record<string, string>)[member.role] ?? member.role}
        </span>
      ),
    },
    {
      id: 'status',
      header: es.members.columns.status,
      cell: (member) => <MemberStatusBadge status={member.status} />,
    },
    {
      id: 'since',
      header: es.members.columns.since,
      cell: (member) => <span className={dim(member)}>{formatDate(member.since)}</span>,
    },
    ...(showActions
      ? [
          {
            id: 'actions',
            header: es.members.columns.actions,
            cell: (member: Member) => <div className="flex gap-2">{actions(member)}</div>,
          },
        ]
      : []),
  ];

  const done = (message: string) => {
    setPending(null);
    setNotice(message);
  };

  return (
    <Section title={es.members.title}>
      {notice ? (
        <p ref={noticeRef} role="status" tabIndex={-1} className="type-data">
          {notice}
        </p>
      ) : null}
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(member) => member.memberId}
        caption={es.members.caption}
        isLoading={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={{ title: es.members.empty.title, description: es.members.empty.description }}
      />
      {detailMember ? (
        <MemberDetailSheet member={detailMember} onClose={() => setDetailMember(null)}>
          {actions(detailMember, () => setDetailMember(null))}
        </MemberDetailSheet>
      ) : null}
      {pending?.kind === 'terminate' ? (
        <TerminateMemberDialog
          key={pending.member.memberId}
          member={pending.member}
          reasonRequired={reasonRequiredFor(me)}
          open
          onOpenChange={(open) => (open ? undefined : setPending(null))}
          onDone={() => done(es.members.terminate.done)}
        />
      ) : null}
      {pending?.kind === 'role' ? (
        <ChangeRoleDialog
          key={pending.member.memberId}
          member={pending.member}
          open
          onOpenChange={(open) => (open ? undefined : setPending(null))}
          onDone={() => done(es.members.changeRole.done)}
        />
      ) : null}
    </Section>
  );
}
