import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import type { Member } from '@/lib/api/schemas';
import { loadConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { memberFixture } from '@/test/fixtures';
import { validConfig } from '@/test/mount';
import { server } from '@/test/server';
import { ChangeRoleDialog } from './ChangeRoleDialog';

const member = memberFixture() as Member;
const config = loadConfig({ __APP_CONFIG__: validConfig });

function mockRole(respond: () => Response = () => new HttpResponse(null, { status: 204 })) {
  const seen = { calls: 0, body: '' };
  server.use(
    http.patch(`*/v1/members/${member.memberId}/role`, async ({ request }) => {
      seen.calls += 1;
      seen.body = await request.text();
      return respond();
    }),
  );
  return seen;
}

function setup() {
  const onDone = vi.fn();
  const onOpenChange = vi.fn();
  const client = createHttpClient({ config, origin: 'http://localhost:3000' });
  render(
    <Providers config={config} queryClient={createQueryClient()} http={client}>
      <ChangeRoleDialog member={member} open onOpenChange={onOpenChange} onDone={onDone} />
    </Providers>,
  );
  return { onDone, onOpenChange };
}

const submit = () => screen.getByRole('button', { name: es.members.changeRole.submit });
const roleSelect = () => screen.getByRole('combobox', { name: es.members.changeRole.roleLabel });

describe('ChangeRoleDialog', () => {
  it('preselecciona el rol actual y no deja confirmar sin cambiarlo', () => {
    setup();
    expect(roleSelect()).toHaveValue('agent');
    expect(submit()).toBeDisabled();
  });

  it('ofrece solo los cuatro roles invitables', () => {
    setup();
    const values = Array.from(roleSelect().querySelectorAll('option')).map((o) => o.value);
    expect(values).toEqual(['broker', 'agent', 'assistant', 'read_only']);
  });

  it('al elegir otro rol y confirmar envía el PATCH una vez y llama a onDone', async () => {
    const seen = mockRole();
    const { onDone } = setup();
    await userEvent.selectOptions(roleSelect(), 'assistant');
    await userEvent.click(submit());
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(seen.calls).toBe(1);
    expect(JSON.parse(seen.body)).toEqual({ role: 'assistant' });
  });

  it('409 last_broker muestra su mensaje y mantiene el diálogo abierto', async () => {
    mockRole(() =>
      HttpResponse.json(
        { title: 'x', status: 409, code: 'last_broker' },
        { status: 409, headers: { 'content-type': 'application/problem+json' } },
      ),
    );
    const { onDone, onOpenChange } = setup();
    await userEvent.selectOptions(roleSelect(), 'read_only');
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(es.members.errors.lastBroker);
    expect(onDone).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
