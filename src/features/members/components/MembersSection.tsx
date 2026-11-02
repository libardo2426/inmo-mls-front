import { useIsMutating } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { Section } from '@/components/shared/Section';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import type { Member } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';
import { useMe } from '@/lib/permissions';
import { useMembers } from '../hooks/useMembers';
import { TERMINATE_MUTATION_KEY } from '../hooks/useTerminateMember';
import { canTerminateMember, reasonRequiredFor } from '../terminate-rules';
import { MemberStatusBadge } from './MemberStatusBadge';
import { TerminateMemberDialog } from './TerminateMemberDialog';

/** Activos primero y, dentro de cada grupo, los más antiguos primero. */
function sortMembers(members: readonly Member[]): Member[] {
  const rank = (member: Member) => (member.status === 'active' ? 0 : 1);
  return [...members].sort(
    (a, b) => rank(a) - rank(b) || Date.parse(a.since) - Date.parse(b.since),
  );
}

/** Miembros de una inmobiliaria; el `admin` del MLS puede terminar a los activos. */
export function MembersSection({ agencyId }: { agencyId: string }) {
  const query = useMembers(agencyId);
  const me = useMe();
  const busy = useIsMutating({ mutationKey: TERMINATE_MUTATION_KEY }) > 0;
  const [target, setTarget] = useState<Member | null>(null);
  const [notice, setNotice] = useState(false);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  // El botón que abrió el diálogo desaparece al terminar al miembro: el foco pasa al aviso.
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  const rows = useMemo(() => sortMembers(query.data ?? []), [query.data]);
  const showActions = rows.some((member) => canTerminateMember(me, member));
  const dim = (member: Member) => (member.status === 'active' ? '' : 'text-text-muted');

  const columns: Column<Member>[] = [
    {
      id: 'name',
      header: es.members.columns.name,
      cell: (member) => <span className={dim(member)}>{member.fullName}</span>,
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
            cell: (member: Member) =>
              canTerminateMember(me, member) ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  aria-label={es.members.terminate.actionFor(member.fullName)}
                  onClick={() => {
                    setNotice(false);
                    setTarget(member);
                  }}
                >
                  {es.members.terminate.action}
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <Section title={es.members.title}>
      {notice ? (
        <p ref={noticeRef} role="status" tabIndex={-1} className="type-data">
          {es.members.terminate.done}
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
      {target ? (
        <TerminateMemberDialog
          key={target.memberId}
          member={target}
          reasonRequired={reasonRequiredFor(me)}
          open
          onOpenChange={(open) => (open ? undefined : setTarget(null))}
          onDone={() => {
            setTarget(null);
            setNotice(true);
          }}
        />
      ) : null}
    </Section>
  );
}
