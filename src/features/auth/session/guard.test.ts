import { describe, expect, it } from 'vitest';
import { meFixture } from '@/test/fixtures';
import { guardTarget, safeRedirect, type SessionState } from './guard';

const authenticated: SessionState = { status: 'authenticated', me: meFixture() };
const anonymous: SessionState = { status: 'anonymous' };
const twoFactor: SessionState = { status: 'two-factor-required' };
const noMembership: SessionState = { status: 'no-membership' };
const unavailable: SessionState = { status: 'unavailable' };
const offline: SessionState = { status: 'offline' };
const back = '/propiedades?x=1';

describe('guardTarget', () => {
  it.each([
    ['protected', anonymous, { to: '/iniciar-sesion', search: { redirect: back } }],
    ['protected', twoFactor, { to: '/activar-2fa' }],
    ['protected', noMembership, { to: '/sin-acceso' }],
    ['protected', unavailable, { to: '/mantenimiento' }],
    ['protected', offline, { to: '/sin-conexion' }],
    ['protected', authenticated, null],
    ['public-only', authenticated, { to: '/' }],
    ['public-only', twoFactor, { to: '/activar-2fa' }],
    ['public-only', anonymous, null],
    ['public-only', offline, null],
    ['public-only', unavailable, null],
    ['two-factor-setup', twoFactor, null],
    ['two-factor-setup', anonymous, { to: '/iniciar-sesion', search: { redirect: back } }],
    ['two-factor-setup', authenticated, { to: '/' }],
    ['no-access', noMembership, null],
    ['no-access', anonymous, { to: '/iniciar-sesion', search: { redirect: back } }],
    ['no-access', authenticated, { to: '/' }],
    ['invitation', anonymous, null],
    ['invitation', noMembership, null],
    ['invitation', authenticated, null],
    ['invitation', twoFactor, { to: '/activar-2fa' }],
    ['invitation', unavailable, { to: '/mantenimiento' }],
    ['invitation', offline, { to: '/sin-conexion' }],
  ] as const)('%s con %j → %j', (rule, state, expected) => {
    expect(guardTarget(rule, state, back)).toEqual(expected);
  });
});

describe('safeRedirect', () => {
  it('acepta rutas internas con búsqueda', () => {
    expect(safeRedirect('/propiedades?x=1')).toBe('/propiedades?x=1');
    expect(safeRedirect('/')).toBe('/');
  });

  it.each([
    [undefined],
    [''],
    ['//evil.com'],
    ['/\\evil.com'],
    ['https://evil.com'],
    ['javascript:alert(1)'],
    ['evil'],
    ['/a\nb'],
    ['/a\tb'],
  ])('rechaza %j y vuelve a /', (raw) => {
    expect(safeRedirect(raw)).toBe('/');
  });
});
