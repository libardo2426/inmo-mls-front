import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { es } from '@/lib/i18n/es';
import { agencyDetailFixture, meWithPermissions } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

const ID = agencyDetailFixture().id;
const PATH = `/agencias/${ID}`;
const LIST_ME = meWithPermissions({ 'agency.list': 'network' });

function useMe(me = LIST_ME) {
  server.use(http.get('*/v1/me', () => HttpResponse.json(me)));
}
function useDetail(detail: object = agencyDetailFixture()) {
  server.use(http.get(`*/v1/agencies/${ID}`, () => HttpResponse.json(detail)));
}
function useTerritory(
  municipality: () => Response = () =>
    HttpResponse.json({
      items: [{ code: '05001', name: 'Medellín', level: 'municipality', parentCode: '05' }],
      nextCursor: null,
    }),
  department: () => Response = () =>
    HttpResponse.json({
      items: [{ code: '05', name: 'Antioquia', level: 'department', parentCode: null }],
      nextCursor: null,
    }),
) {
  server.use(
    http.get('*/v1/territory/units/co/municipality', municipality),
    http.get('*/v1/territory/units/co/department', department),
  );
}

beforeEach(() => {
  useMe();
  useTerritory();
});

describe('detalle de agencia', () => {
  it('muestra los datos de la solicitud', async () => {
    useDetail();
    mountApp(PATH);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Inmobiliaria Demo' }),
    ).toBeVisible();
    for (const text of [
      'Demo S.A.S.',
      'NIT 900123456',
      'contacto@demo.test',
      '3001234567',
      es.agencies.status.pending,
      '01/11/2026',
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('muestra reviewReason y reviewedAt solo si existen', async () => {
    useDetail();
    const first = mountApp(PATH);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(es.agencies.detail.fields.reviewReason)).not.toBeInTheDocument();
    first.unmount();

    useDetail(
      agencyDetailFixture({
        status: 'changes_requested',
        reviewReason: 'Falta el RUT',
        reviewedAt: '2026-11-02T15:00:00.000Z',
      }),
    );
    mountApp(PATH);
    expect(await screen.findByText('Falta el RUT')).toBeInTheDocument();
    expect(screen.getByText(es.agencies.detail.fields.reviewedAt)).toBeInTheDocument();
    expect(screen.getByText('02/11/2026')).toBeInTheDocument();
  });

  it('muestra la sede con «Municipio, Departamento» resuelto', async () => {
    useDetail();
    mountApp(PATH);
    expect(await screen.findByText('Medellín, Antioquia')).toBeInTheDocument();
    expect(screen.getByText('Calle 1 # 2-3')).toBeInTheDocument();
  });

  it('si el territorio falla muestra el código y el resto del detalle sigue visible', async () => {
    useDetail();
    useTerritory(() => HttpResponse.json({ title: 'x' }, { status: 500 }));
    mountApp(PATH);
    expect(await screen.findByText('05001')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Inmobiliaria Demo' })).toBeVisible();
    expect(screen.getByText('Demo S.A.S.')).toBeInTheDocument();
  });

  it('404 agency_not_found muestra el texto propio sin romper el shell', async () => {
    server.use(
      http.get(`*/v1/agencies/${ID}`, () =>
        HttpResponse.json(
          { title: 'No existe', status: 404, code: 'agency_not_found' },
          { status: 404, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    mountApp(PATH);
    expect(await screen.findByText(es.agencies.errors.notFound)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: es.shell.mainNav })).toBeInTheDocument();
  });

  it('mientras carga muestra un estado de carga', async () => {
    server.use(http.get(`*/v1/agencies/${ID}`, () => new Promise<Response>(() => undefined)));
    mountApp(PATH);
    expect(await screen.findByRole('status', { name: es.states.loading })).toBeInTheDocument();
  });

  it('sin agency.list muestra «sin permiso»', async () => {
    useMe(meWithPermissions({ 'agency.read': 'network' }));
    useDetail();
    mountApp(PATH);
    expect(await screen.findByText(es.states.forbiddenTitle)).toBeInTheDocument();
  });

  it('con solo agency.list (compliance) no hay ningún botón de acción', async () => {
    useDetail();
    mountApp(PATH);
    await screen.findByRole('heading', { level: 1, name: 'Inmobiliaria Demo' });
    const main = screen.getByRole('main');
    const header = screen.getByRole('banner');
    const screenButtons = within(main)
      .queryAllByRole('button')
      .filter((button) => !header.contains(button));
    expect(screenButtons).toHaveLength(0);
    expect(within(main).getByRole('link', { name: es.agencies.detail.back })).toBeInTheDocument();
  });

  it('«Volver al listado» conserva el filtro de la URL', async () => {
    useDetail();
    mountApp(`${PATH}?status=rejected`);
    const back = await screen.findByRole('link', { name: es.agencies.detail.back });
    expect(back).toHaveAttribute('href', expect.stringContaining('status=rejected'));
  });
});

const REVIEWER_ME = meWithPermissions({
  'agency.list': 'network',
  'agency.approve': 'network',
  'agency.request_changes': 'network',
  'agency.reject': 'network',
});

describe('acciones de revisión en el detalle', () => {
  beforeEach(() => useMe(REVIEWER_ME));

  const actionButton = (name: string) => screen.getByRole('button', { name });

  it('con permisos y estado pending aparecen los tres botones', async () => {
    useDetail();
    mountApp(PATH);
    await screen.findByRole('heading', { level: 1, name: 'Inmobiliaria Demo' });
    for (const label of Object.values(es.agencies.review.actions)) {
      expect(actionButton(label)).toBeEnabled();
    }
  });

  it.each(['changes_requested', 'active', 'rejected'])(
    'con estado %s no aparece ninguno',
    async (status) => {
      useDetail(agencyDetailFixture({ status }));
      mountApp(PATH);
      await screen.findByRole('heading', { level: 1, name: 'Inmobiliaria Demo' });
      for (const label of Object.values(es.agencies.review.actions)) {
        expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
      }
    },
  );

  it('tras aprobar vuelve al listado con el filtro y muestra el aviso de éxito', async () => {
    useDetail();
    server.use(
      http.post(`*/v1/agencies/${ID}/approve`, () => new HttpResponse(null, { status: 204 })),
      http.get('*/v1/agencies', () => HttpResponse.json({ items: [], nextCursor: null })),
    );
    const { history } = mountApp(`${PATH}?status=pending`);
    await screen.findByRole('heading', { level: 1, name: 'Inmobiliaria Demo' });
    await userEvent.click(actionButton(es.agencies.review.actions.approve));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: es.agencies.review.actions.approve }),
    );
    expect(await screen.findByText(es.agencies.review.done.approve)).toBeInTheDocument();
    expect(history.location.pathname).toBe('/agencias');
    expect(history.location.search).toContain('status=pending');
  });

  it('tras un 409 se queda en el detalle, lo recarga y avisa que otra persona la revisó', async () => {
    let detailCalls = 0;
    server.use(
      http.get(`*/v1/agencies/${ID}`, () => {
        detailCalls += 1;
        return HttpResponse.json(
          agencyDetailFixture({ status: detailCalls > 1 ? 'active' : 'pending' }),
        );
      }),
      http.post(`*/v1/agencies/${ID}/approve`, () =>
        HttpResponse.json(
          { title: 'x', status: 409, code: 'agency_not_reviewable' },
          { status: 409, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    const { history } = mountApp(PATH);
    await screen.findByRole('heading', { level: 1, name: 'Inmobiliaria Demo' });
    await userEvent.click(actionButton(es.agencies.review.actions.approve));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: es.agencies.review.actions.approve }),
    );
    expect(await screen.findByText(es.agencies.review.conflict)).toBeInTheDocument();
    expect(history.location.pathname).toBe(PATH);
    expect(detailCalls).toBeGreaterThan(1);
    expect(
      screen.queryByRole('button', { name: es.agencies.review.actions.approve }),
    ).not.toBeInTheDocument();
  });

  it('mientras una acción está en curso los botones del detalle están deshabilitados', async () => {
    useDetail();
    server.use(
      http.post(`*/v1/agencies/${ID}/approve`, () => new Promise<Response>(() => undefined)),
    );
    mountApp(PATH);
    await screen.findByRole('heading', { level: 1, name: 'Inmobiliaria Demo' });
    await userEvent.click(actionButton(es.agencies.review.actions.approve));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: es.agencies.review.actions.approve }),
    );
    await vi.waitFor(() =>
      expect(
        screen.getByRole('button', { name: es.agencies.review.actions.reject, hidden: true }),
      ).toBeDisabled(),
    );
  });
});
