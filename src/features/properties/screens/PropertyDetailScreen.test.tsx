import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { agencySummaryFixture, meWithPermissions, propertyDetailFixture } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

const READER = meWithPermissions({ 'property.read': 'network', 'agency.list': 'network' });
const detail = propertyDetailFixture();
const ID = detail.id;
const AGENCY_ID = '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6c';

type Respond = () => Response;
function setup(respond: Respond = () => HttpResponse.json(detail)) {
  server.use(
    http.get('*/v1/me', () => HttpResponse.json(READER)),
    http.get(`*/v1/properties/${ID}`, respond),
    http.get('*/v1/agencies', () =>
      HttpResponse.json({
        items: [agencySummaryFixture({ id: AGENCY_ID, tradeName: 'Inmobiliaria Demo' })],
        nextCursor: null,
      }),
    ),
    http.get('*/v1/territory/units/co/:level', () =>
      HttpResponse.json({ items: [], nextCursor: null }),
    ),
  );
}

const region = (name: string) => screen.findByRole('region', { name });

describe('ficha del inmueble', () => {
  it('muestra datos, precios, encargos y documentos', async () => {
    setup();
    mountApp(`/inmuebles/${ID}`);
    expect(await screen.findByRole('heading', { level: 1, name: '50C-1557984' })).toBeVisible();
    const data = await region(es.properties.detail.sections.data);
    expect(within(data).getByText('Apartamento')).toBeInTheDocument();
    expect(within(data).getByText('Calle 1 # 2-3')).toBeInTheDocument();
    expect(within(data).getByText('Apartamento luminoso.')).toBeInTheDocument();
    expect(within(data).getByText('Ana Pérez')).toBeInTheDocument();
    expect(within(data).getByText(/bedrooms/)).toBeInTheDocument();
    const prices = await region(es.properties.detail.sections.prices);
    expect(within(prices).getByText(/350\.000\.000,00/)).toBeInTheDocument();
    const mandates = await region(es.properties.detail.sections.mandates);
    expect(within(mandates).getByText('Inmobiliaria Demo')).toBeInTheDocument();
    const docs = await region(es.properties.detail.sections.documents);
    expect(within(docs).getByText('escritura.pdf')).toBeInTheDocument();
    expect(within(docs).queryByRole('link')).not.toBeInTheDocument();
    expect(within(docs).queryByRole('button')).not.toBeInTheDocument();
  });

  it('el historial formatea cada campo y nombra la agencia', async () => {
    setup();
    mountApp(`/inmuebles/${ID}`);
    const history = await region(es.properties.detail.sections.history);
    expect(within(history).getAllByText(/350\.000\.000,00/).length).toBeGreaterThan(0);
    expect(within(history).getAllByText('Inmobiliaria Demo').length).toBeGreaterThan(0);
    expect(
      within(history).getByText(`${es.properties.status.draft} → ${es.properties.status.active}`),
    ).toBeInTheDocument();
    expect(history.textContent).not.toContain('[object Object]');
  });

  it('el historial tolera valores nulos o desconocidos', async () => {
    setup(() =>
      HttpResponse.json(
        propertyDetailFixture({
          history: [
            {
              field: 'editor',
              oldValue: null,
              newValue: { foo: 1 },
              agencyId: '0192a3b4-0000-7000-8000-0000000000ff',
              userId: null,
              changedAt: '2026-10-22T10:00:00.000Z',
            },
          ],
        }),
      ),
    );
    mountApp(`/inmuebles/${ID}`);
    const history = await region(es.properties.detail.sections.history);
    expect(history.textContent).not.toContain('[object Object]');
    expect(within(history).getByText(es.properties.unknownAgency)).toBeInTheDocument();
  });

  it('no muestra notas de visita, notas de miembros, coordenadas ni condiciones privadas', async () => {
    setup(() =>
      HttpResponse.json(
        propertyDetailFixture({
          mandates: [
            {
              ...detail.mandates[0],
              privateTerms: {
                currency: 'COP',
                netPrice: { amountMinor: '1', currency: 'COP' },
                minPrice: null,
                commission: null,
                ownerContact: { name: 'Dueño Secreto' },
              },
            },
          ],
        }),
      ),
    );
    mountApp(`/inmuebles/${ID}`);
    await screen.findByRole('heading', { level: 1, name: '50C-1557984' });
    const text = document.body.textContent ?? '';
    for (const hidden of ['Llamar antes', 'Nota interna', 'Dueño Secreto', '6.2', '-75.5']) {
      expect(text).not.toContain(hidden);
    }
  });

  it('el 404 muestra que el inmueble no existe', async () => {
    setup(() =>
      HttpResponse.json(
        { title: 'No existe', status: 404, code: 'property_not_found' },
        { status: 404, headers: { 'content-type': 'application/problem+json' } },
      ),
    );
    mountApp(`/inmuebles/${ID}`);
    expect(await screen.findByText(es.properties.detail.notFound)).toBeVisible();
  });

  it('un 403 muestra el estado sin acceso', async () => {
    setup(() =>
      HttpResponse.json(
        { title: 'Prohibido', status: 403, code: 'forbidden' },
        { status: 403, headers: { 'content-type': 'application/problem+json' } },
      ),
    );
    mountApp(`/inmuebles/${ID}`);
    expect(await screen.findByText(es.states.forbiddenTitle)).toBeVisible();
  });

  it('un 500 muestra el error y Reintentar vuelve a pedir', async () => {
    let fail = true;
    setup(() =>
      fail
        ? HttpResponse.json({ title: 'Falló', status: 500, code: 'internal' }, { status: 500 })
        : HttpResponse.json(detail),
    );
    mountApp(`/inmuebles/${ID}`);
    const alert = await screen.findByRole('alert');
    fail = false;
    await userEvent.click(within(alert).getByRole('button', { name: es.states.retry }));
    expect(await screen.findByRole('heading', { level: 1, name: '50C-1557984' })).toBeVisible();
  });

  it('el enlace «Volver» conserva los filtros', async () => {
    setup();
    mountApp(`/inmuebles/${ID}?type=apartment&status=active`);
    const back = await screen.findByRole('link', { name: es.properties.detail.back });
    expect(back.getAttribute('href')).toContain('type=apartment');
    expect(back.getAttribute('href')).toContain('status=active');
  });

  it('tiene un único h1 y las secciones son regiones con nombre', async () => {
    setup();
    mountApp(`/inmuebles/${ID}`);
    await screen.findByRole('heading', { level: 1, name: '50C-1557984' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const name of Object.values(es.properties.detail.sections)) {
      expect(await region(name)).toBeVisible();
    }
  });

  it('un estado desconocido se muestra crudo y la ficha no se rompe', async () => {
    setup(() => HttpResponse.json(propertyDetailFixture({ status: 'archived' })));
    mountApp(`/inmuebles/${ID}`);
    const data = await region(es.properties.detail.sections.data);
    expect(within(data).getByText('archived')).toBeVisible();
  });
});
