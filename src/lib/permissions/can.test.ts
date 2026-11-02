import { describe, expect, it } from 'vitest';
import type { MeResponse } from '@/lib/api/schemas';
import { meFixture } from '@/test/fixtures';
import { can } from './can';

function meWith(permissions: Record<string, 'own' | 'agency' | 'network'>): MeResponse {
  const me = meFixture();
  if (!me.membership) throw new Error('la fixture debe traer membresía');
  return { ...me, membership: { ...me.membership, permissions } };
}

describe('can', () => {
  it('es true si el permiso existe con cualquier alcance y false si falta', () => {
    const me = meWith({ 'agency.read': 'own' });
    expect(can(me, 'agency.read')).toBe(true);
    expect(can(me, 'agency.list')).toBe(false);
  });

  it('respeta el orden own < agency < network', () => {
    expect(can(meWith({ 'agency.read': 'network' }), 'agency.read', 'agency')).toBe(true);
    expect(can(meWith({ 'agency.read': 'agency' }), 'agency.read', 'agency')).toBe(true);
    expect(can(meWith({ 'agency.read': 'own' }), 'agency.read', 'agency')).toBe(false);
    expect(can(meWith({ 'agency.read': 'agency' }), 'agency.read', 'network')).toBe(false);
  });

  it('es false sin membresía', () => {
    expect(can({ ...meFixture(), membership: null }, 'agency.read')).toBe(false);
  });

  it('ignora un permiso desconocido sin afectar a los demás', () => {
    const me = meWith({ 'foo.bar': 'network', 'agency.list': 'network' });
    expect(can(me, 'agency.list')).toBe(true);
    expect(can(me, 'agency.read')).toBe(false);
  });

  it('es false si el valor del mapa no es un alcance válido', () => {
    const me = meWith({ 'agency.read': 'global' as 'own' });
    expect(can(me, 'agency.read')).toBe(false);
  });
});
