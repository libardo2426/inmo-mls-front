import { describe, expect, it } from 'vitest';
import { parsePropertyFilters, propertyStatusTone } from './model';

const UUID = '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6c';

describe('parsePropertyFilters', () => {
  it('conserva los valores válidos', () => {
    expect(
      parsePropertyFilters({ type: 'house', status: 'active', agency: UUID, territory: '05001' }),
    ).toEqual({ type: 'house', status: 'active', agency: UUID, territory: '05001' });
  });

  it('descarta los inválidos', () => {
    expect(
      parsePropertyFilters({ type: 'raro', status: 'raro', agency: 'x', territory: '' }),
    ).toEqual({});
  });

  it('acepta un municipio numérico (el router convierte `?territory=11001` en número)', () => {
    expect(parsePropertyFilters({ territory: 11001 })).toEqual({ territory: '11001' });
  });

  it('descarta valores que no son texto', () => {
    expect(parsePropertyFilters({ type: 3, status: ['active'], agency: null })).toEqual({});
  });
});

describe('propertyStatusTone', () => {
  it('asigna tono a los estados conocidos', () => {
    expect(propertyStatusTone('active')).toBe('success');
    expect(propertyStatusTone('suspended')).toBe('danger');
  });
  it('un estado desconocido es neutro', () => {
    expect(propertyStatusTone('raro')).toBe('neutral');
  });
});
