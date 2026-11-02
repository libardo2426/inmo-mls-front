import type { ReactNode } from 'react';
import type { Permission, Scope } from './catalog';
import { useCan } from './useCan';

type CanProps = {
  permission: Permission;
  minScope?: Scope;
  fallback?: ReactNode;
  children: ReactNode;
};

/** Muestra `children` solo si la sesión tiene el permiso; si no, `fallback` (o nada). */
export function Can({ permission, minScope, fallback = null, children }: CanProps) {
  const can = useCan();
  return can(permission, minScope) ? children : fallback;
}
