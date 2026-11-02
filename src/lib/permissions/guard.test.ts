import { describe, expect, it } from 'vitest';
import { meFixture } from '@/test/fixtures';
import { assertCan, PermissionDeniedError } from './guard';

describe('assertCan', () => {
  const me = meFixture();

  it('no lanza si la sesión tiene el permiso', () => {
    expect(() => assertCan(me, 'agency.read')).not.toThrow();
  });

  it('lanza PermissionDeniedError si falta el permiso', () => {
    expect(() => assertCan(me, 'agency.approve')).toThrow(PermissionDeniedError);
  });

  it('lanza si el alcance no llega al mínimo', () => {
    expect(() => assertCan(me, 'agency.read', 'network')).not.toThrow();
    const own = {
      ...me,
      membership: me.membership && {
        ...me.membership,
        permissions: { 'agency.read': 'own' as const },
      },
    };
    expect(() => assertCan(own, 'agency.read', 'agency')).toThrow(PermissionDeniedError);
  });
});
