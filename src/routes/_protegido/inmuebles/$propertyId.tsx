import { createFileRoute } from '@tanstack/react-router';
import { parsePropertyFilters, type PropertyFilters } from '@/features/properties/model';
import { PropertyDetailScreen } from '@/features/properties/screens/PropertyDetailScreen';
import { assertCan } from '@/lib/permissions';

export const Route = createFileRoute('/_protegido/inmuebles/$propertyId')({
  validateSearch: (search: Record<string, unknown>): PropertyFilters =>
    parsePropertyFilters(search),
  beforeLoad: ({ context }) => assertCan(context.me, 'property.read', 'network'),
  component: PropertyDetailRoute,
});

function PropertyDetailRoute() {
  const { propertyId } = Route.useParams();
  // Se normaliza otra vez: el router conserva claves que `validateSearch` descarta.
  const filters = parsePropertyFilters(Route.useSearch());
  return <PropertyDetailScreen propertyId={propertyId} filters={filters} />;
}
