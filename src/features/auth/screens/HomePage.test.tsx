import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { meFixture } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

/** `/me` responde 200 hasta cerrar sesión; después, 401. */
function backend() {
  const state = { signedOut: false, meCalls: 0, signOutCalls: 0 };
  server.use(
    http.get('*/v1/me', () => {
      state.meCalls += 1;
      return state.signedOut
        ? HttpResponse.json(
            { title: 'x', status: 401, code: 'unauthorized' },
            { status: 401, headers: { 'content-type': 'application/problem+json' } },
          )
        : HttpResponse.json(meFixture());
    }),
    http.post('*/v1/auth/sign-out', () => {
      state.signOutCalls += 1;
      state.signedOut = true;
      return HttpResponse.json({ success: true });
    }),
  );
  return state;
}

describe('HomePage', () => {
  it('muestra el correo, el país y el botón de cerrar sesión, y conserva el tema', async () => {
    backend();
    mountApp('/');
    expect(await screen.findByRole('heading', { level: 1, name: es.app.name })).toBeInTheDocument();
    expect(screen.getByText('admin@innmo.test')).toBeInTheDocument();
    expect(screen.getByText('Colombia')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: es.auth.home.logout })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: es.theme.toggle })).toBeInTheDocument();
  });

  it('Cerrar sesión llama a sign-out y lleva a /iniciar-sesion', async () => {
    const state = backend();
    const { history } = mountApp('/');
    await userEvent.click(await screen.findByRole('button', { name: es.auth.home.logout }));
    await waitFor(() => expect(history.location.pathname).toBe('/iniciar-sesion'));
    expect(state.signOutCalls).toBe(1);
    expect(
      await screen.findByRole('heading', { level: 1, name: es.auth.login.title }),
    ).toBeInTheDocument();
  });

  it('tras cerrar sesión, / redirige a /iniciar-sesion?redirect=%2F (la caché ya no tiene [me])', async () => {
    backend();
    const { history } = mountApp('/');
    await userEvent.click(await screen.findByRole('button', { name: es.auth.home.logout }));
    await waitFor(() => expect(history.location.pathname).toBe('/iniciar-sesion'));
    history.push('/');
    await waitFor(() => expect(history.location.search).toBe('?redirect=%2F'));
    expect(history.location.pathname).toBe('/iniciar-sesion');
  });
});
