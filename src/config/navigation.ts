import { Building2, House, Users, type LucideIcon } from 'lucide-react';
import { es } from '@/lib/i18n/es';
import type { MeResponse } from '@/lib/api/schemas';
import { can, type Permission, type Scope } from '@/lib/permissions';

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Permiso que exige el ítem; sin él, basta con tener membresía. */
  permission?: Permission;
  minScope?: Scope;
};

/**
 * Menú del panel (ADR-0004 §5). Solo lleva ítems con pantalla real: cada fase agrega
 * el suyo con el permiso que lo habilita.
 */
export const navigation: readonly NavItem[] = [
  { to: '/', label: es.nav.home, icon: House },
  {
    to: '/agencias',
    label: es.nav.agencies,
    icon: Building2,
    permission: 'agency.list',
    minScope: 'network',
  },
  {
    to: '/equipo',
    label: es.nav.team,
    icon: Users,
    permission: 'member.invite',
    minScope: 'agency',
  },
];

/** Los ítems que la sesión puede ver, en el orden declarado. */
export function visibleNavigation(
  me: MeResponse,
  items: readonly NavItem[] = navigation,
): NavItem[] {
  return items.filter(
    (item) => item.permission === undefined || can(me, item.permission, item.minScope),
  );
}
