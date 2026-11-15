import type { PropertyFilters } from '../model';

/** Claves de caché de TanStack Query para inmuebles. */
export const propertyKeys = {
  all: ['properties'] as const,
  list: (filters: PropertyFilters) => ['properties', 'list', filters] as const,
  detail: (id: string) => ['properties', 'detail', id] as const,
};
