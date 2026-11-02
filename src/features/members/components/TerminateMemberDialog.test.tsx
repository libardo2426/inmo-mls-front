import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
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
import { REASON_MAX } from '../terminate-rules';
import { TerminateMemberDialog } from './TerminateMemberDialog';

const member = memberFixture() as Member;
const config = loadConfig({ __APP_CONFIG__: validConfig });

type Seen = { calls: number; body: string };

function mockTerminate(
  respond: () => Response | Promise<Response> = () => new HttpResponse(null, { status: 204 }),
): Seen {
  const seen: Seen = { calls: 0, body: '' };
  server.use(
    http.post(`*/v1/members/${member.memberId}/terminate`, async ({ request }) => {
      seen.calls += 1;
      seen.body = await request.text();
      return respond();
    }),
  );
  return seen;
}

function problem(status: number, code: string, headers: Record<string, string> = {}) {
  return HttpResponse.json(
    { title: 'x', status, code },
    { status, headers: { 'content-type': 'application/problem+json', ...headers } },
  );
}

function setup(reasonRequired = true) {
  const onDone = vi.fn();
  const onOpenChange = vi.fn();
  const client = createHttpClient({ config, origin: 'http://localhost:3000' });
  render(
    <Providers config={config} queryClient={createQueryClient()} http={client}>
      <TerminateMemberDialog
        member={member}
        open
        reasonRequired={reasonRequired}
        onOpenChange={onOpenChange}
        onDone={onDone}
      />
    </Providers>,
  );
  return { onDone, onOpenChange };
}

const submit = () => screen.getByRole('button', { name: es.members.terminate.submit });
const reasonField = () => screen.getByRole('textbox', { name: es.members.terminate.reasonLabel });

describe('TerminateMemberDialog', () => {
  it('muestra el nombre, el aviso de 2FA y la descripción', () => {
    setup();
    expect(screen.getByText(es.members.terminate.twoFactorNotice)).toBeInTheDocument();
    expect(screen.getByText(es.members.terminate.description('Luis Demo'))).toBeInTheDocument();
  });

  it('el broker (motivo opcional) no ve el aviso de 2FA, que no se le exige', () => {
    setup(false);
    expect(screen.queryByText(es.members.terminate.twoFactorNotice)).not.toBeInTheDocument();
  });

  it('deshabilitado con motivo vacío, solo espacios o de más de 1000 caracteres', async () => {
    setup();
    expect(submit()).toBeDisabled();
    await userEvent.type(reasonField(), '    ');
    expect(submit()).toBeDisabled();
    await userEvent.clear(reasonField());
    await userEvent.click(reasonField());
    await userEvent.paste('x'.repeat(REASON_MAX + 1));
    expect(submit()).toBeDisabled();
    await userEvent.clear(reasonField());
    await userEvent.paste('x'.repeat(REASON_MAX));
    expect(submit()).toBeEnabled();
  });

  it('envía el motivo recortado una sola vez y llama a onDone', async () => {
    const seen = mockTerminate(async () => {
      await delay(150);
      return new HttpResponse(null, { status: 204 });
    });
    const { onDone } = setup();
    await userEvent.type(reasonField(), '  Incumple normas  ');
    await userEvent.dblClick(submit());
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(seen.calls).toBe(1);
    expect(JSON.parse(seen.body)).toEqual({ reason: 'Incumple normas' });
  });

  it('409 last_broker muestra su mensaje y mantiene el diálogo abierto', async () => {
    mockTerminate(() => problem(409, 'last_broker'));
    const { onDone, onOpenChange } = setup();
    await userEvent.type(reasonField(), 'Motivo');
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(es.members.errors.lastBroker);
    expect(onDone).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('403 two_factor_required muestra el mensaje de 2FA', async () => {
    mockTerminate(() => problem(403, 'two_factor_required'));
    setup();
    await userEvent.type(reasonField(), 'Motivo');
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(es.members.errors.twoFactorRequired);
  });

  it('429 deshabilita el botón durante la espera', async () => {
    const seen = mockTerminate(() => problem(429, 'rate_limited', { 'Retry-After': '30' }));
    setup();
    await userEvent.type(reasonField(), 'Motivo');
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(es.members.errors.rateLimited(30));
    expect(submit()).toBeDisabled();
    await userEvent.click(submit());
    expect(seen.calls).toBe(1);
  });

  it('con motivo opcional se habilita sin motivo y envía un cuerpo vacío', async () => {
    const seen = mockTerminate();
    const { onDone } = setup(false);
    expect(submit()).toBeEnabled();
    expect(
      screen.getByText(es.members.terminate.reasonOptionalHelp(REASON_MAX)),
    ).toBeInTheDocument();
    await userEvent.click(submit());
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(JSON.parse(seen.body)).toEqual({});
  });

  it('con motivo opcional y escrito lo envía recortado; el tope de 1000 sigue aplicando', async () => {
    const seen = mockTerminate();
    const { onDone } = setup(false);
    await userEvent.click(reasonField());
    await userEvent.paste('x'.repeat(REASON_MAX + 1));
    expect(submit()).toBeDisabled();
    await userEvent.clear(reasonField());
    await userEvent.type(reasonField(), '  Cambio de agencia ');
    await userEvent.click(submit());
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(JSON.parse(seen.body)).toEqual({ reason: 'Cambio de agencia' });
  });
});
