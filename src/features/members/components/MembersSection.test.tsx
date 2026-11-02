import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import type { MeResponse } from '@/lib/api/schemas';
import { loadConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { PermissionsProvider } from '@/lib/permissions/PermissionsProvider';
import { memberFixture, meWithPermissions } from '@/test/fixtures';
import { validConfig } from '@/test/mount';
import { server } from '@/test/server';
import { MembersSection } from './MembersSection';

const AID = 'agency-1';
const config = loadConfig({ __APP_CONFIG__: validConfig });
const ADMIN = meWithPermissions({ 'member.read': 'network', 'member.terminate_any': 'network' });
const COMPLIANCE = meWithPermissions({ 'member.read': 'network' });

const active = memberFixture();
const suspended = memberFixture({
  memberId: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a72',
  fullName: 'Ana Suspendida',
  status: 'suspended',
  role: 'assistant',
  since: '2026-09-15T12:00:00.000Z',
});
const terminated = memberFixture({
  memberId: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a73',
  fullName: 'Pedro Terminado',
  status: 'terminated',
  role: 'broker',
  since: '2026-01-05T12:00:00.000Z',
});

function useMembers(respond: () => Response | Promise<Response>) {
  server.use(http.get(`*/v1/agencies/${AID}/members`, respond));
}

function setup(me: MeResponse = ADMIN) {
  const client = createHttpClient({ config, origin: 'http://localhost:3000' });
  render(
    <Providers config={config} queryClient={createQueryClient()} http={client}>
      <PermissionsProvider me={me}>
        <MembersSection agencyId={AID} />
      </PermissionsProvider>
    </Providers>,
  );
}

/** Espera a que lleguen los datos (mientras carga la tabla muestra filas de esqueleto). */
const table = async () => {
  await waitFor(() =>
    expect(screen.getByRole('table', { name: es.members.caption })).toHaveAttribute(
      'aria-busy',
      'false',
    ),
  );
  return screen.getByRole('table', { name: es.members.caption });
};

describe('MembersSection', () => {
  it('admin ve la tabla con rol y fecha traducidos y «Terminar» solo en el activo', async () => {
    useMembers(() => HttpResponse.json([active, suspended, terminated]));
    setup();
    const grid = await table();
    expect(screen.getByRole('region', { name: es.members.title })).toBeVisible();
    expect(within(grid).getByText(es.members.roles.agent)).toBeInTheDocument();
    expect(within(grid).getByText('01/10/2026')).toBeInTheDocument();
    expect(within(grid).getByText(es.members.status.suspended)).toBeInTheDocument();
    expect(within(grid).getAllByRole('button')).toHaveLength(1);
    expect(
      within(grid).getByRole('button', { name: es.members.terminate.actionFor('Luis Demo') }),
    ).toBeInTheDocument();
  });

  it('compliance (solo member.read) ve la tabla sin columna de acciones', async () => {
    useMembers(() => HttpResponse.json([active]));
    setup(COMPLIANCE);
    const grid = await table();
    expect(within(grid).queryByRole('button')).not.toBeInTheDocument();
    expect(
      within(grid).queryByRole('columnheader', { name: es.members.columns.actions }),
    ).not.toBeInTheDocument();
  });

  it('una agencia sin miembros muestra el estado vacío', async () => {
    useMembers(() => HttpResponse.json([]));
    setup();
    expect(await screen.findByText(es.members.empty.title)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('un error de carga muestra el estado de error con reintento', async () => {
    useMembers(() => HttpResponse.json({ title: 'x' }, { status: 400 }));
    setup();
    expect(await screen.findByRole('button', { name: es.states.retry })).toBeInTheDocument();
  });

  it('ordena a los activos primero y luego por antigüedad', async () => {
    const later = memberFixture({
      memberId: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a74',
      fullName: 'Zoe Reciente',
      since: '2026-10-05T12:00:00.000Z',
    });
    useMembers(() => HttpResponse.json([terminated, later, active]));
    setup();
    const grid = await table();
    const names = within(grid)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0]?.textContent);
    expect(names).toEqual(['Luis Demo', 'Zoe Reciente', 'Pedro Terminado']);
  });

  it('terminar a un miembro: envía el motivo, cierra el diálogo, avisa y recarga el listado', async () => {
    let done = false;
    let body = '';
    useMembers(() => HttpResponse.json([done ? memberFixture({ status: 'terminated' }) : active]));
    server.use(
      http.post(`*/v1/members/${active.memberId}/terminate`, async ({ request }) => {
        body = await request.text();
        done = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    setup();
    const grid = await table();
    await userEvent.click(
      within(grid).getByRole('button', { name: es.members.terminate.actionFor('Luis Demo') }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: es.members.terminate.reasonLabel }),
      'Incumple normas',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: es.members.terminate.submit }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(es.members.terminate.done);
    expect(screen.getByRole('status')).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(JSON.parse(body)).toEqual({ reason: 'Incumple normas' });
    await waitFor(() =>
      expect(
        within(screen.getByRole('table', { name: es.members.caption })).queryByRole('button'),
      ).not.toBeInTheDocument(),
    );
  });
});
