import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { createHttpClient, ValidationError } from '@/lib/http';
import { propertyDetailFixture, propertyListItemFixture } from '@/test/fixtures';
import { server } from '@/test/server';
import { createPropertiesApi } from './properties-api';

const origin = 'http://localhost:3000';
const config = { API_BASE_PATH: '/v1', PLATFORM_API_BASE_PATH: '/plataforma/v1' };
const api = createPropertiesApi(createHttpClient({ config, origin }));
const AGENCY = '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6c';

describe('list', () => {
  it('traduce los filtros a los parámetros del backend y omite los ausentes', async () => {
    const seen: URL[] = [];
    server.use(
      http.get(`${origin}/v1/properties`, ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json({ items: [propertyListItemFixture()], nextCursor: 'c2' });
      }),
    );
    const page = await api.list({
      type: 'house',
      status: 'active',
      territory: '05001',
      agency: AGENCY,
      limit: 50,
      cursor: 'c1',
    });
    expect(page.nextCursor).toBe('c2');
    const q = seen[0]?.searchParams;
    expect(q?.get('propertyType')).toBe('house');
    expect(q?.get('status')).toBe('active');
    expect(q?.get('territorialUnitCode')).toBe('05001');
    expect(q?.get('agencyId')).toBe(AGENCY);
    expect(q?.get('limit')).toBe('50');
    expect(q?.get('cursor')).toBe('c1');
    await api.list({ limit: 50 });
    for (const key of ['propertyType', 'status', 'territorialUnitCode', 'agencyId', 'cursor']) {
      expect(seen[1]?.searchParams.has(key)).toBe(false);
    }
  });

  it('una respuesta inválida lanza ValidationError', async () => {
    server.use(http.get(`${origin}/v1/properties`, () => HttpResponse.json({ items: 'mal' })));
    await expect(api.list({})).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('get', () => {
  it('pide /properties/{id} y parsea con el esquema generado', async () => {
    const detail = propertyDetailFixture();
    server.use(http.get(`${origin}/v1/properties/${detail.id}`, () => HttpResponse.json(detail)));
    const result = await api.get(detail.id);
    expect(result.uniqueIdentifier).toBe('50C-1557984');
    expect(result.listPrices[0]?.price.amountMinor).toBe('35000000000');
  });
});
