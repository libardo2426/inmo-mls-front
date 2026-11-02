import { createFileRoute } from '@tanstack/react-router';
import { AgenciesListScreen } from '@/features/agencies/screens/AgenciesListScreen';
import { parseStatusFilter, type StatusFilter } from '@/features/agencies/hooks/useAgencies';
import { assertCan } from '@/lib/permissions';

export const Route = createFileRoute('/_protegido/agencias/')({
  validateSearch: (search: Record<string, unknown>): { status: StatusFilter } => ({
    status: parseStatusFilter(search.status),
  }),
  beforeLoad: ({ context }) => assertCan(context.me, 'agency.list', 'network'),
  component: AgenciesRoute,
});

function AgenciesRoute() {
  const { status } = Route.useSearch();
  return <AgenciesListScreen filter={status} />;
}
