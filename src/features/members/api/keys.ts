/** Claves de caché de TanStack Query para miembros. `all` invalida todos los listados. */
export const memberKeys = {
  all: ['members'] as const,
  list: (agencyId: string) => ['members', 'list', agencyId] as const,
};
