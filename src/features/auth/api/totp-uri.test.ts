import { describe, expect, it } from 'vitest';
import { secretFromTotpUri } from './totp-uri';

describe('secretFromTotpUri', () => {
  it('extrae el parámetro secret de una URI otpauth', () => {
    expect(
      secretFromTotpUri('otpauth://totp/Innmo%20MLS:a@b.co?secret=ABC123&issuer=Innmo%20MLS'),
    ).toBe('ABC123');
  });

  it('devuelve null si falta secret o el texto no es una URL', () => {
    expect(secretFromTotpUri('otpauth://totp/Innmo:a@b.co?issuer=Innmo')).toBeNull();
    expect(secretFromTotpUri('esto no es una uri')).toBeNull();
    expect(secretFromTotpUri('otpauth://totp/x?secret=')).toBeNull();
  });
});
