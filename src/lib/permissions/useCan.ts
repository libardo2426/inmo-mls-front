import { useCallback } from 'react';
import { can } from './can';
import type { Permission, Scope } from './catalog';
import { useMe } from './context';

/** Devuelve `can(permission, minScope?)` ligado a la sesión actual. Solo UX; manda el servidor. */
export function useCan(): (permission: Permission, minScope?: Scope) => boolean {
  const me = useMe();
  return useCallback((permission, minScope) => can(me, permission, minScope), [me]);
}
