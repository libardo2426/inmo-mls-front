import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { es } from '@/lib/i18n/es';
import { meFixture } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

const SECRET = 'JBSWY3DPEHPK3PXP';
const TOTP_URI = `otpauth://totp/Innmo:admin%40innmo.test?secret=${SECRET}&issuer=Innmo`;
const FIRST_CODE = 'aaaaa-11111';
const BACKUP_CODES = [FIRST_CODE, 'bbbbb-22222', 'ccccc-33333'];

function problem(status: number, code: string) {
  return HttpResponse.json(
    { title: 'x', status, code },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}

/** `/me` exige 2FA hasta que el código de verificación sale bien; luego responde 200. */
function backend(
  options: {
    enable?: () => Response;
    totp?: () => Response;
  } = {},
) {
  const state = { verified: false, signedOut: false };
  const seen = { enable: [] as unknown[], totp: [] as unknown[], signOut: 0 };
  server.use(
    http.get('*/v1/me', () => {
      if (state.signedOut) return problem(401, 'unauthorized');
      return state.verified ? HttpResponse.json(meFixture()) : problem(403, 'two_factor_required');
    }),
    http.post('*/v1/auth/sign-out', () => {
      seen.signOut += 1;
      state.signedOut = true;
      return HttpResponse.json({ success: true });
    }),
    http.post('*/v1/auth/two-factor/enable', async ({ request }) => {
      seen.enable.push(await request.json());
      return (
        options.enable ??
        (() => HttpResponse.json({ totpURI: TOTP_URI, backupCodes: BACKUP_CODES }))
      )();
    }),
    http.post('*/v1/auth/two-factor/verify-totp', async ({ request }) => {
      seen.totp.push(await request.json());
      const response = (options.totp ?? (() => HttpResponse.json({ status: true })))();
      if (response.ok) state.verified = true;
      return response;
    }),
  );
  return seen;
}

const invalidCode = () =>
  HttpResponse.json({ code: 'INVALID_CODE', message: 'Invalid code' }, { status: 400 });

async function sendPassword(password = 'una-clave-larga-1') {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(es.auth.activate.password), password);
  await user.click(screen.getByRole('button', { name: es.auth.activate.start }));
  return user;
}

async function goToScan() {
  const user = await sendPassword();
  await screen.findByRole('img', { name: es.auth.activate.qrLabel });
  return user;
}

async function goToCodes() {
  const user = await goToScan();
  await user.type(screen.getByLabelText(es.auth.activate.code), '123456');
  await screen.findByText(FIRST_CODE);
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

describe('ActivateTwoFactorPage — paso contraseña', () => {
  it('envía { password } a two-factor/enable y pasa al paso de escaneo', async () => {
    const seen = backend();
    mountApp('/activar-2fa');
    expect(
      await screen.findByRole('heading', { level: 1, name: es.auth.activate.title }),
    ).toBeInTheDocument();
    await sendPassword('mi-clave-segura-9');
    expect(await screen.findByRole('img', { name: es.auth.activate.qrLabel })).toBeInTheDocument();
    expect(seen.enable).toEqual([{ password: 'mi-clave-segura-9' }]);
  });

  it('INVALID_PASSWORD → alerta passwordInvalid y se queda en el paso', async () => {
    backend({
      enable: () =>
        HttpResponse.json(
          { code: 'INVALID_PASSWORD', message: 'Invalid password' },
          { status: 400 },
        ),
    });
    mountApp('/activar-2fa');
    await sendPassword();
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.errors.passwordInvalid);
    expect(screen.getByLabelText(es.auth.activate.password)).toHaveValue('');
    expect(screen.queryByRole('img', { name: es.auth.activate.qrLabel })).not.toBeInTheDocument();
  });

  it('TOTP_ALREADY_ENABLED → mensaje claro; la salida cierra la sesión y lleva a /iniciar-sesion', async () => {
    const seen = backend({
      enable: () =>
        HttpResponse.json(
          { code: 'TOTP_ALREADY_ENABLED', message: 'TOTP already enabled' },
          { status: 400 },
        ),
    });
    const { history } = mountApp('/activar-2fa');
    await sendPassword();
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.activate.alreadyEnabled);
    await userEvent.click(screen.getByRole('button', { name: es.auth.activate.goToLogin }));
    await waitFor(() => expect(history.location.pathname).toBe('/iniciar-sesion'));
    expect(seen.signOut).toBe(1);
  });

  it('con /me 200 la ruta redirige a /', async () => {
    server.use(http.get('*/v1/me', () => HttpResponse.json(meFixture())));
    const { history } = mountApp('/activar-2fa');
    await waitFor(() => expect(history.location.pathname).toBe('/'));
  });

  it('sin sesión redirige a login con redirect', async () => {
    server.use(http.get('*/v1/me', () => problem(401, 'unauthorized')));
    const { history } = mountApp('/activar-2fa');
    await waitFor(() => expect(history.location.pathname).toBe('/iniciar-sesion'));
    expect(history.location.search).toContain('redirect=');
  });
});

