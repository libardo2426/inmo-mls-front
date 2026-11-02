/** Extrae la clave (parámetro `secret`) de una URI `otpauth://` para mostrarla en texto. */
export function secretFromTotpUri(uri: string): string | null {
  try {
    const secret = new URL(uri).searchParams.get('secret');
    return secret ? secret : null;
  } catch {
    return null;
  }
}
