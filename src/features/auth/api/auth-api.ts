import type { HttpClient } from '@/lib/http';
import {
  enableTwoFactorResponseSchema,
  ignoredResponseSchema,
  signInResponseSchema,
  type EnableTwoFactorResult,
  type SignInResult,
} from './schemas';

export type { EnableTwoFactorResult, SignInResult };

export type AuthApi = {
  signInEmail(input: { email: string; password: string }): Promise<SignInResult>;
  signUpEmail(input: { name: string; email: string; password: string }): Promise<void>;
  verifyTotp(code: string): Promise<void>;
  verifyBackupCode(code: string): Promise<void>;
  enableTwoFactor(password: string): Promise<EnableTwoFactorResult>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(input: { newPassword: string; token: string }): Promise<void>;
};

/** Cliente de las rutas de Better Auth (`/v1/auth/*`) sobre el cliente HTTP único. */
export function createAuthApi(http: HttpClient): AuthApi {
  const post = <S extends typeof ignoredResponseSchema>(path: string, body: unknown, schema: S) =>
    http.request({ host: 'country', path: `/auth${path}`, method: 'POST', body, schema });

  return {
    signInEmail: (input) =>
      http.request({
        host: 'country',
        path: '/auth/sign-in/email',
        method: 'POST',
        body: { email: input.email, password: input.password },
        schema: signInResponseSchema,
      }),
    signUpEmail: async ({ name, email, password }) => {
      await post('/sign-up/email', { name, email, password }, ignoredResponseSchema);
    },
    verifyTotp: async (code) => {
      await post('/two-factor/verify-totp', { code }, ignoredResponseSchema);
    },
    verifyBackupCode: async (code) => {
      await post('/two-factor/verify-backup-code', { code }, ignoredResponseSchema);
    },
    enableTwoFactor: (password) =>
      http.request({
        host: 'country',
        path: '/auth/two-factor/enable',
        method: 'POST',
        body: { password },
        schema: enableTwoFactorResponseSchema,
      }),
    signOut: async () => {
      await post('/sign-out', {}, ignoredResponseSchema);
    },
    requestPasswordReset: async (email) => {
      await post('/request-password-reset', { email }, ignoredResponseSchema);
    },
    resetPassword: async ({ newPassword, token }) => {
      await post('/reset-password', { newPassword, token }, ignoredResponseSchema);
    },
  };
}
