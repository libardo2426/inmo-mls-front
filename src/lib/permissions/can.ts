import type { MeResponse } from '@/lib/api/schemas';
import type { Permission, Scope } from './catalog';

const RANK: Record<Scope, number> = { own: 0, agency: 1, network: 2 };

function isScope(value: unknown): value is Scope {
  return typeof value === 'string' && Object.hasOwn(RANK, value);
}

/**
 * ¿Tiene la sesión el permiso (con al menos `minScope`)? Es una ayuda de UX: el servidor
 * es la autoridad. Un permiso ausente, un alcance inválido o la falta de membresía dan `false`.
 */
export function can(
  me: Pick<MeResponse, 'membership'>,
  permission: Permission,
  minScope?: Scope,
): boolean {
  const granted: unknown = me.membership?.permissions[permission];
  if (!isScope(granted)) return false;
  return minScope === undefined || RANK[granted] >= RANK[minScope];
}
