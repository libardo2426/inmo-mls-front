import type { Member, MeResponse } from '@/lib/api/schemas';
import { can } from '@/lib/permissions';

/** Máximo de caracteres del motivo (`TerminateMemberBody.reason`). */
export const REASON_MAX = 1000;

/** ¿Es la fila de la propia sesión? Se compara el id de usuario, nunca el rol. */
export function isSelf(me: MeResponse, member: Pick<Member, 'userId'>): boolean {
  return me.user.id === member.userId;
}

/**
 * ¿Se ofrece «Terminar»? Miembro activo, ajeno, y permiso de red (MLS) o de agencia (broker).
 * Es solo UX (el backend aún no manda `allowedActions` de miembros); el servidor decide.
 */
export function canTerminateMember(
  me: MeResponse,
  member: Pick<Member, 'status' | 'userId'>,
): boolean {
  return (
    member.status === 'active' &&
    !isSelf(me, member) &&
    (can(me, 'member.terminate_any', 'network') || can(me, 'member.terminate', 'agency'))
  );
}

/** ¿Se ofrece «Cambiar rol»? Miembro activo y ajeno, con `member.update_role` de agencia. */
export function canChangeRole(me: MeResponse, member: Pick<Member, 'status' | 'userId'>): boolean {
  return (
    member.status === 'active' && !isSelf(me, member) && can(me, 'member.update_role', 'agency')
  );
}

/** El backend exige motivo solo al `admin` del MLS; al broker se lo deja opcional. */
export function reasonRequiredFor(me: MeResponse): boolean {
  return can(me, 'member.terminate_any', 'network');
}

/** Cualquier miembro de una inmobiliaria puede renunciar; el personal del MLS (sin agencia) no. */
export function canLeaveAgency(me: MeResponse): boolean {
  return me.membership?.agencyId != null;
}
