import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { agencySummaryFixture, meWithPermissions, propertyListItemFixture } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

const AGENCY_ID = '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6c';
const READER = meWithPermissions({ 'property.read': 'network', 'agency.list': 'network' });

function useMe(me = READER) {
  server.use(http.get('*/v1/me', () => HttpResponse.json(me)));
}

function useProperties(respond: (url: URL) => Response) {
  const seen: URL[] = [];
  server.use(
    http.get('*/v1/properties', ({ request }) => {
      const url = new URL(request.url);
      seen.push(url);
      return respond(url);
    }),
  );
  return seen;
}

function useAgencies(respond: () => Response = () => agenciesOk()) {
  server.use(http.get('*/v1/agencies', respond));
}

const agenciesOk = () =>
  HttpResponse.json({
    items: [
      agencySummaryFixture({ id: AGENCY_ID, tradeName: 'Inmobiliaria Demo', status: 'active' }),
      agencySummaryFixture({
        id: '0192a3b4-0000-7000-8000-0000000000aa',
        tradeName: 'Agencia Suspendida',
        status: 'suspended',
      }),
    ],
    nextCursor: null,
  });

const empty = () => HttpResponse.json({ items: [], nextCursor: null });

function useTerritory() {
  server.use(
    http.get('*/v1/territory/units/co/:level', () =>
      HttpResponse.json({ items: [], nextCursor: null }),
    ),
  );
}

