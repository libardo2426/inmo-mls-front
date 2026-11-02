import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import { loadConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { validConfig } from '@/test/mount';
import { server } from '@/test/server';
import { LeaveAgencyDialog } from './LeaveAgencyDialog';

const config = loadConfig({ __APP_CONFIG__: validConfig });

function mockLeave(respond: () => Response = () => new HttpResponse(null, { status: 204 })) {
  const seen = { calls: 0 };
  server.use(
    http.post('*/v1/members/me/leave', () => {
      seen.calls += 1;
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
      <LeaveAgencyDialog open onOpenChange={onOpenChange} onDone={onDone} />
    </Providers>,
  );
  return { onDone, onOpenChange };
}

const submit = () => screen.getByRole('button', { name: es.members.leave.submit });

describe('LeaveAgencyDialog', () => {
  it('explica las consecuencias y no envía nada hasta confirmar', () => {
    const seen = mockLeave();
    setup();
    expect(screen.getByText(es.members.leave.description)).toBeInTheDocument();
    expect(seen.calls).toBe(0);
  });

  it('confirmar hace POST a /members/me/leave y llama a onDone', async () => {
    const seen = mockLeave();
    const { onDone } = setup();
    await userEvent.click(submit());
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(seen.calls).toBe(1);
  });

  it('409 last_broker muestra su mensaje y mantiene el diálogo abierto', async () => {
    mockLeave(() =>
      HttpResponse.json(
        { title: 'x', status: 409, code: 'last_broker' },
        { status: 409, headers: { 'content-type': 'application/problem+json' } },
      ),
    );
    const { onDone, onOpenChange } = setup();
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(es.members.errors.lastBroker);
    expect(onDone).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
