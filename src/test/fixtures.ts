import meJson from '@/lib/api/__fixtures__/me.json';
import type { MeResponse } from '@/lib/api/schemas';

/** `GET /v1/me` de un admin MLS con 2FA activo; `overrides` reemplaza campos de primer nivel. */
export function meFixture(overrides: Partial<MeResponse> = {}): MeResponse {
  const base = meJson as MeResponse;
  return {
    ...base,
    user: { ...base.user, email: 'admin@innmo.test', name: 'Admin Demo', twoFactorEnabled: true },
    membership: {
      role: 'admin',
      agencyId: null,
      agencyStatus: null,
      permissions: { 'agency.read': 'network' },
      twoFactorRequired: true,
    },
    ...overrides,
  };
}
