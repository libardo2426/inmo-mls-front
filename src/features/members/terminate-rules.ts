import type { Member, MeResponse } from '@/lib/api/schemas';
import { can } from '@/lib/permissions';

/** Máximo de caracteres del motivo (`TerminateMemberBody.reason`). */
export const REASON_MAX = 1000;

/**
 * ¿Se ofrece «Terminar»? Permiso de red **y** miembro activo. Es solo UX (el backend aún no manda
 * `allowedActions` de miembros); el servidor decide y su error se muestra.
 */
export function canTerminateMember(me: MeResponse, member: Pick<Member, 'status'>): boolean {
  return member.status === 'active' && can(me, 'member.terminate_any', 'network');
}
