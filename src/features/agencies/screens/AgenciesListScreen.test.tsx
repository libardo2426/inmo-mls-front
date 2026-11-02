import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { agencySummaryFixture, meWithPermissions } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';
import { parseStatusFilter } from '../hooks/useAgencies';

const LIST_ME = meWithPermissions({ 'agency.list': 'network' });

function useMe(me = LIST_ME) {
  server.use(http.get('*/v1/me', () => HttpResponse.json(me)));
}

/** Registra el listado y devuelve las URLs pedidas. */
function useAgencies(respond: (url: URL) => Response) {
  const seen: URL[] = [];
  server.use(
    http.get('*/v1/agencies', ({ request }) => {
      const url = new URL(request.url);
      seen.push(url);
      return respond(url);
    }),
  );
  return seen;
}

describe('parseStatusFilter', () => {
  it.each([
    ['pending', 'pending'],
    ['all', 'all'],
    ['rejected', 'rejected'],
    ['basura', 'pending'],
    [undefined, 'pending'],
    [42, 'pending'],
  ])('%s → %s', (input, expected) => {
    expect(parseStatusFilter(input)).toBe(expected);
  });
});

describe('listado de agencias', () => {
  it('«Agencias» aparece en el menú solo con agency.list', async () => {
    useMe();
    useAgencies(() => HttpResponse.json({ items: [], nextCursor: null }));
    mountApp('/');
    const nav = await screen.findByRole('navigation', { name: es.shell.mainNav });
    expect(within(nav).getByRole('link', { name: es.nav.agencies })).toBeInTheDocument();
  });

  it('sin agency.list muestra «sin permiso» y no pide /v1/agencies', async () => {
    useMe(meWithPermissions({ 'agency.read': 'network' }));
    const seen = useAgencies(() => HttpResponse.json({ items: [], nextCursor: null }));
    mountApp('/agencias');
    expect(await screen.findByText(es.states.forbiddenTitle)).toBeInTheDocument();
    expect(seen).toHaveLength(0);
    expect(
      within(screen.getByRole('navigation', { name: es.shell.mainNav })).queryByRole('link', {
        name: es.nav.agencies,
      }),
    ).not.toBeInTheDocument();
  });

  it('tiene un único h1 con el título y el filtro accesible por su etiqueta', async () => {
    useMe();
    useAgencies(() => HttpResponse.json({ items: [], nextCursor: null }));
    mountApp('/agencias');
    await screen.findByText(es.agencies.list.emptyTitle);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: es.agencies.list.title })).toBeVisible();
    expect(screen.getByLabelText(es.agencies.list.filterLabel)).toBeVisible();
  });

  it('abre en pending con limit=50', async () => {
    useMe();
    const seen = useAgencies(() => HttpResponse.json({ items: [], nextCursor: null }));
    mountApp('/agencias');
    await screen.findByText(es.agencies.list.emptyTitle);
    expect(seen[0]?.searchParams.get('status')).toBe('pending');
    expect(seen[0]?.searchParams.get('limit')).toBe('50');
  });

  it('?status=basura se trata como pending', async () => {
    useMe();
    const seen = useAgencies(() => HttpResponse.json({ items: [], nextCursor: null }));
    mountApp('/agencias?status=basura');
    await screen.findByText(es.agencies.list.emptyTitle);
    expect(seen[0]?.searchParams.get('status')).toBe('pending');
  });

  it('cambiar a «Todos» pone status=all en la URL y no envía status', async () => {
    useMe();
    const seen = useAgencies(() => HttpResponse.json({ items: [], nextCursor: null }));
    const { history } = mountApp('/agencias');
    await screen.findByText(es.agencies.list.emptyTitle);
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: es.agencies.list.filterLabel }),
      es.agencies.list.filterAll,
    );
    await screen.findByText(es.agencies.list.emptyTitle);
    expect(history.location.search).toContain('status=all');
    expect(seen.at(-1)?.searchParams.has('status')).toBe(false);
  });

  it('muestra las columnas con documento, estado y fecha en es-CO', async () => {
    useMe();
    useAgencies(() => HttpResponse.json({ items: [agencySummaryFixture()], nextCursor: null }));
    mountApp('/agencias');
    await screen.findByText('Inmobiliaria Demo');
    const table = screen.getByRole('table', { name: es.agencies.list.caption });
    for (const header of Object.values(es.agencies.list.columns)) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    expect(within(table).getByText('Inmobiliaria Demo')).toBeInTheDocument();
    expect(within(table).getByText('Demo S.A.S.')).toBeInTheDocument();
    expect(within(table).getByText('NIT 900123456')).toBeInTheDocument();
    expect(within(table).getByText(es.agencies.status.pending)).toBeInTheDocument();
    expect(within(table).getByText('01/11/2026')).toBeInTheDocument();
  });

  it('«Cargar más» pide con el cursor, agrega filas y desaparece en la última página', async () => {
    useMe();
    const seen = useAgencies((url) =>
      url.searchParams.get('cursor') === 'c2'
        ? HttpResponse.json({
            items: [
              agencySummaryFixture({
                id: '0192a3b4-0000-7000-8000-00000000000b',
                tradeName: 'Segunda',
              }),
            ],
            nextCursor: null,
          })
        : HttpResponse.json({
            items: [
              agencySummaryFixture({
                id: '0192a3b4-0000-7000-8000-00000000000a',
                tradeName: 'Primera',
              }),
            ],
            nextCursor: 'c2',
          }),
    );
    mountApp('/agencias');
    await screen.findByText('Primera');
    await userEvent.click(screen.getByRole('button', { name: es.states.loadMore }));
    await screen.findByText('Segunda');
    expect(seen.at(-1)?.searchParams.get('cursor')).toBe('c2');
    expect(screen.getByText('Primera')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: es.states.loadMore })).not.toBeInTheDocument();
  });

  it('si «Cargar más» falla conserva las filas cargadas y reintenta solo esa página', async () => {
    useMe();
    let failNext = true;
    const seen = useAgencies((url) => {
      if (url.searchParams.get('cursor') === 'c2') {
        return failNext
          ? HttpResponse.json({ title: 'Falló', status: 500, code: 'internal' }, { status: 500 })
          : HttpResponse.json({
              items: [
                agencySummaryFixture({
                  id: '0192a3b4-0000-7000-8000-00000000000b',
                  tradeName: 'Segunda',
                }),
              ],
              nextCursor: null,
            });
      }
      return HttpResponse.json({
        items: [
          agencySummaryFixture({
            id: '0192a3b4-0000-7000-8000-00000000000a',
            tradeName: 'Primera',
          }),
        ],
        nextCursor: 'c2',
      });
    });
    mountApp('/agencias');
    await screen.findByText('Primera');
    await userEvent.click(screen.getByRole('button', { name: es.states.loadMore }));
    const alert = await screen.findByRole('alert');
    expect(screen.getByText('Primera')).toBeInTheDocument();
    failNext = false;
    const firstPageCalls = seen.filter((u) => !u.searchParams.has('cursor')).length;
    await userEvent.click(within(alert).getByRole('button', { name: es.states.retry }));
    await screen.findByText('Segunda');
    expect(screen.getByText('Primera')).toBeInTheDocument();
    expect(seen.filter((u) => !u.searchParams.has('cursor')).length).toBe(firstPageCalls);
  });

  it('lista vacía muestra el EmptyState', async () => {
    useMe();
    useAgencies(() => HttpResponse.json({ items: [], nextCursor: null }));
    mountApp('/agencias');
    expect(await screen.findByRole('heading', { name: es.agencies.list.emptyTitle })).toBeVisible();
  });

  it('un 500 muestra el ErrorState con Reintentar', async () => {
    useMe();
    let fail = true;
    useAgencies(() =>
      fail
        ? HttpResponse.json({ title: 'Falló', status: 500, code: 'internal' }, { status: 500 })
        : HttpResponse.json({ items: [], nextCursor: null }),
    );
    mountApp('/agencias');
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Falló')).toBeInTheDocument();
    fail = false;
    await userEvent.click(within(alert).getByRole('button', { name: es.states.retry }));
    await screen.findByText(es.agencies.list.emptyTitle);
  });

  it('clic en una fila navega a /agencias/{id}', async () => {
    useMe();
    useAgencies(() => HttpResponse.json({ items: [agencySummaryFixture()], nextCursor: null }));
    const { history } = mountApp('/agencias');
    await userEvent.click(await screen.findByText('Inmobiliaria Demo'));
    expect(history.location.pathname).toBe(`/agencias/${agencySummaryFixture().id}`);
  });
});
