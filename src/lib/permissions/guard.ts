import type { MeResponse } from '@/lib/api/schemas';
import { can } from './can';
import type { Permission, Scope } from './catalog';

/** La sesión no tiene el permiso que exige la ruta. El router lo muestra como «sin permiso». */
export class PermissionDeniedError extends Error {
  constructor() {
    super('Sin permiso');
    this.name = 'PermissionDeniedError';
  }
}

/** Para `beforeLoad` de una ruta: lanza `PermissionDeniedError` si falta el permiso. */
export function assertCan(me: MeResponse, permission: Permission, minScope?: Scope): void {
  if (!can(me, permission, minScope)) throw new PermissionDeniedError();
}
