import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { meFixture } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

function problem(status: number, code: string) {
  return HttpResponse.json(
    { title: 'x', status, code },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}

describe('NoAccessPage', () => {
  it('se muestra con /me 200 y membership null, con Cerrar sesión', async () => {
    let signedOut = false;
    server.use(
      http.get('*/v1/me', () =>
        signedOut
          ? problem(401, 'unauthorized')
          : HttpResponse.json(meFixture({ membership: null })),
      ),
      http.post('*/v1/auth/sign-out', () => {
        signedOut = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const { history } = mountApp('/sin-acceso');
    expect(
      await screen.findByRole('heading', { level: 1, name: es.auth.noAccess.title }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: es.auth.noAccess.logout }));
    await waitFor(() => expect(history.location.pathname).toBe('/iniciar-sesion'));
  });

  it('se muestra con 403 no_membership', async () => {
    server.use(http.get('*/v1/me', () => problem(403, 'no_membership')));
    mountApp('/sin-acceso');
    expect(
      await screen.findByRole('heading', { level: 1, name: es.auth.noAccess.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: es.auth.noAccess.logout })).toBeInTheDocument();
  });

  it('con /me 401 redirige a login', async () => {
    server.use(http.get('*/v1/me', () => problem(401, 'unauthorized')));
    const { history } = mountApp('/sin-acceso');
    await waitFor(() => expect(history.location.pathname).toBe('/iniciar-sesion'));
  });

  it('con membresía válida redirige a /', async () => {
    server.use(http.get('*/v1/me', () => HttpResponse.json(meFixture())));
    const { history } = mountApp('/sin-acceso');
    await waitFor(() => expect(history.location.pathname).toBe('/'));
  });

  it('un usuario sin membresía que abre / termina en /sin-acceso', async () => {
    server.use(http.get('*/v1/me', () => problem(403, 'no_membership')));
    const { history } = mountApp('/');
    await waitFor(() => expect(history.location.pathname).toBe('/sin-acceso'));
  });
});
