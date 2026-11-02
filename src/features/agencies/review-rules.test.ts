import { describe, expect, it } from 'vitest';
import { meWithPermissions } from '@/test/fixtures';
import { matchesName, reviewActionsFor } from './review-rules';

const ALL = meWithPermissions({
  'agency.list': 'network',
  'agency.approve': 'network',
  'agency.request_changes': 'network',
  'agency.reject': 'network',
});
const READ_ONLY = meWithPermissions({ 'agency.list': 'network' });

describe('reviewActionsFor', () => {
  it('pending con los tres permisos habilita las tres acciones', () => {
    expect(reviewActionsFor(ALL, { status: 'pending' })).toEqual({
      approve: true,
      requestChanges: true,
      reject: true,
    });
  });

  it('pending con solo agency.list (compliance) no habilita ninguna', () => {
    expect(reviewActionsFor(READ_ONLY, { status: 'pending' })).toEqual({
      approve: false,
      requestChanges: false,
      reject: false,
    });
  });

  it('cada acción exige su propio permiso', () => {
    const me = meWithPermissions({ 'agency.list': 'network', 'agency.approve': 'network' });
    expect(reviewActionsFor(me, { status: 'pending' })).toEqual({
      approve: true,
      requestChanges: false,
      reject: false,
    });
  });

  it('el permiso debe ser de alcance red', () => {
    const me = meWithPermissions({ 'agency.approve': 'agency' });
    expect(reviewActionsFor(me, { status: 'pending' }).approve).toBe(false);
  });

  it.each(['changes_requested', 'active', 'rejected', 'suspended', 'terminated'] as const)(
    'con estado %s ninguna acción',
    (status) => {
      expect(Object.values(reviewActionsFor(ALL, { status })).some(Boolean)).toBe(false);
    },
  );
});

describe('matchesName', () => {
  it('ignora espacios, mayúsculas y acentos', () => {
    expect(matchesName('  MEDELLÍN inmobiliaria ', 'Medellin Inmobiliaria')).toBe(true);
  });
  it('un nombre distinto o vacío no coincide', () => {
    expect(matchesName('Otra', 'Medellin Inmobiliaria')).toBe(false);
    expect(matchesName('   ', 'Medellin Inmobiliaria')).toBe(false);
  });
});
