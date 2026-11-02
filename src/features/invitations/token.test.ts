import { afterEach, describe, expect, it } from 'vitest';
import { getInvitationToken, readTokenFromHash, setInvitationToken } from './token';

afterEach(() => setInvitationToken(null));

describe('readTokenFromHash', () => {
  it('lee el token de #token=abc', () => {
    expect(readTokenFromHash('#token=abc')).toBe('abc');
  });

  it.each([[''], ['#'], ['#x=1'], ['#token='], ['#otro=1&token=abc']])('%j → null', (hash) => {
    expect(readTokenFromHash(hash)).toBeNull();
  });

  it('rechaza un token de más de 200 caracteres y acepta uno de exactamente 200', () => {
    expect(readTokenFromHash(`#token=${'a'.repeat(201)}`)).toBeNull();
    expect(readTokenFromHash(`#token=${'a'.repeat(200)}`)).toBe('a'.repeat(200));
  });
});

describe('token en memoria', () => {
  it('se guarda, se lee y se borra sin tocar el almacenamiento del navegador', () => {
    expect(getInvitationToken()).toBeNull();
    setInvitationToken('abc');
    expect(getInvitationToken()).toBe('abc');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    setInvitationToken(null);
    expect(getInvitationToken()).toBeNull();
  });
});
