import { z } from 'zod';

export type SignInResult = { kind: 'session' } | { kind: 'two-factor' };
export type EnableTwoFactorResult = { totpURI: string; backupCodes: string[] };

/**
 * Respuesta de `sign-in/email`: o pide segundo factor, o crea la sesión. En el segundo
 * caso Better Auth incluye un `token` en el cuerpo: aquí se descarta a propósito (la
 * sesión vive en la cookie httpOnly y el front no guarda ni expone tokens).
 */
export const signInResponseSchema: z.ZodType<SignInResult> = z.union([
  z.object({ twoFactorRedirect: z.literal(true) }).transform((): SignInResult => ({
    kind: 'two-factor',
  })),
  z
    .object({})
    .loose()
    .transform((): SignInResult => ({ kind: 'session' })),
]);

export const enableTwoFactorResponseSchema: z.ZodType<EnableTwoFactorResult> = z
  .object({ totpURI: z.string().min(1), backupCodes: z.array(z.string()) })
  .transform(({ totpURI, backupCodes }) => ({ totpURI, backupCodes }));

/** Respuestas de las que solo importa que sean un objeto JSON. */
export const ignoredResponseSchema = z.object({}).loose();
