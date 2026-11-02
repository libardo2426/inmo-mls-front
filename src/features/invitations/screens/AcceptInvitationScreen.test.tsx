import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import { loadConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { BROKER_AGENCY_ID } from '@/test/fixtures';
import { validConfig } from '@/test/mount';
import { server } from '@/test/server';
import { setInvitationToken } from '../token';
import { AcceptInvitationScreen } from './AcceptInvitationScreen';

const config = loadConfig({ __APP_CONFIG__: validConfig });
const t = es.invitations.accept;

const preview = {
  agencyName: 'Inmobiliaria Demo',
  officeName: 'Sede Norte',
  email: 'nuevo@demo.test',
  fullName: 'Nuevo Demo',
  role: 'agent',
  expiresAt: '2026-11-09T12:00:00.000Z',
};

const problem = (status: number, code: string) =>
  HttpResponse.json(
    { title: 'x', status, code },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );

type Seen = { previews: unknown[]; accepts: unknown[] };

function backend(overrides: { preview?: () => Response; accept?: () => Response } = {}): Seen {
  const seen: Seen = { previews: [], accepts: [] };
  server.use(
    http.post('*/v1/invitations/preview', async ({ request }) => {
      seen.previews.push(await request.json());
      return overrides.preview?.() ?? HttpResponse.json(preview);
    }),
    http.post('*/v1/invitations/accept', async ({ request }) => {
      seen.accepts.push(await request.json());
      return (
        overrides.accept?.() ??
        HttpResponse.json(
          { memberId: BROKER_AGENCY_ID, agencyId: BROKER_AGENCY_ID, role: 'agent' },
          { status: 201 },
        )
      );
    }),
  );
  return seen;
}

function setup(session: 'anonymous' | 'no-membership' | 'authenticated', hash = '#token=abc') {
  window.history.replaceState(null, '', `/invitaciones/aceptar${hash}`);
  const onAccepted = vi.fn();
  const client = createHttpClient({ config, origin: 'http://localhost:3000' });
  render(
    <Providers config={config} queryClient={createQueryClient()} http={client}>
      <AcceptInvitationScreen
        session={session}
        renderAuth={(invitation, signedIn) => (
          <div data-testid="auth">{`${invitation.email}|${signedIn}`}</div>
        )}
        onAccepted={onAccepted}
      />
    </Providers>,
  );
  return { onAccepted };
}

beforeEach(() => setInvitationToken(null));
afterEach(() => {
  setInvitationToken(null);
  window.history.replaceState(null, '', '/');
});

describe('AcceptInvitationScreen', () => {
  it('lee el token del fragmento, limpia la URL y no usa el almacenamiento', async () => {
    const seen = backend();
    setup('anonymous');
    expect(await screen.findByText(t.invitedTo('Inmobiliaria Demo'))).toBeVisible();
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/invitaciones/aceptar');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(seen.previews).toEqual([{ token: 'abc' }]);
  });

  it('al limpiar el fragmento conserva el estado del historial (el del router)', async () => {
    backend();
    window.history.replaceState({ __TSR_index: 3 }, '', '/invitaciones/aceptar#token=abc');
    const client = createHttpClient({ config, origin: 'http://localhost:3000' });
    render(
      <Providers config={config} queryClient={createQueryClient()} http={client}>
        <AcceptInvitationScreen session="anonymous" renderAuth={() => null} onAccepted={vi.fn()} />
      </Providers>,
    );
    expect(await screen.findByText(t.invitedTo('Inmobiliaria Demo'))).toBeVisible();
    expect(window.location.hash).toBe('');
    expect(window.history.state).toEqual({ __TSR_index: 3 });
  });

  it('muestra los datos de la invitación y el panel de autenticación a quien no tiene sesión', async () => {
    backend();
    setup('anonymous');
    expect(await screen.findByText('Sede Norte')).toBeVisible();
    expect(screen.getByText('nuevo@demo.test')).toBeVisible();
    expect(screen.getByText('Nuevo Demo')).toBeVisible();
    expect(screen.getByText(es.members.roles.agent)).toBeVisible();
    expect(screen.getByTestId('auth')).toHaveTextContent('nuevo@demo.test|false');
    expect(screen.queryByRole('button', { name: t.submit })).not.toBeInTheDocument();
  });

  it('sin token muestra «enlace no válido» y no hace ninguna petición', async () => {
    const seen = backend();
    setup('anonymous', '');
    expect(await screen.findByText(t.invalidLink)).toBeVisible();
    expect(seen.previews).toHaveLength(0);
    expect(seen.accepts).toHaveLength(0);
  });

  it('404 invitation_not_found → enlace no válido', async () => {
    backend({ preview: () => problem(404, 'invitation_not_found') });
    setup('anonymous');
    expect(await screen.findByText(t.invalidLink)).toBeVisible();
  });

  it.each([
    [409, 'invitation_expired', t.errors.expired],
    [409, 'invitation_not_pending', t.errors.notPending],
    [403, 'agency_not_active', t.errors.agencyNotActive],
  ])('preview %s %s muestra su mensaje', async (status, code, message) => {
    backend({ preview: () => problem(status, code) });
    setup('anonymous');
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.queryByTestId('auth')).not.toBeInTheDocument();
  });

  it('un fallo transitorio de la vista previa ofrece «Reintentar» sin perder el token', async () => {
    let calls = 0;
    const seen = backend({
      preview: () => {
        calls += 1;
        // Falla la petición inicial y sus 2 reintentos automáticos; la siguiente funciona.
        return calls <= 3 ? problem(503, 'service_unavailable') : HttpResponse.json(preview);
      },
    });
    setup('anonymous');
    await userEvent.click(
      await screen.findByRole('button', { name: es.states.retry }, { timeout: 6000 }),
    );
    expect(await screen.findByText(t.invitedTo('Inmobiliaria Demo'))).toBeVisible();
    expect(seen.previews.at(-1)).toEqual({ token: 'abc' });
  }, 12000);

  it('con sesión sin inmobiliaria ofrece aceptar; aceptar llama onAccepted una vez', async () => {
    const seen = backend();
    const { onAccepted } = setup('no-membership');
    expect(await screen.findByTestId('auth')).toHaveTextContent('nuevo@demo.test|true');
    await userEvent.click(screen.getByRole('button', { name: t.submit }));
    await waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1));
    expect(seen.accepts).toEqual([{ token: 'abc' }]);
  });

  it.each([
    [409, 'already_member', t.errors.alreadyMember],
    [403, 'invitation_email_mismatch', t.errors.mismatch],
    [409, 'invitation_expired', t.errors.expired],
    [409, 'invitation_not_pending', t.errors.notPending],
    [403, 'agency_not_active', t.errors.agencyNotActive],
  ])('accept %s %s muestra su mensaje sin romper la pantalla', async (status, code, message) => {
    backend({ accept: () => problem(status, code) });
    const { onAccepted } = setup('no-membership');
    await userEvent.click(await screen.findByRole('button', { name: t.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(onAccepted).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth')).toBeVisible();
    expect(screen.getByRole('button', { name: t.submit })).toBeEnabled();
  });

  it('quien ya pertenece a una inmobiliaria no puede aceptar', async () => {
    const seen = backend();
    setup('authenticated');
    expect(await screen.findByText(t.alreadyHasAgency)).toBeVisible();
    expect(screen.queryByRole('button', { name: t.submit })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.goHome })).toHaveAttribute('href', '/');
    expect(seen.accepts).toHaveLength(0);
  });
});
