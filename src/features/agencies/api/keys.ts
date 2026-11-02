import type { AgencyStatus } from '@/lib/api/schemas';

/** Claves de caché de TanStack Query para agencias. `all` invalida listado y detalle. */
export const agencyKeys = {
  all: ['agencies'] as const,
  list: (status: AgencyStatus | 'all') => ['agencies', 'list', status] as const,
  detail: (id: string) => ['agencies', 'detail', id] as const,
};
