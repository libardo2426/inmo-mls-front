import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import type { AgencyApplication } from '@/lib/api/schemas';
import { loadConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { agencyDetailFixture } from '@/test/fixtures';
import { validConfig } from '@/test/mount';
import { server } from '@/test/server';
import { REASON_MAX, type ReviewAction } from '../review-rules';
import { ReviewDialog } from './ReviewDialog';

const agency = agencyDetailFixture() as AgencyApplication;
const config = loadConfig({ __APP_CONFIG__: validConfig });
const PATHS = { approve: 'approve', requestChanges: 'request-changes', reject: 'reject' } as const;

type Seen = { calls: number; body: unknown };

function mockAction(
  action: ReviewAction,
  respond: () => Response | Promise<Response> = () => new HttpResponse(null, { status: 204 }),
): Seen {
  const seen: Seen = { calls: 0, body: undefined };
  server.use(
    http.post(`*/v1/agencies/${agency.id}/${PATHS[action]}`, async ({ request }) => {
      seen.calls += 1;
      seen.body = await request.text();
      return respond();
    }),
  );
  return seen;
}

function setup(action: ReviewAction) {
  const onDone = vi.fn();
  const onConflict = vi.fn();
  const onOpenChange = vi.fn();
  const client = createHttpClient({ config, origin: 'http://localhost:3000' });
  render(
    <Providers config={config} queryClient={createQueryClient()} http={client}>
      <ReviewDialog
        action={action}
        agency={agency}
        open
        onOpenChange={onOpenChange}
        onDone={onDone}
        onConflict={onConflict}
      />
    </Providers>,
  );
  return { onDone, onConflict, onOpenChange };
}

const confirmButton = (action: ReviewAction) =>
  screen.getByRole('button', { name: es.agencies.review.actions[action] });
const reasonField = () => screen.getByRole('textbox', { name: es.agencies.review.reasonLabel });
const nameField = () =>
  screen.getByRole('textbox', {
    name: es.agencies.review.confirmNameLabel(agency.tradeName),
  });

describe('ReviewDialog', () => {
  it.each(['approve', 'requestChanges', 'reject'] as const)(
    '%s muestra el aviso de 2FA y las descripciones',
    (action) => {
      setup(action);
      expect(screen.getByText(es.agencies.review.twoFactorNotice)).toBeInTheDocument();
      expect(screen.getByText(es.agencies.review.descriptions[action])).toBeInTheDocument();
    },
  );

  it('approve no pide motivo y llama a POST /approve', async () => {
    const seen = mockAction('approve');
    const { onDone } = setup('approve');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await userEvent.click(confirmButton('approve'));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith('approve'));
    expect(seen.calls).toBe(1);
  });

  it('requestChanges: deshabilitado con motivo vacío, solo espacios o demasiado largo', async () => {
    setup('requestChanges');
    expect(confirmButton('requestChanges')).toBeDisabled();
    await userEvent.type(reasonField(), '    ');
    expect(confirmButton('requestChanges')).toBeDisabled();
    await userEvent.clear(reasonField());
    await userEvent.click(reasonField());
    await userEvent.paste('x'.repeat(REASON_MAX + 1));
    expect(confirmButton('requestChanges')).toBeDisabled();
  });

  it('requestChanges envía el motivo recortado', async () => {
    const seen = mockAction('requestChanges');
    const { onDone } = setup('requestChanges');
    await userEvent.type(reasonField(), '  Falta el RUT  ');
    await userEvent.click(confirmButton('requestChanges'));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith('requestChanges'));
    expect(JSON.parse(seen.body as string)).toEqual({ reason: 'Falta el RUT' });
  });

  it('reject exige el nombre comercial y un motivo, y advierte de las consecuencias', async () => {
    const seen = mockAction('reject');
    const { onDone } = setup('reject');
    expect(screen.getByText(/membresías/)).toBeInTheDocument();
    expect(confirmButton('reject')).toBeDisabled();
    await userEvent.type(reasonField(), 'Documentos falsos');
    expect(confirmButton('reject')).toBeDisabled();
    await userEvent.type(nameField(), 'otro nombre');
    expect(confirmButton('reject')).toBeDisabled();
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), '  INMOBILIARIA demo ');
    expect(confirmButton('reject')).toBeEnabled();
    await userEvent.click(confirmButton('reject'));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith('reject'));
    expect(JSON.parse(seen.body as string)).toEqual({ reason: 'Documentos falsos' });
  });

  it('un doble clic en confirmar envía una sola petición', async () => {
    const seen = mockAction(
      'approve',
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(new HttpResponse(null, { status: 204 })), 50),
        ),
    );
    const { onDone } = setup('approve');
    await userEvent.dblClick(confirmButton('approve'));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(seen.calls).toBe(1);
  });

  it('429 muestra la espera y mantiene el diálogo', async () => {
    mockAction('approve', () =>
      HttpResponse.json(
        { title: 'x', status: 429, code: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': '30' } },
      ),
    );
    const { onDone } = setup('approve');
    await userEvent.click(confirmButton('approve'));
    expect(await screen.findByRole('alert')).toHaveTextContent(es.agencies.errors.rateLimited(30));
    expect(onDone).not.toHaveBeenCalled();
  });

  it('tras un 429 el botón sigue deshabilitado durante la espera y muestra los segundos', async () => {
    const seen = mockAction('approve', () =>
      HttpResponse.json(
        { title: 'x', status: 429, code: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': '30' } },
      ),
    );
    setup('approve');
    await userEvent.click(confirmButton('approve'));
    await screen.findByRole('alert');
    expect(confirmButton('approve')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/30/);
    await userEvent.click(confirmButton('approve'));
    expect(seen.calls).toBe(1);
  });

  it('cuando termina la espera del 429 el botón vuelve a habilitarse', async () => {
    mockAction('approve', () =>
      HttpResponse.json(
        { title: 'x', status: 429, code: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': '1' } },
      ),
    );
    setup('approve');
    await userEvent.click(confirmButton('approve'));
    await screen.findByRole('alert');
    expect(confirmButton('approve')).toBeDisabled();
    await vi.waitFor(() => expect(confirmButton('approve')).toBeEnabled(), { timeout: 3000 });
  });

  it('409 agency_not_reviewable cierra el diálogo, avisa del conflicto y no llama onDone', async () => {
    mockAction('approve', () =>
      HttpResponse.json(
        { title: 'x', status: 409, code: 'agency_not_reviewable' },
        { status: 409, headers: { 'content-type': 'application/problem+json' } },
      ),
    );
    const { onDone, onConflict, onOpenChange } = setup('approve');
    await userEvent.click(confirmButton('approve'));
    await vi.waitFor(() => expect(onConflict).toHaveBeenCalledOnce());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).not.toHaveBeenCalled();
  });
});
