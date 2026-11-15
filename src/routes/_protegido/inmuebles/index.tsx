import { createFileRoute } from '@tanstack/react-router';
import { parsePropertyFilters, type PropertyFilters } from '@/features/properties/model';
import { PropertiesListScreen } from '@/features/properties/screens/PropertiesListScreen';
import { assertCan } from '@/lib/permissions';

export const Route = createFileRoute('/_protegido/inmuebles/')({
  validateSearch: (search: Record<string, unknown>): PropertyFilters =>
    parsePropertyFilters(search),
  beforeLoad: ({ context }) => assertCan(context.me, 'property.read', 'network'),
  component: PropertiesRoute,
});

function PropertiesRoute() {
  // El router conserva las claves que `validateSearch` descarta: se normaliza otra vez para que
  // un valor inválido de la URL nunca llegue al backend.
  const filters = parsePropertyFilters(Route.useSearch());
  return <PropertiesListScreen filters={filters} />;
}
