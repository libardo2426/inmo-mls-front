import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

function problem(status: number, code: string) {
  return HttpResponse.json(
    { title: 'x', status, code },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}

type Me = 'anonymous' | 'two-factor' | 'no-membership';

/** Responde `/me` según el estado y cuenta los envíos de cada ruta de Better Auth. */
function backend(me: Me, overrides: Record<string, () => Response> = {}) {
  const calls: Record<string, number> = {};
  const answers: Record<Me, () => Response> = {
    anonymous: () => problem(401, 'unauthorized'),
    'two-factor': () => problem(403, 'two_factor_required'),
    'no-membership': () => problem(403, 'no_membership'),
  };
  server.use(
    http.get('*/v1/me', () => answers[me]()),
    http.post('*/v1/auth/*', ({ request }) => {
      const key = new URL(request.url).pathname.replace(/^.*\/v1\/auth\//, '');
      calls[key] = (calls[key] ?? 0) + 1;
      return (overrides[key] ?? (() => HttpResponse.json({ status: true })))();
    }),
  );
  return calls;
}

function accessibleName(element: Element): string {
  const aria = element.getAttribute('aria-label');
  if (aria) return aria;
  if (element instanceof HTMLInputElement && element.labels?.[0]) {
    return element.labels[0].textContent ?? '';
  }
  return element.textContent?.trim() ?? '';
}

/** Nombres de los controles que recibe el foco, en orden, empezando por el que ya lo tiene. */
async function focusOrder(user: ReturnType<typeof userEvent.setup>, count: number) {
  const names: string[] = [];
  if (document.activeElement && document.activeElement !== document.body) {
    names.push(accessibleName(document.activeElement));
  }
  while (names.length < count) {
    await user.tab();
    names.push(accessibleName(document.activeElement ?? document.body));
  }
  return names;
}

const PAGES: Array<{ path: string; me: Me; title: string }> = [
  { path: '/iniciar-sesion', me: 'anonymous', title: es.auth.login.title },
  { path: '/verificar', me: 'anonymous', title: es.auth.verify.title },
  { path: '/recuperar', me: 'anonymous', title: es.auth.recover.title },
  { path: '/restablecer#token=abc', me: 'anonymous', title: es.auth.reset.title },
  { path: '/restablecer', me: 'anonymous', title: es.auth.reset.title },
  { path: '/activar-2fa', me: 'two-factor', title: es.auth.activate.title },
  { path: '/sin-acceso', me: 'no-membership', title: es.auth.noAccess.title },
];

describe('estructura', () => {
  it.each(PAGES)(
    '$path tiene un único h1 y todos sus campos tienen nombre accesible',
    async (page) => {
      backend(page.me);
      const { container } = mountApp(page.path);
      const headings = await screen.findAllByRole('heading', { level: 1 });
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveTextContent(page.title);

      const fields = container.querySelectorAll('input:not([type="hidden"]), select, textarea');
      for (const field of fields) expect(accessibleName(field)).not.toBe('');
    },
  );

  it('el paso de escaneo de /activar-2fa conserva un único h1 y nombres accesibles', async () => {
    backend('two-factor', {
      'two-factor/enable': () =>
        HttpResponse.json({
          totpURI: 'otpauth://totp/Innmo:a%40b.c?secret=JBSWY3DPEHPK3PXP',
          backupCodes: ['aaaaa-11111'],
        }),
    });
    const { container } = mountApp('/activar-2fa');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(es.auth.activate.password), 'una-clave-larga-1');
    await user.click(screen.getByRole('button', { name: es.auth.activate.start }));
    await screen.findByRole('img', { name: es.auth.activate.qrLabel });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const field of container.querySelectorAll('input:not([type="hidden"])')) {
      expect(accessibleName(field)).not.toBe('');
    }
  });
});

