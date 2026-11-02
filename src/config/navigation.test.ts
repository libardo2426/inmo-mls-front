import { Building2, House } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import type { MeResponse } from '@/lib/api/schemas';
import { meFixture } from '@/test/fixtures';
import { navigation, visibleNavigation, type NavItem } from './navigation';

function meWith(permissions: Record<string, 'own' | 'agency' | 'network'>): MeResponse {
  const me = meFixture();
  if (!me.membership) throw new Error('la fixture debe traer membresía');
  return { ...me, membership: { ...me.membership, permissions } };
}

const items: NavItem[] = [
  { to: '/', label: 'Inicio', icon: House },
  { to: '/agencias', label: 'Agencias', icon: Building2, permission: 'agency.list' },
  {
    to: '/red',
    label: 'Red',
    icon: Building2,
    permission: 'agency.read',
    minScope: 'network',
  },
];

describe('visibleNavigation', () => {
  it('un ítem sin permiso siempre aparece', () => {
    expect(visibleNavigation(meWith({}), items).map((i) => i.to)).toEqual(['/']);
  });

  it('un ítem con permiso aparece solo si la sesión lo tiene, y conserva el orden', () => {
    const me = meWith({ 'agency.list': 'network', 'agency.read': 'network' });
    expect(visibleNavigation(me, items).map((i) => i.to)).toEqual(['/', '/agencias', '/red']);
  });

  it('respeta minScope', () => {
    const me = meWith({ 'agency.read': 'agency' });
    expect(visibleNavigation(me, items).map((i) => i.to)).toEqual(['/']);
  });

  it('sin membresía solo quedan los ítems sin permiso', () => {
    expect(visibleNavigation({ ...meFixture(), membership: null }, items).map((i) => i.to)).toEqual(
      ['/'],
    );
  });
});

describe('navigation', () => {
  it('en F2 solo contiene Inicio, sin permiso', () => {
    expect(navigation).toHaveLength(1);
    expect(navigation[0]).toMatchObject({ to: '/', label: 'Inicio' });
    expect(navigation[0]?.permission).toBeUndefined();
  });
});
