const MAX_TOKEN_LENGTH = 200;

/** Token de la invitación: solo en memoria, nunca en el almacenamiento del navegador (ADR-0003). */
let current: string | null = null;

/** Extrae el token de un fragmento `#token=abc`; cualquier otra forma es inválida. */
export function readTokenFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  if ([...params.keys()].join() !== 'token') return null;
  const token = params.get('token');
  return token && token.length <= MAX_TOKEN_LENGTH ? token : null;
}

export function setInvitationToken(token: string | null): void {
  current = token;
}

export function getInvitationToken(): string | null {
  return current;
}
