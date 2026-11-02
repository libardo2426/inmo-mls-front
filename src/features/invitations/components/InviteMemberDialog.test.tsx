import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import { loadConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { BROKER_AGENCY_ID, invitationFixture } from '@/test/fixtures';
import { validConfig } from '@/test/mount';
import { server } from '@/test/server';
import { InviteMemberDialog } from './InviteMemberDialog';

const config = loadConfig({ __APP_CONFIG__: validConfig });

function mockInvite(respond?: () => Response) {
  const seen = { calls: 0, body: '' };
  server.use(
    http.post(`*/v1/agencies/${BROKER_AGENCY_ID}/invitations`, async ({ request }) => {
      seen.calls += 1;
      seen.body = await request.text();
      return (
        respond?.() ??
        HttpResponse.json({ invitation: invitationFixture(), warnings: [] }, { status: 201 })
      );
    }),
  );
  return seen;
}

const problem = (status: number, code: string) =>
  HttpResponse.json(
    { title: 'x', status, code },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );

function setup() {
  const onDone = vi.fn();
  const onOpenChange = vi.fn();
  const client = createHttpClient({ config, origin: 'http://localhost:3000' });
  render(
    <Providers config={config} queryClient={createQueryClient()} http={client}>
      <InviteMemberDialog
        agencyId={BROKER_AGENCY_ID}
        open
        onOpenChange={onOpenChange}
        onDone={onDone}
      />
    </Providers>,
  );
  return { onDone, onOpenChange };
}

const submit = () => screen.getByRole('button', { name: es.invitations.invite.submit });
const email = () => screen.getByRole('textbox', { name: es.invitations.invite.email });
const fullName = () => screen.getByRole('textbox', { name: es.invitations.invite.fullName });
const role = () => screen.getByRole('combobox', { name: es.invitations.invite.role });

describe('InviteMemberDialog', () => {
  it('deshabilita enviar con correo inválido o nombre vacío', async () => {
    setup();
    expect(submit()).toBeDisabled();
    await userEvent.type(email(), 'no-es-correo');
    await userEvent.type(fullName(), 'Nuevo Demo');
    expect(submit()).toBeDisabled();
    await userEvent.clear(email());
    await userEvent.type(email(), 'nuevo@demo.test');
    expect(submit()).toBeEnabled();
    await userEvent.clear(fullName());
    await userEvent.type(fullName(), '   ');
    expect(submit()).toBeDisabled();
  });

  it('ofrece los cuatro roles invitables con «Agente» por defecto', () => {
    setup();
    expect(role()).toHaveValue('agent');
    const values = Array.from(role().querySelectorAll('option')).map((o) => o.value);
    expect(values).toEqual(['broker', 'agent', 'assistant', 'read_only']);
  });

  it('envía los datos recortados una vez y entrega el resultado a onDone', async () => {
    const seen = mockInvite();
    const { onDone } = setup();
    await userEvent.type(email(), '  nuevo@demo.test ');
    await userEvent.type(fullName(), ' Nuevo Demo ');
    await userEvent.selectOptions(role(), 'assistant');
    await userEvent.click(submit());
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(seen.calls).toBe(1);
    expect(JSON.parse(seen.body)).toEqual({
      email: 'nuevo@demo.test',
      fullName: 'Nuevo Demo',
      role: 'assistant',
    });
    expect(onDone.mock.calls[0]?.[0]).toMatchObject({ warnings: [] });
  });

  it.each([
    [409, 'invitation_already_pending', es.invitations.errors.alreadyPending],
    [403, 'agency_not_active', es.invitations.errors.agencyNotActive],
  ])('%s %s muestra su mensaje y mantiene el diálogo', async (status, code, message) => {
    mockInvite(() => problem(status, code));
    const { onDone, onOpenChange } = setup();
    await userEvent.type(email(), 'nuevo@demo.test');
    await userEvent.type(fullName(), 'Nuevo Demo');
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(onDone).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('429 deshabilita el botón durante la espera', async () => {
    const seen = mockInvite(() =>
      HttpResponse.json(
        { title: 'x', status: 429, code: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': '30' } },
      ),
    );
    setup();
    await userEvent.type(email(), 'nuevo@demo.test');
    await userEvent.type(fullName(), 'Nuevo Demo');
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      es.invitations.errors.rateLimited(30),
    );
    expect(submit()).toBeDisabled();
    await userEvent.click(submit());
    expect(seen.calls).toBe(1);
  });
});
