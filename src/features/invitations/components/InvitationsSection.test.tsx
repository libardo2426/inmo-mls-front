import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import { loadConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { BROKER_AGENCY_ID, invitationFixture } from '@/test/fixtures';
import { validConfig } from '@/test/mount';
import { server } from '@/test/server';
import { InvitationsSection } from './InvitationsSection';

const config = loadConfig({ __APP_CONFIG__: validConfig });
const BASE = `*/v1/agencies/${BROKER_AGENCY_ID}/invitations`;

const pending = invitationFixture();
const expired = invitationFixture({
  id: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a82',
  email: 'vencida@demo.test',
  fullName: 'Vencida Demo',
  status: 'expired',
});

const problem = (status: number, code: string) =>
  HttpResponse.json(
    { title: 'x', status, code },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );

type Seen = { statuses: (string | null)[]; cursors: (string | null)[] };

function useList(
  byStatus: Record<string, object[]> = { pending: [pending], expired: [expired] },
  nextCursor: string | null = null,
): Seen {
  const seen: Seen = { statuses: [], cursors: [] };
  server.use(
    http.get(BASE, ({ request }) => {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      seen.statuses.push(status);
      seen.cursors.push(url.searchParams.get('cursor'));
      return HttpResponse.json({
        items: byStatus[status ?? 'pending'] ?? [],
        nextCursor: url.searchParams.get('cursor') ? null : nextCursor,
      });
    }),
  );
  return seen;
}

function setup() {
  const client = createHttpClient({ config, origin: 'http://localhost:3000' });
  render(
    <Providers config={config} queryClient={createQueryClient()} http={client}>
      <InvitationsSection agencyId={BROKER_AGENCY_ID} />
    </Providers>,
  );
}

async function table() {
  await waitFor(() =>
    expect(screen.getByRole('table', { name: es.invitations.caption })).toHaveAttribute(
      'aria-busy',
      'false',
    ),
  );
  return screen.getByRole('table', { name: es.invitations.caption });
}

describe('InvitationsSection', () => {
  it('lista las pendientes por defecto y repite con el estado elegido', async () => {
    const seen = useList();
    setup();
    const grid = await table();
    expect(within(grid).getByText('nuevo@demo.test')).toBeInTheDocument();
    expect(seen.statuses[0]).toBe('pending');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: es.invitations.filterLabel }),
      'expired',
    );
    expect(await screen.findByText('vencida@demo.test')).toBeInTheDocument();
    expect(seen.statuses).toContain('expired');
  });

  it('sin invitaciones muestra el estado vacío', async () => {
    useList({ pending: [] });
    setup();
    expect(await screen.findByText(es.invitations.empty.title)).toBeInTheDocument();
  });

  it('«Cargar más» pide la página siguiente con el cursor', async () => {
    const seen = useList({ pending: [pending] }, 'c2');
    setup();
    await table();
    await userEvent.click(await screen.findByRole('button', { name: es.invitations.loadMore }));
    await waitFor(() => expect(seen.cursors).toContain('c2'));
  });

  it('invitar envía los datos, cierra el diálogo, avisa y recarga el listado', async () => {
    const seen = useList();
    let body = '';
    server.use(
      http.post(BASE, async ({ request }) => {
        body = await request.text();
        return HttpResponse.json(
          { invitation: invitationFixture(), warnings: [] },
          { status: 201 },
        );
      }),
    );
    setup();
    await table();
    await userEvent.click(screen.getByRole('button', { name: es.invitations.invite.action }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: es.invitations.invite.email }),
      'otro@demo.test',
    );
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: es.invitations.invite.fullName }),
      'Otro Demo',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: es.invitations.invite.submit }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(es.invitations.invite.done);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(JSON.parse(body)).toEqual({
      email: 'otro@demo.test',
      fullName: 'Otro Demo',
      role: 'agent',
    });
    await waitFor(() => expect(seen.statuses.length).toBeGreaterThan(1));
  });

  it('si el correo no salió deja un aviso persistente y «Reenviar» llama a resend', async () => {
    useList();
    let resent = 0;
    server.use(
      http.post(BASE, () =>
        HttpResponse.json(
          { invitation: invitationFixture(), warnings: [{ code: 'email_not_sent' }] },
          { status: 201 },
        ),
      ),
      http.post(`${BASE}/${pending.id}/resend`, () => {
        resent += 1;
        return HttpResponse.json({ invitation: invitationFixture(), warnings: [] });
      }),
    );
    setup();
    await table();
    await userEvent.click(screen.getByRole('button', { name: es.invitations.invite.action }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: es.invitations.invite.email }),
      'nuevo@demo.test',
    );
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: es.invitations.invite.fullName }),
      'Nuevo Demo',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: es.invitations.invite.submit }),
    );
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(es.invitations.emailNotSent);
    await userEvent.click(
      within(notice).getByRole('button', { name: es.invitations.resendFor('nuevo@demo.test') }),
    );
    await waitFor(() => expect(resent).toBe(1));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(es.invitations.resendDone),
    );
  });

  it('409 invitation_already_pending al invitar mantiene el diálogo con su mensaje', async () => {
    useList();
    server.use(http.post(BASE, () => problem(409, 'invitation_already_pending')));
    setup();
    await table();
    await userEvent.click(screen.getByRole('button', { name: es.invitations.invite.action }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: es.invitations.invite.email }),
      'nuevo@demo.test',
    );
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: es.invitations.invite.fullName }),
      'Nuevo Demo',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: es.invitations.invite.submit }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      es.invitations.errors.alreadyPending,
    );
  });

  it('reenviar una vencida llama a resend y avisa', async () => {
    useList();
    let resent = 0;
    server.use(
      http.post(`${BASE}/${expired.id}/resend`, () => {
        resent += 1;
        return HttpResponse.json({ invitation: invitationFixture(), warnings: [] });
      }),
    );
    setup();
    await table();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: es.invitations.filterLabel }),
      'expired',
    );
    await userEvent.click(
      await screen.findByRole('button', { name: es.invitations.resendFor('vencida@demo.test') }),
    );
    await waitFor(() => expect(resent).toBe(1));
    expect(await screen.findByRole('status')).toHaveTextContent(es.invitations.resendDone);
  });

  it('cancelar pide confirmación y envía POST cancel', async () => {
    useList();
    let cancelled = 0;
    server.use(
      http.post(`${BASE}/${pending.id}/cancel`, () => {
        cancelled += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    setup();
    const grid = await table();
    await userEvent.click(
      within(grid).getByRole('button', { name: es.invitations.cancelFor('nuevo@demo.test') }),
    );
    expect(cancelled).toBe(0);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: es.invitations.cancelConfirm }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(es.invitations.cancelDone);
    expect(cancelled).toBe(1);
  });

  it('409 invitation_not_pending al cancelar muestra su mensaje y recarga el listado', async () => {
    const seen = useList();
    server.use(
      http.post(`${BASE}/${pending.id}/cancel`, () => problem(409, 'invitation_not_pending')),
    );
    setup();
    const grid = await table();
    await userEvent.click(
      within(grid).getByRole('button', { name: es.invitations.cancelFor('nuevo@demo.test') }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: es.invitations.cancelConfirm }),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      es.invitations.errors.notPending,
    );
    await waitFor(() => expect(seen.statuses.length).toBeGreaterThan(1));
  });
});
