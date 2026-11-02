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

/** `GET /v1/me` de personal del MLS con exactamente estos permisos de red. */
export function meWithPermissions(
  permissions: Record<string, 'own' | 'agency' | 'network'>,
): MeResponse {
  const me = meFixture();
  if (!me.membership) throw new Error('la fixture debe traer membresía');
  return { ...me, membership: { ...me.membership, permissions } };
}

/** Un elemento de `GET /v1/agencies`. */
export function agencySummaryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6c',
    tradeName: 'Inmobiliaria Demo',
    legalName: 'Demo S.A.S.',
    taxIdType: 'NIT',
    taxId: '900123456',
    status: 'pending',
    submittedAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

/** `GET /v1/agencies/{id}`. */
export function agencyDetailFixture(overrides: Record<string, unknown> = {}) {
  const { id, tradeName, legalName, taxIdType, taxId, status, submittedAt } =
    agencySummaryFixture();
  return {
    id,
    tradeName,
    legalName,
    taxIdType,
    taxId,
    status,
    submittedAt,
    email: 'contacto@demo.test',
    phone: '3001234567',
    attributes: {},
    reviewReason: null,
    reviewedAt: null,
    approvedAt: null,
    mainOffice: {
      id: '0192a3b4-0000-7000-8000-0000000000f1',
      name: 'Sede principal',
      territorialUnitCode: '05001',
      address: 'Calle 1 # 2-3',
      phone: null,
    },
    ...overrides,
  };
}

/** Un elemento de `GET /v1/agencies/{id}/members`. */
export function memberFixture(overrides: Record<string, unknown> = {}) {
  return {
    memberId: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a70',
    userId: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a71',
    fullName: 'Luis Demo',
    email: 'luis@demo.test',
    role: 'agent',
    officeId: null,
    status: 'active',
    since: '2026-10-01T12:00:00.000Z',
    ...overrides,
  };
}
