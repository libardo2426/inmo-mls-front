import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
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

/** `/me` responde 401 hasta que se inicia sesión; luego, `afterLogin`. */
function backend(options: {
  signIn: () => Response | Promise<Response>;
  afterLogin?: () => Response;
}) {
  const state = { loggedIn: false, signInCalls: 0 };
  server.use(
    http.get('*/v1/me', () =>
      state.loggedIn
        ? (options.afterLogin ?? (() => HttpResponse.json(meFixture())))()
        : problem(401, 'unauthorized'),
    ),
    http.post('*/v1/auth/sign-in/email', async () => {
      state.signInCalls += 1;
      const response = await options.signIn();
      // Un twoFactorRedirect no crea sesión: la cookie solo existe tras verificar el código.
      const body: unknown = await response.clone().json();
      const needsSecondFactor =
        typeof body === 'object' && body !== null && 'twoFactorRedirect' in body;
      if (response.ok && !needsSecondFactor) state.loggedIn = true;
      return response;
    }),
  );
  return state;
}

const session = () =>
  HttpResponse.json({ redirect: false, token: 'SECRETO-123', user: { id: 'u1' } });

async function fillAndSubmit(email = 'admin@innmo.test', password = 'una-clave-larga-1') {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(es.auth.login.email), email);
  await user.type(screen.getByLabelText(es.auth.login.password), password);
  await user.click(screen.getByRole('button', { name: es.auth.login.submit }));
  return user;
}

let setItem: MockInstance<Storage['setItem']>;
let consoleSpies: Array<MockInstance<(...args: unknown[]) => void>>;

beforeEach(() => {
  setItem = vi.spyOn(Storage.prototype, 'setItem');
  consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => undefined),
  );
});
afterEach(() => vi.restoreAllMocks());

describe('LoginPage', () => {
  it('muestra el título y los campos con el autocompletado correcto', async () => {
    backend({ signIn: session });
    mountApp('/iniciar-sesion');
    expect(
      await screen.findByRole('heading', { level: 1, name: es.auth.login.title }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(es.auth.login.email)).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText(es.auth.login.password)).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    expect(screen.getByLabelText(es.auth.login.password)).toHaveAttribute('type', 'password');
  });

  it('login correcto sin 2FA → va a la ruta del redirect', async () => {
    backend({ signIn: session });
    const { history } = mountApp('/iniciar-sesion?redirect=%2Fpropiedades%3Fx%3D1');
    await fillAndSubmit();
    await waitFor(() => expect(history.location.pathname).toBe('/propiedades'));
    expect(history.location.search).toBe('?x=1');
  });

  it('login correcto sin redirect → entra a / y muestra la página autenticada', async () => {
    backend({ signIn: session });
    const { history } = mountApp('/iniciar-sesion');
    await fillAndSubmit();
    expect(await screen.findByRole('heading', { name: es.app.name })).toBeInTheDocument();
    expect(history.location.pathname).toBe('/');
  });

  it.each(['//evil.com', 'https://evil.com', 'javascript:alert(1)'])(
    'redirect malicioso %s → se ignora y se va a /',
    async (evil) => {
      backend({ signIn: session });
      const { history } = mountApp(`/iniciar-sesion?redirect=${encodeURIComponent(evil)}`);
      await fillAndSubmit();
      await waitFor(() => expect(history.location.pathname).toBe('/'));
    },
  );

  it('twoFactorRedirect → pasa a /verificar', async () => {
    backend({
      signIn: () => HttpResponse.json({ twoFactorRedirect: true, twoFactorMethods: ['totp'] }),
    });
    const { history } = mountApp('/iniciar-sesion');
    await fillAndSubmit();
    await waitFor(() => expect(history.location.pathname).toBe('/verificar'));
  });

  it('sesión creada pero /me exige 2FA → pasa a /activar-2fa', async () => {
    backend({ signIn: session, afterLogin: () => problem(403, 'two_factor_required') });
    const { history } = mountApp('/iniciar-sesion');
    await fillAndSubmit();
    await waitFor(() => expect(history.location.pathname).toBe('/activar-2fa'));
  });

  it('credenciales inválidas → alerta con el mensaje, foco en la alerta y el correo se conserva', async () => {
    backend({
      signIn: () =>
        HttpResponse.json(
          { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' },
          { status: 401 },
        ),
    });
    const { history } = mountApp('/iniciar-sesion');
    await fillAndSubmit('admin@innmo.test', 'mala-clave-larga-1');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(es.auth.errors.credentials);
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByLabelText(es.auth.login.email)).toHaveValue('admin@innmo.test');
    expect(screen.getByLabelText(es.auth.login.password)).toHaveValue('');
    expect(history.location.pathname).toBe('/iniciar-sesion');
  });

  it('429 con X-Retry-After → muestra la espera y deshabilita el botón', async () => {
    backend({
      signIn: () =>
        HttpResponse.json(
          { message: 'Too many requests' },
          { status: 429, headers: { 'X-Retry-After': '30' } },
        ),
    });
    mountApp('/iniciar-sesion');
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent('30');
    expect(screen.getByRole('button', { name: es.auth.login.submit })).toBeDisabled();
  });

  it('campos vacíos → mensaje de validación y ninguna petición', async () => {
    const state = backend({ signIn: session });
    mountApp('/iniciar-sesion');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: es.auth.login.submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.login.validation);
    expect(state.signInCalls).toBe(0);
  });

  it('doble clic en Entrar → una sola petición', async () => {
    const state = backend({
      signIn: async () => {
        await delay(50);
        return session();
      },
    });
    mountApp('/iniciar-sesion');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(es.auth.login.email), 'admin@innmo.test');
    await user.type(screen.getByLabelText(es.auth.login.password), 'una-clave-larga-1');
    await user.dblClick(screen.getByRole('button', { name: es.auth.login.submit }));
    await screen.findByRole('heading', { name: es.app.name });
    expect(state.signInCalls).toBe(1);
  });

  it('el token de la respuesta no llega a ningún almacenamiento, consola ni al DOM', async () => {
    backend({ signIn: session });
    mountApp('/iniciar-sesion');
    await fillAndSubmit();
    await screen.findByRole('heading', { name: es.app.name });
    const stored = setItem.mock.calls.filter(([key]) => key !== 'innmo-theme');
    expect(stored).toEqual([]);
    for (const spy of consoleSpies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain('SECRETO');
    }
    expect(document.body.innerHTML).not.toContain('SECRETO');
  });

  it('con sesión válida, /iniciar-sesion redirige a /', async () => {
    server.use(http.get('*/v1/me', () => HttpResponse.json(meFixture())));
    const { history } = mountApp('/iniciar-sesion');
    await waitFor(() => expect(history.location.pathname).toBe('/'));
    expect(await screen.findByRole('heading', { name: es.app.name })).toBeInTheDocument();
  });
});