describe('listado de inmuebles', () => {
  it('lista el inmueble con sus celdas y un enlace a la ficha', async () => {
    useMe();
    useAgencies();
    useTerritory();
    const item = propertyListItemFixture();
    useProperties(() => HttpResponse.json({ items: [item], nextCursor: null }));
    mountApp('/inmuebles');
    const link = await screen.findByRole('link', { name: '50C-1557984' });
    expect(link).toHaveAttribute('href', expect.stringContaining(`/inmuebles/${item.id}`));
    const row = link.closest('tr') as HTMLElement;
    expect(within(row).getByText(es.properties.types.apartment)).toBeInTheDocument();
    expect(within(row).getByText(es.properties.status.active)).toBeInTheDocument();
    expect(within(row).getByText('Calle 1 # 2-3')).toBeInTheDocument();
    expect(await within(row).findByText('Inmobiliaria Demo')).toBeInTheDocument();
    expect(within(row).getByText('31/10/2026')).toBeInTheDocument();
  });

  it('abre sin filtros y con limit=50', async () => {
    useMe();
    useAgencies();
    const seen = useProperties(empty);
    mountApp('/inmuebles');
    await screen.findByText(es.properties.list.emptyTitle);
    expect(seen[0]?.searchParams.get('limit')).toBe('50');
    for (const key of ['propertyType', 'status', 'territorialUnitCode', 'agencyId']) {
      expect(seen[0]?.searchParams.has(key)).toBe(false);
    }
  });

  it('descarta los filtros inválidos de la URL y envía los válidos', async () => {
    useMe();
    useAgencies();
    const seen = useProperties(empty);
    mountApp('/inmuebles?type=raro&status=raro&agency=x&territory=05001');
    await screen.findByText(es.properties.list.emptyTitle);
    const q = seen[0]?.searchParams;
    expect(q?.has('propertyType')).toBe(false);
    expect(q?.has('status')).toBe(false);
    expect(q?.has('agencyId')).toBe(false);
    expect(q?.get('territorialUnitCode')).toBe('05001');
  });

  it('elegir tipo, estado y agencia cambia la URL y la petición', async () => {
    useMe();
    useAgencies();
    const seen = useProperties(empty);
    const { history } = mountApp('/inmuebles');
    await screen.findByText(es.properties.list.emptyTitle);
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: es.properties.filters.type }),
      es.properties.types.house,
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: es.properties.filters.status }),
      es.properties.status.active,
    );
    await screen.findByRole('option', { name: 'Inmobiliaria Demo' });
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: es.properties.filters.agency }),
      'Inmobiliaria Demo',
    );
    await screen.findByText(es.properties.list.emptyTitle);
    expect(history.location.search).toContain('type=house');
    expect(history.location.search).toContain('status=active');
    expect(history.location.search).toContain(`agency=${AGENCY_ID}`);
    const q = seen.at(-1)?.searchParams;
    expect(q?.get('propertyType')).toBe('house');
    expect(q?.get('status')).toBe('active');
    expect(q?.get('agencyId')).toBe(AGENCY_ID);
  });

  it('el selector de agencia ofrece solo las activas', async () => {
    useMe();
    useAgencies();
    useProperties(empty);
    mountApp('/inmuebles');
    await screen.findByRole('option', { name: 'Inmobiliaria Demo' });
    expect(screen.queryByRole('option', { name: 'Agencia Suspendida' })).not.toBeInTheDocument();
  });

  it('«Cargar más» pide la siguiente página con cursor', async () => {
    useMe();
    useAgencies();
    useTerritory();
    const seen = useProperties((url) =>
      url.searchParams.get('cursor') === 'c2'
        ? HttpResponse.json({
            items: [
              propertyListItemFixture({
                id: '0192a3b4-0000-7000-8000-00000000000b',
                uniqueIdentifier: 'SEGUNDA-2',
              }),
            ],
            nextCursor: null,
          })
        : HttpResponse.json({
            items: [propertyListItemFixture({ uniqueIdentifier: 'PRIMERA-1' })],
            nextCursor: 'c2',
          }),
    );
    mountApp('/inmuebles');
    await screen.findByText('PRIMERA-1');
    await userEvent.click(screen.getByRole('button', { name: es.states.loadMore }));
    await screen.findByText('SEGUNDA-2');
    expect(seen.at(-1)?.searchParams.get('cursor')).toBe('c2');
    expect(screen.getByText('PRIMERA-1')).toBeInTheDocument();
  });

  it('una agencia fuera de la lista muestra texto neutro', async () => {
    useMe();
    useAgencies();
    useTerritory();
    useProperties(() =>
      HttpResponse.json({
        items: [
          propertyListItemFixture({ editorAgencyId: '0192a3b4-0000-7000-8000-0000000000ff' }),
        ],
        nextCursor: null,
      }),
    );
    mountApp('/inmuebles');
    expect(await screen.findByText(es.properties.unknownAgency)).toBeInTheDocument();
  });

  it('si /v1/agencies falla, el listado sigue y el selector queda deshabilitado', async () => {
    useMe();
    useAgencies(() =>
      HttpResponse.json({ title: 'x', status: 500, code: 'internal' }, { status: 500 }),
    );
    useTerritory();
    useProperties(() =>
      HttpResponse.json({ items: [propertyListItemFixture()], nextCursor: null }),
    );
    mountApp('/inmuebles');
    expect(await screen.findByRole('link', { name: '50C-1557984' })).toBeVisible();
    expect(await screen.findByText(es.properties.unknownAgency)).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: es.properties.filters.agency })).toBeDisabled(),
    );
  });

  it('un estado y un tipo desconocidos se muestran crudos', async () => {
    useMe();
    useAgencies();
    useTerritory();
    useProperties(() =>
      HttpResponse.json({
        items: [propertyListItemFixture({ status: 'raro', propertyType: 'castillo' })],
        nextCursor: null,
      }),
    );
    mountApp('/inmuebles');
    expect(await screen.findByText('raro')).toBeVisible();
    expect(screen.getByText('castillo')).toBeVisible();
  });

  it('un 500 muestra el error con Reintentar y vuelve a pedir', async () => {
    useMe();
    useAgencies();
    let fail = true;
    useProperties(() =>
      fail
        ? HttpResponse.json({ title: 'Falló', status: 500, code: 'internal' }, { status: 500 })
        : empty(),
    );
    mountApp('/inmuebles');
    const alert = await screen.findByRole('alert');
    fail = false;
    await userEvent.click(within(alert).getByRole('button', { name: es.states.retry }));
    await screen.findByText(es.properties.list.emptyTitle);
  });

  it('la lista vacía muestra el estado vacío', async () => {
    useMe();
    useAgencies();
    useProperties(empty);
    mountApp('/inmuebles');
    expect(
      await screen.findByRole('heading', { name: es.properties.list.emptyTitle }),
    ).toBeVisible();
  });

  it('con property.read el menú tiene «Inmuebles» y la página un único h1', async () => {
    useMe();
    useAgencies();
    useProperties(empty);
    mountApp('/inmuebles');
    await screen.findByText(es.properties.list.emptyTitle);
    expect(screen.getByRole('link', { name: es.nav.properties })).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('sin property.read la ruta muestra sin acceso y el menú no tiene «Inmuebles»', async () => {
    useMe(meWithPermissions({ 'agency.list': 'network' }));
    mountApp('/inmuebles');
    expect(await screen.findByText(es.states.forbiddenTitle)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: es.nav.properties })).not.toBeInTheDocument();
  });
});
