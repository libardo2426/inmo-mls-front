import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import { loadConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';
import { PermissionsProvider } from '@/lib/permissions';
import { meFixture } from '@/test/fixtures';
import { validConfig } from '@/test/mount';
import { server } from '@/test/server';
import { fetchTerritoryUnits, MAX_CODES } from './territory-api';
import { useTerritoryName } from './useTerritoryName';

const origin = 'http://localhost:3000';
const config = loadConfig({ __APP_CONFIG__: validConfig });
const client = createHttpClient({ config, origin });

const unit = (code: string, name: string, level: string, parentCode: string | null) => ({
  code,
  name,
  level,
  parentCode,
});
const MEDELLIN = unit('05001', 'Medellín', 'municipality', '05');
const ANTIOQUIA = unit('05', 'Antioquia', 'department', null);

function page(items: unknown[]) {
  return HttpResponse.json({ items, nextCursor: null });
}

function renderName(code: string | undefined) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Providers config={config} queryClient={createQueryClient()} http={client}>
      <PermissionsProvider me={meFixture()}>{children}</PermissionsProvider>
    </Providers>
  );
  return renderHook(() => useTerritoryName(code), { wrapper });
}

describe('fetchTerritoryUnits', () => {
  it('envía codes y limit=100, y no envía q', async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${origin}/v1/territory/units/co/municipality`, ({ request }) => {
        url = new URL(request.url);
        return page([MEDELLIN]);
      }),
    );
    const map = await fetchTerritoryUnits(client, 'co', 'municipality', ['05001', '11001']);
    expect(url?.searchParams.get('codes')).toBe('05001,11001');
    expect(url?.searchParams.get('limit')).toBe('100');
    expect(url?.searchParams.has('q')).toBe(false);
    expect(map.get('05001')?.name).toBe('Medellín');
  });

  it('deduplica y recorta a MAX_CODES códigos', async () => {
    let codes = '';
    server.use(
      http.get(`${origin}/v1/territory/units/co/municipality`, ({ request }) => {
        codes = new URL(request.url).searchParams.get('codes') ?? '';
        return page([]);
      }),
    );
    const many = Array.from({ length: 150 }, (_, i) => String(10000 + i));
    await fetchTerritoryUnits(client, 'co', 'municipality', ['10000', '10000', ...many]);
    const sent = codes.split(',');
    expect(sent).toHaveLength(MAX_CODES);
    expect(new Set(sent).size).toBe(MAX_CODES);
  });

  it('sin códigos no hace ninguna petición', async () => {
    const map = await fetchTerritoryUnits(client, 'co', 'municipality', []);
    expect(map.size).toBe(0);
  });

  it('solo conserva las unidades pedidas (backend sin el filtro)', async () => {
    server.use(
      http.get(`${origin}/v1/territory/units/co/municipality`, () =>
        page([
          unit('99999', 'Otro', 'municipality', '99'),
          unit('88888', 'Más', 'municipality', '88'),
        ]),
      ),
    );
    const map = await fetchTerritoryUnits(client, 'co', 'municipality', ['05001']);
    expect(map.size).toBe(0);
  });
});

describe('useTerritoryName', () => {
  it('«Municipio, Departamento»: pide el municipio y luego el departamento con su parentCode', async () => {
    const order: string[] = [];
    server.use(
      http.get(`${origin}/v1/territory/units/co/municipality`, () => {
        order.push('municipality');
        return page([MEDELLIN]);
      }),
      http.get(`${origin}/v1/territory/units/co/department`, ({ request }) => {
        order.push(`department:${new URL(request.url).searchParams.get('codes')}`);
        return page([ANTIOQUIA]);
      }),
    );
    const { result } = renderName('05001');
    await waitFor(() => expect(result.current.label).toBe('Medellín, Antioquia'));
    expect(order).toEqual(['municipality', 'department:05']);
    expect(result.current.isLoading).toBe(false);
  });

  it('departamento caído ⇒ solo el municipio', async () => {
    server.use(
      http.get(`${origin}/v1/territory/units/co/municipality`, () => page([MEDELLIN])),
      http.get(`${origin}/v1/territory/units/co/department`, () =>
        HttpResponse.json({ title: 'x' }, { status: 500 }),
      ),
    );
    const { result } = renderName('05001');
    await waitFor(() => expect(result.current.label).toBe('Medellín'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it.each([500, 400])(
    'municipio con %s ⇒ el label es el código y termina de cargar',
    async (status) => {
      server.use(
        http.get(`${origin}/v1/territory/units/co/municipality`, () =>
          HttpResponse.json({ title: 'x' }, { status }),
        ),
      );
      const { result } = renderName('05001');
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.label).toBe('05001');
    },
  );

  it('código desconocido (ausente en la respuesta) ⇒ el label es el código', async () => {
    server.use(http.get(`${origin}/v1/territory/units/co/municipality`, () => page([])));
    const { result } = renderName('05001');
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.label).toBe('05001');
  });

  it('un backend sin el filtro (primera página sin filtrar) no se toma por la respuesta', async () => {
    server.use(
      http.get(`${origin}/v1/territory/units/co/municipality`, () =>
        page([unit('99999', 'Equivocado', 'municipality', '99')]),
      ),
    );
    const { result } = renderName('05001');
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.label).toBe('05001');
  });

  it('code undefined ⇒ label vacío y ninguna petición', () => {
    let calls = 0;
    server.use(
      http.get(`${origin}/v1/territory/units/co/municipality`, () => {
        calls += 1;
        return page([]);
      }),
    );
    const { result } = renderName(undefined);
    expect(result.current).toEqual({ label: '', isLoading: false });
    expect(calls).toBe(0);
  });
});
