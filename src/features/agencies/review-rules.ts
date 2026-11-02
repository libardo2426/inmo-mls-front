import type { AgencyApplication, MeResponse } from '@/lib/api/schemas';
import { can, type Permission } from '@/lib/permissions';

export type ReviewAction = 'approve' | 'requestChanges' | 'reject';

export const REASON_MAX = 2000;

const PERMISSION: Record<ReviewAction, Permission> = {
  approve: 'agency.approve',
  requestChanges: 'agency.request_changes',
  reject: 'agency.reject',
};

/**
 * Qué acciones de revisión se ofrecen: permiso de red **y** solicitud `pending`. Es solo UX
 * (el backend aún no manda `allowedActions`, B-15); el servidor decide y su error se muestra.
 */
export function reviewActionsFor(
  me: MeResponse,
  agency: Pick<AgencyApplication, 'status'>,
): Record<ReviewAction, boolean> {
  const pending = agency.status === 'pending';
  const allowed = (action: ReviewAction) => pending && can(me, PERMISSION[action], 'network');
  return {
    approve: allowed('approve'),
    requestChanges: allowed('requestChanges'),
    reject: allowed('reject'),
  };
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

/** ¿Coincide lo escrito con el nombre? Sin distinguir mayúsculas ni acentos, recortando espacios. */
export function matchesName(typed: string, tradeName: string): boolean {
  const normalized = normalize(typed);
  return normalized !== '' && normalized === normalize(tradeName);
}
