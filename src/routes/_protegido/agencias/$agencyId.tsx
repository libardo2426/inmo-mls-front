import { createFileRoute } from '@tanstack/react-router';
import { useAgency } from '@/features/agencies/hooks/useAgency';
import { parseStatusFilter, type StatusFilter } from '@/features/agencies/hooks/useAgencies';
import { AgencyDetailScreen } from '@/features/agencies/screens/AgencyDetailScreen';
import { MembersSection } from '@/features/members/components/MembersSection';
import { assertCan, can, useMe } from '@/lib/permissions';

export const Route = createFileRoute('/_protegido/agencias/$agencyId')({
  validateSearch: (search: Record<string, unknown>): { status: StatusFilter } => ({
    status: parseStatusFilter(search.status),
  }),
  beforeLoad: ({ context }) => assertCan(context.me, 'agency.list', 'network'),
  component: AgencyDetailRoute,
});

function AgencyDetailRoute() {
  const { agencyId } = Route.useParams();
  const { status } = Route.useSearch();
  const me = useMe();
  // Misma consulta que la pantalla (caché compartida); los hijos solo se montan con la agencia cargada.
  const agency = useAgency(agencyId).data;
  return (
    <AgencyDetailScreen agencyId={agencyId} filter={status}>
      {agency && can(me, 'member.read') ? (
        <MembersSection agencyId={agencyId} agencyStatus={agency.status} />
      ) : null}
    </AgencyDetailScreen>
  );
}
