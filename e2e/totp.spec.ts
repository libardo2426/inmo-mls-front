import { expect, test } from '@playwright/test';
import { totpCode } from './support/totp';

// Vectores de la RFC 6238 (SHA-1). El secreto ASCII «12345678901234567890» en base32 es:
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test.describe('totpCode (RFC 6238, SHA-1, 30 s, 6 dígitos)', () => {
  test('T = 59 s → 287082', () => {
    expect(totpCode(SECRET, 59_000)).toBe('287082');
  });

  test('T = 1111111109 s → 081804 (conserva el cero inicial)', () => {
    expect(totpCode(SECRET, 1_111_111_109_000)).toBe('081804');
  });

  test('T = 1234567890 s → 005924', () => {
    expect(totpCode(SECRET, 1_234_567_890_000)).toBe('005924');
  });

  test('el código no cambia dentro de la misma ventana de 30 s y cambia en la siguiente', () => {
    expect(totpCode(SECRET, 30_000)).toBe(totpCode(SECRET, 59_999));
    expect(totpCode(SECRET, 59_999)).not.toBe(totpCode(SECRET, 60_000));
  });

  test('acepta minúsculas, espacios y relleno en la clave base32', () => {
    const spaced = `${SECRET.slice(0, 8).toLowerCase()} ${SECRET.slice(8)}====`;
    expect(totpCode(spaced, 59_000)).toBe('287082');
  });

  test('una clave con caracteres fuera de base32 lanza un error', () => {
    expect(() => totpCode('NO-ES-BASE32!', 59_000)).toThrow(/base32/i);
  });
});
