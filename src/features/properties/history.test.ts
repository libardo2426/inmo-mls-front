import { describe, expect, it } from 'vitest';
import { formatHistoryValue } from './history';

describe('formatHistoryValue', () => {
  it('list_price con importe usa el formato de dinero', () => {
    expect(
      formatHistoryValue('list_price', { amountMinor: '35000000000', currency: 'COP' }),
    ).toContain('350.000.000,00');
  });

  it('status traduce un código conocido y deja crudo uno desconocido', () => {
    expect(formatHistoryValue('status', 'active')).toBe('Activo');
    expect(formatHistoryValue('status', 'raro')).toBe('raro');
  });

  it('editor con nombre muestra el nombre', () => {
    expect(formatHistoryValue('editor', { id: 'x', name: 'Ana Pérez' })).toBe('Ana Pérez');
  });

  it.each([null, undefined])('un valor %s se muestra como sin dato', (value) => {
    expect(formatHistoryValue('status', value)).toBe('—');
  });

  it('un objeto no reconocido nunca es [object Object]', () => {
    const text = formatHistoryValue('editor', { foo: 1 });
    expect(text).not.toContain('[object Object]');
    expect(text).toBe('—');
  });

  it('un número o booleano se muestra como texto', () => {
    expect(formatHistoryValue('status', 7)).toBe('7');
    expect(formatHistoryValue('status', true)).toBe('true');
  });
});
