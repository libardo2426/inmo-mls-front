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

const PROPERTY_ID = '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5b01';
const AGENCY_ID = '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6c';

/** Un elemento de `GET /v1/properties` (sin esquema en OpenAPI: B-11). */
export function propertyListItemFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: PROPERTY_ID,
    uniqueIdentifier: '50C-1557984',
    propertyType: 'apartment',
    status: 'active',
    territorialUnitCode: '05001',
    address: 'Calle 1 # 2-3',
    editorAgencyId: AGENCY_ID,
    createdAt: '2026-10-31T16:11:16.000Z',
    ...overrides,
  };
}

/** `GET /v1/properties/{id}` válido contra el esquema generado. */
export function propertyDetailFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: PROPERTY_ID,
    uniqueIdentifier: '50C-1557984',
    identifierLabel: 'Matrícula inmobiliaria',
    identifierStatus: 'definitive',
    propertyType: 'apartment',
    status: 'active',
    territorialUnitCode: '05001',
    address: 'Calle 1 # 2-3',
    addressVisibility: 'exact',
    location: { latitude: 6.2, longitude: -75.5 },
    builtArea: 85.5,
    landArea: null,
    areaUnit: 'm2',
    attributes: { bedrooms: 3, parking: true },
    features: ['Balcón'],
    description: 'Apartamento luminoso.',
    editor: { id: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5b02', name: 'Ana Pérez' },
    listPrices: [{ operation: 'sale', price: { amountMinor: '35000000000', currency: 'COP' } }],
    mandates: [
      {
        id: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5b03',
        agency: { id: AGENCY_ID, name: 'Inmobiliaria Demo' },
        operation: 'sale',
        type: 'exclusive',
        startDate: '2026-10-01',
        endDate: '2027-04-01',
        status: 'active',
        active: true,
        mine: false,
        visitInstructions: 'Llamar antes',
        memberNotes: 'Nota interna',
        allowedActions: { terminate: false, updatePrivateTerms: false },
      },
    ],
    history: [
      {
        field: 'list_price',
        oldValue: { amountMinor: '30000000000', currency: 'COP' },
        newValue: { amountMinor: '35000000000', currency: 'COP' },
        agencyId: AGENCY_ID,
        userId: null,
        changedAt: '2026-10-20T10:00:00.000Z',
      },
      {
        field: 'status',
        oldValue: 'draft',
        newValue: 'active',
        agencyId: AGENCY_ID,
        userId: null,
        changedAt: '2026-10-21T10:00:00.000Z',
      },
    ],
    media: {
      photos: [],
      floorPlans: [],
      links: [],
      photoRequirement: { min: 6, current: 0, met: false },
      pending: [],
    },
    documents: [
      {
        id: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5b04',
        kind: 'deed',
        mandateId: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5b03',
        visibility: 'agency',
        fileName: 'escritura.pdf',
        contentType: 'application/pdf',
        size: 120000,
        agencyId: AGENCY_ID,
        mine: false,
        createdAt: '2026-10-05T10:00:00.000Z',
        allowedActions: { remove: false },
      },
    ],
    allowedActions: {
      update: false,
      manageMedia: false,
      manageDocuments: false,
      linkMandate: false,
      setListPrice: { sale: false, lease: false },
    },
    ...overrides,
  };
}
