import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { meFixture } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';
import { setInvitationToken } from './token';

const t = es.invitations.accept;
const GOOD = 'una-clave-larga-1';

const preview = {
  agencyName: 'Inmobiliaria Demo',
  officeName: null,
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

/** El navegador real trae el fragmento en `window.location`; el historial en memoria de la prueba no. */
function openLink() {
  window.history.replaceState(null, '', '/invitaciones/aceptar#token=abc');
  mountApp('/invitaciones/aceptar');
}

afterEach(() => {
  setInvitationToken(null);
  window.history.replaceState(null, '', '/');
});

describe('ruta /invitaciones/aceptar', () => {
  it('un anónimo ve la vista previa y el panel con el correo bloqueado', async () => {
    server.use(
      http.get('*/v1/me', () => problem(401, 'unauthorized')),
      http.post('*/v1/invitations/preview', () => HttpResponse.json(preview)),
    );
    openLink();
    expect(await screen.findByText(t.invitedTo('Inmobiliaria Demo'))).toBeVisible();
    const email = await screen.findByLabelText(es.auth.invitation.email);
    expect(email).toHaveValue('nuevo@demo.test');
    expect(email).toHaveAttribute('readonly');
  });

  it('tras crear la cuenta y quedar sin inmobiliaria aparece «Aceptar invitación»', async () => {
    const state = { signedIn: false };
    server.use(
      http.get('*/v1/me', () =>
        state.signedIn ? problem(403, 'no_membership') : problem(401, 'unauthorized'),
      ),
      http.post('*/v1/invitations/preview', () => HttpResponse.json(preview)),
      http.post('*/v1/auth/sign-up/email', () => HttpResponse.json({ token: null, user: {} })),
      http.post('*/v1/auth/sign-in/email', () => {
        state.signedIn = true;
        return HttpResponse.json({ redirect: false, token: 't', user: {} });
      }),
    );
    openLink();
    await userEvent.type(await screen.findByLabelText(es.auth.invitation.password), GOOD);
    await userEvent.click(screen.getByRole('button', { name: es.auth.invitation.submitCreate }));
    expect(await screen.findByRole('button', { name: t.submit })).toBeVisible();
    expect(screen.getByText(es.auth.invitation.signedIn)).toBeVisible();
  });

  it('quien ya tiene inmobiliaria ve el aviso y no puede aceptar', async () => {
    server.use(
      http.get('*/v1/me', () => HttpResponse.json(meFixture())),
      http.post('*/v1/invitations/preview', () => HttpResponse.json(preview)),
    );
    openLink();
    expect(await screen.findByText(t.alreadyHasAgency)).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: t.submit })).not.toBeInTheDocument(),
    );
  });
});
