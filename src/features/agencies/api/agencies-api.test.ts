import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, createHttpClient, ValidationError } from '@/lib/http';
import { server } from '@/test/server';
import { createAgenciesApi } from './agencies-api';

const origin = 'http://localhost:3000';
const config = { API_BASE_PATH: '/v1', PLATFORM_API_BASE_PATH: '/plataforma/v1' };
const api = createAgenciesApi(createHttpClient({ config, origin }));

const ID = '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6c';
const summary = {
  id: ID,
  tradeName: 'Demo',
  legalName: 'Demo S.A.S.',
  taxIdType: 'NIT',
  taxId: '900123456',
  status: 'pending',
  submittedAt: '2026-11-01T10:00:00.000Z',
};

describe('list', () => {
  it('envía status y limit, y no envía status si es undefined', async () => {
    const seen: URL[] = [];
    server.use(
      http.get(`${origin}/v1/agencies`, ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json({ items: [summary], nextCursor: 'c2' });
      }),
    );
    const page = await api.list({ status: 'pending', limit: 50, cursor: 'c1' });
    expect(page.nextCursor).toBe('c2');
    expect(seen[0]?.searchParams.get('status')).toBe('pending');
    expect(seen[0]?.searchParams.get('limit')).toBe('50');
    expect(seen[0]?.searchParams.get('cursor')).toBe('c1');
    await api.list({ limit: 50 });
    expect(seen[1]?.searchParams.has('status')).toBe(false);
  });

  it('una respuesta que no cumple el esquema lanza ValidationError', async () => {
    server.use(http.get(`${origin}/v1/agencies`, () => HttpResponse.json({ items: 'mal' })));
    await expect(api.list()).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('get', () => {
  it('pide /agencies/{id}', async () => {
    const detail = {
      ...summary,
      email: null,
      phone: null,
      attributes: {},
      reviewReason: null,
      reviewedAt: null,
      approvedAt: null,
      mainOffice: {
        id: ID,
        name: 'Principal',
        territorialUnitCode: '05001',
        address: null,
        phone: null,
      },
    };
    server.use(http.get(`${origin}/v1/agencies/${ID}`, () => HttpResponse.json(detail)));
    const agency = await api.get(ID);
    expect(agency.mainOffice.territorialUnitCode).toBe('05001');
  });

  it('un 404 llega como ApiError con su code', async () => {
    server.use(
      http.get(`${origin}/v1/agencies/${ID}`, () =>
        HttpResponse.json(
          { title: 'No existe', status: 404, code: 'agency_not_found' },
          { status: 404, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    await expect(api.get(ID)).rejects.toMatchObject({ code: 'agency_not_found' });
    await expect(api.get(ID)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('acciones de revisión', () => {
  it('approve hace POST /agencies/{id}/approve y acepta 204 sin cuerpo', async () => {
    let method = '';
    server.use(
      http.post(`${origin}/v1/agencies/${ID}/approve`, ({ request }) => {
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await expect(api.approve(ID)).resolves.toBeUndefined();
    expect(method).toBe('POST');
  });

  it.each([
    ['requestChanges', 'request-changes'],
    ['reject', 'reject'],
  ] as const)('%s envía {reason}', async (method, path) => {
    let body: unknown;
    server.use(
      http.post(`${origin}/v1/agencies/${ID}/${path}`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await api[method](ID, 'Falta el RUT');
    expect(body).toEqual({ reason: 'Falta el RUT' });
  });
});
