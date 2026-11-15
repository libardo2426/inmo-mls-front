import { describe, expect, it } from 'vitest';
import { formatMinorAmount, MINOR_UNIT_DECIMALS } from './format-money';

describe('formatMinorAmount', () => {
  it('usa 2 decimales fijos (centavos), no los de Intl', () => {
    expect(MINOR_UNIT_DECIMALS).toBe(2);
    expect(formatMinorAmount('35000000000', 'COP')).toContain('350.000.000,00');
  });

  it('formatea importes menores a una unidad', () => {
    expect(formatMinorAmount('5', 'COP')).toContain('0,05');
  });

  it('no pierde precisión con 18 dígitos', () => {
    expect(formatMinorAmount('999999999999999999', 'COP')).toContain('9.999.999.999.999.999,99');
  });

  it('con una entrada no numérica devuelve el texto original', () => {
    expect(formatMinorAmount('abc', 'COP')).toBe('abc');
  });
});
