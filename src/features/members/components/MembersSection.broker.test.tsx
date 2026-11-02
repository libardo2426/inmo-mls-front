import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import { loadConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { PermissionsProvider } from '@/lib/permissions/PermissionsProvider';
import { BROKER_AGENCY_ID, brokerMeFixture, memberFixture } from '@/test/fixtures';
import { validConfig } from '@/test/mount';
import { server } from '@/test/server';
import { MembersSection } from './MembersSection';

const config = loadConfig({ __APP_CONFIG__: validConfig });
const ME = brokerMeFixture();

const self = memberFixture({
  memberId: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a60',
  userId: ME.user.id,
  fullName: 'Yo Broker',
  role: 'broker',
  since: '2026-01-01T12:00:00.000Z',
});
const luis = memberFixture();
const ana = memberFixture({
  memberId: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a72',
  userId: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a73',
  fullName: 'Ana Asistente',
  role: 'assistant',
  since: '2026-10-05T12:00:00.000Z',
});

function useList(members: object[]) {
  server.use(
    http.get(`*/v1/agencies/${BROKER_AGENCY_ID}/members`, () => HttpResponse.json(members)),
  );
}

function setup(detail = false) {
  const client = createHttpClient({ config, origin: 'http://localhost:3000' });
  render(
    <Providers config={config} queryClient={createQueryClient()} http={client}>
      <PermissionsProvider me={ME}>
        <MembersSection agencyId={BROKER_AGENCY_ID} detail={detail} />
      </PermissionsProvider>
    </Providers>,
  );
}

async function table() {
  await waitFor(() =>
    expect(screen.getByRole('table', { name: es.members.caption })).toHaveAttribute(
      'aria-busy',
      'false',
    ),
  );
  return screen.getByRole('table', { name: es.members.caption });
}

describe('MembersSection para el broker', () => {
  it('ofrece «Cambiar rol» y «Terminar» en filas ajenas y ninguno en la propia', async () => {
    useList([self, luis, ana]);
    setup();
    const grid = await table();
    const row = (name: string) => within(grid).getByRole('row', { name: new RegExp(name) });
    for (const name of ['Luis Demo', 'Ana Asistente']) {
      expect(
        within(row(name)).getByRole('button', { name: es.members.changeRole.actionFor(name) }),
      ).toBeInTheDocument();
      expect(
        within(row(name)).getByRole('button', { name: es.members.terminate.actionFor(name) }),
      ).toBeInTheDocument();
    }
    expect(within(row('Yo Broker')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('cambiar el rol envía el PATCH, cierra el diálogo, avisa y recarga', async () => {
    let body = '';
    useList([self, luis]);
    server.use(
      http.patch(`*/v1/members/${luis.memberId}/role`, async ({ request }) => {
        body = await request.text();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    setup();
    const grid = await table();
    await userEvent.click(
      within(grid).getByRole('button', { name: es.members.changeRole.actionFor('Luis Demo') }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(
      within(dialog).getByRole('combobox', { name: es.members.changeRole.roleLabel }),
      'assistant',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: es.members.changeRole.submit }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(es.members.changeRole.done);
    await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
    expect(JSON.parse(body)).toEqual({ role: 'assistant' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('el broker termina a un miembro sin escribir motivo (cuerpo vacío)', async () => {
    let body = '';
    useList([self, luis]);
    server.use(
      http.post(`*/v1/members/${luis.memberId}/terminate`, async ({ request }) => {
        body = await request.text();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    setup();
    const grid = await table();
    await userEvent.click(
      within(grid).getByRole('button', { name: es.members.terminate.actionFor('Luis Demo') }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: es.members.terminate.submit }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(es.members.terminate.done);
    expect(JSON.parse(body)).toEqual({});
  });

  it('con detail el nombre abre un panel con los datos y las acciones; Escape devuelve el foco', async () => {
    useList([self, luis]);
    setup(true);
    const grid = await table();
    const opener = within(grid).getByRole('button', {
      name: es.members.detail.open('Luis Demo'),
    });
    await userEvent.click(opener);
    const panel = await screen.findByRole('dialog', { name: es.members.detail.title });
    expect(within(panel).getByText('luis@demo.test')).toBeVisible();
    expect(
      within(panel).getByRole('button', { name: es.members.terminate.actionFor('Luis Demo') }),
    ).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('sin detail no hay botón de nombre (comportamiento idéntico a F4)', async () => {
    useList([self, luis]);
    setup(false);
    const grid = await table();
    expect(
      within(grid).queryByRole('button', { name: es.members.detail.open('Luis Demo') }),
    ).not.toBeInTheDocument();
  });

  it('la propia fila abre el panel pero sin acciones', async () => {
    useList([self, luis]);
    setup(true);
    const grid = await table();
    await userEvent.click(
      within(grid).getByRole('button', { name: es.members.detail.open('Yo Broker') }),
    );
    const panel = await screen.findByRole('dialog', { name: es.members.detail.title });
    expect(
      within(panel).queryByRole('button', { name: /Terminar|Cambiar/ }),
    ).not.toBeInTheDocument();
  });
});