describe('ActivateTwoFactorPage — paso escaneo', () => {
  it('muestra el QR, la clave en texto con botón de copiar y un campo OTP', async () => {
    backend();
    mountApp('/activar-2fa');
    await goToScan();
    const qr = screen.getByRole('img', { name: es.auth.activate.qrLabel });
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(screen.getByText(SECRET)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: es.auth.activate.copySecret })).toBeInTheDocument();
    expect(screen.getByLabelText(es.auth.activate.code)).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    );
  });

  it('un código válido llama a verify-totp y pasa a los códigos de respaldo', async () => {
    const seen = backend();
    mountApp('/activar-2fa');
    await goToCodes();
    expect(seen.totp).toEqual([{ code: '123456' }]);
    for (const code of BACKUP_CODES) expect(screen.getByText(code)).toBeInTheDocument();
  });

  it('un código inválido muestra codeInvalid sin avanzar', async () => {
    backend({ totp: invalidCode });
    mountApp('/activar-2fa');
    const user = await goToScan();
    await user.type(screen.getByLabelText(es.auth.activate.code), '000000');
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.errors.codeInvalid);
    expect(screen.queryByText(FIRST_CODE)).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: es.auth.activate.qrLabel })).toBeInTheDocument();
  });
});

describe('ActivateTwoFactorPage — paso códigos', () => {
  it('Copiar escribe todos los códigos en el portapapeles', async () => {
    backend();
    mountApp('/activar-2fa');
    const user = await goToCodes();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    await user.click(screen.getByRole('button', { name: es.auth.activate.copyCodes }));
    expect(writeText).toHaveBeenCalledWith(BACKUP_CODES.join('\n'));
  });

  it('Descargar crea un Blob de texto con los códigos', async () => {
    backend();
    mountApp('/activar-2fa');
    const user = await goToCodes();
    const create = vi.fn(() => 'blob:fake');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    await user.click(screen.getByRole('button', { name: es.auth.activate.downloadCodes }));
    expect(create).toHaveBeenCalledTimes(1);
    const blob = (create.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toContain('text/plain');
    expect(await blob.text()).toBe(BACKUP_CODES.join('\n'));
    expect(revoke).toHaveBeenCalledWith('blob:fake');
  });

  it('Continuar está deshabilitado hasta marcar «ya guardé mis códigos»', async () => {
    backend();
    mountApp('/activar-2fa');
    const user = await goToCodes();
    const next = screen.getByRole('button', { name: es.auth.activate.continue });
    expect(next).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: es.auth.activate.saved }));
    expect(next).toBeEnabled();
  });

  it('al continuar se descarta /me y se llega a la página autenticada en /', async () => {
    backend();
    const { history } = mountApp('/activar-2fa');
    const user = await goToCodes();
    await user.click(screen.getByRole('checkbox', { name: es.auth.activate.saved }));
    await user.click(screen.getByRole('button', { name: es.auth.activate.continue }));
    await waitFor(() => expect(history.location.pathname).toBe('/'));
    expect(await screen.findByRole('heading', { name: es.app.name })).toBeInTheDocument();
  });

  it('ni los códigos ni la clave llegan a ningún almacenamiento ni a la consola', async () => {
    backend();
    mountApp('/activar-2fa');
    const user = await goToCodes();
    await user.click(screen.getByRole('checkbox', { name: es.auth.activate.saved }));
    await user.click(screen.getByRole('button', { name: es.auth.activate.continue }));
    await screen.findByRole('heading', { name: es.app.name });
    expect(setItem.mock.calls.filter(([key]) => key !== 'innmo-theme')).toEqual([]);
    for (const spy of consoleSpies) {
      const logged = JSON.stringify(spy.mock.calls);
      expect(logged).not.toContain(SECRET);
      for (const code of BACKUP_CODES) expect(logged).not.toContain(code);
    }
    expect(document.body.innerHTML).not.toContain(FIRST_CODE);
  });
});
