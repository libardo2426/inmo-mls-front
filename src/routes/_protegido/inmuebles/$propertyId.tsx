import { createFileRoute } from '@tanstack/react-router';
import { parsePropertyFilters, type PropertyFilters } from '@/features/properties/model';
import { assertCan } from '@/lib/permissions';

// Provisional: la ficha llega en la Tarea 4; aquí solo existe para que el listado enlace a ella.
export const Route = createFileRoute('/_protegido/inmuebles/$propertyId')({
  validateSearch: (search: Record<string, unknown>): PropertyFilters =>
    parsePropertyFilters(search),
  beforeLoad: ({ context }) => assertCan(context.me, 'property.read', 'network'),
  component: () => null,
});
