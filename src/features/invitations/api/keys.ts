import type { InvitationStatus } from '@/lib/api/schemas';

/** Claves de caché de TanStack Query para invitaciones. `all` invalida todos los listados. */
export const invitationKeys = {
  all: ['invitations'] as const,
  list: (agencyId: string, status: InvitationStatus) =>
    ['invitations', 'list', agencyId, status] as const,
};