describe('foco tras un error', () => {
  it('login: credenciales inválidas → el foco pasa a la alerta', async () => {
    backend('anonymous', {
      'sign-in/email': () =>
        HttpResponse.json({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'x' }, { status: 401 }),
    });
    mountApp('/iniciar-sesion');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(es.auth.login.email), 'a@b.co');
    await user.type(screen.getByLabelText(es.auth.login.password), 'x');
    await user.click(screen.getByRole('button', { name: es.auth.login.submit }));
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it('recuperar: correo inválido → el foco pasa a la alerta', async () => {
    backend('anonymous');
    mountApp('/recuperar');
    await userEvent.click(await screen.findByRole('button', { name: es.auth.recover.submit }));
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it('restablecer: contraseña corta → el foco pasa a la alerta', async () => {
    backend('anonymous');
    mountApp('/restablecer#token=abc');
    await userEvent.click(await screen.findByRole('button', { name: es.auth.reset.submit }));
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it('activar 2FA: contraseña incorrecta → el foco pasa a la alerta', async () => {
    backend('two-factor', {
      'two-factor/enable': () =>
        HttpResponse.json({ code: 'INVALID_PASSWORD', message: 'x' }, { status: 400 }),
    });
    mountApp('/activar-2fa');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(es.auth.activate.password), 'mala');
    await user.click(screen.getByRole('button', { name: es.auth.activate.start }));
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it('verificar: código inválido → alerta anunciada y el foco vuelve al campo a reescribir', async () => {
    backend('anonymous', {
      'two-factor/verify-totp': () =>
        HttpResponse.json({ code: 'INVALID_CODE', message: 'x' }, { status: 400 }),
    });
    mountApp('/verificar');
    const input = await screen.findByLabelText(es.auth.verify.code);
    await userEvent.type(input, '000000');
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.errors.codeInvalid);
    await waitFor(() => expect(input).toHaveFocus());
  });
});

describe('teclado', () => {
  it('login: Tab recorre los controles en orden y Enter envía el formulario', async () => {
    const calls = backend('anonymous');
    mountApp('/iniciar-sesion');
    await screen.findByRole('heading', { level: 1 });
    const user = userEvent.setup();
    expect(await focusOrder(user, 4)).toEqual([
      es.auth.login.email,
      es.auth.login.password,
      es.auth.login.submit,
      es.auth.login.forgot,
    ]);
    await user.click(screen.getByLabelText(es.auth.login.email));
    await user.keyboard('a@b.co{Tab}una-clave-larga-1{Enter}');
    await waitFor(() => expect(calls['sign-in/email']).toBe(1));
  });

  it('verificar: Tab recorre el campo y los botones en orden', async () => {
    backend('anonymous');
    mountApp('/verificar');
    await screen.findByRole('heading', { level: 1 });
    const user = userEvent.setup();
    expect(await focusOrder(user, 4)).toEqual([
      es.auth.verify.code,
      es.auth.verify.submit,
      es.auth.verify.useBackup,
      es.auth.verify.backToLogin,
    ]);
  });

  it('recuperar: Tab en orden y Enter envía el formulario', async () => {
    const calls = backend('anonymous');
    mountApp('/recuperar');
    await screen.findByRole('heading', { level: 1 });
    const user = userEvent.setup();
    expect(await focusOrder(user, 3)).toEqual([
      es.auth.recover.email,
      es.auth.recover.submit,
      es.auth.recover.backToLogin,
    ]);
    await user.click(screen.getByLabelText(es.auth.recover.email));
    await user.keyboard('a@b.co{Enter}');
    await waitFor(() => expect(calls['request-password-reset']).toBe(1));
  });

  it('restablecer: Tab en orden y Enter envía el formulario', async () => {
    const calls = backend('anonymous');
    mountApp('/restablecer#token=abc');
    await screen.findByRole('heading', { level: 1 });
    const user = userEvent.setup();
    expect(await focusOrder(user, 3)).toEqual([
      es.auth.reset.password,
      es.auth.reset.confirm,
      es.auth.reset.submit,
    ]);
    await user.click(screen.getByLabelText(es.auth.reset.password));
    await user.keyboard('una-clave-bien-larga-1{Tab}una-clave-bien-larga-1{Enter}');
    await waitFor(() => expect(calls['reset-password']).toBe(1));
  });

  it('activar 2FA: Tab en orden y Enter envía la contraseña', async () => {
    const calls = backend('two-factor', {
      'two-factor/enable': () =>
        HttpResponse.json({ totpURI: 'otpauth://totp/x?secret=ABC', backupCodes: ['a'] }),
    });
    mountApp('/activar-2fa');
    await screen.findByRole('heading', { level: 1 });
    const user = userEvent.setup();
    expect(await focusOrder(user, 2)).toEqual([es.auth.activate.password, es.auth.activate.start]);
    await user.click(screen.getByLabelText(es.auth.activate.password));
    await user.keyboard('una-clave-larga-1{Enter}');
    await waitFor(() => expect(calls['two-factor/enable']).toBe(1));
  });
});
