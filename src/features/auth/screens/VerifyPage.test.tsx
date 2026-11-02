import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { meFixture } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

type Captured = { totp: unknown[]; backup: unknown[] };

/** `/me` responde 401 hasta que una verificación sale bien. */
function backend(
  options: {
    totp?: () => Response | Promise<Response>;
    backup?: () => Response | Promise<Response>;
  } = {},
) {
  const state = { verified: false };
  const seen: Captured = { totp: [], backup: [] };
  server.use(
    http.get('*/v1/me', () =>
      state.verified
        ? HttpResponse.json(meFixture())
        : HttpResponse.json(
            { title: 'x', status: 401, code: 'unauthorized' },
            { status: 401, headers: { 'content-type': 'application/problem+json' } },
          ),
    ),
    http.post('*/v1/auth/two-factor/verify-totp', async ({ request }) => {
      seen.totp.push(await request.json());
      const response = await (options.totp ?? (() => HttpResponse.json({ status: true })))();
      if (response.ok) state.verified = true;
      return response;
    }),
    http.post('*/v1/auth/two-factor/verify-backup-code', async ({ request }) => {
      seen.backup.push(await request.json());
      const response = await (
        options.backup ?? (() => HttpResponse.json({ user: { id: 'u1' } }))
      )();
      if (response.ok) state.verified = true;
      return response;
    }),
  );
  return seen;
}

const invalidCode = () =>
  HttpResponse.json({ code: 'INVALID_CODE', message: 'Invalid code' }, { status: 400 });

describe('VerifyPage', () => {
  it('muestra el título y un campo con autocomplete one-time-code', async () => {
    backend();
    mountApp('/verificar');
    expect(
      await screen.findByRole('heading', { level: 1, name: es.auth.verify.title }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(es.auth.verify.code)).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    );
  });

  it('al escribir 6 dígitos envía { code } sin trustDevice y entra', async () => {
    const seen = backend();
    const { history } = mountApp('/verificar');
    await userEvent.type(await screen.findByLabelText(es.auth.verify.code), '123456');
    await waitFor(() => expect(history.location.pathname).toBe('/'));
    expect(seen.totp).toEqual([{ code: '123456' }]);
    expect(await screen.findByRole('heading', { level: 1, name: es.nav.home })).toBeInTheDocument();
  });

  it('respeta el redirect y descarta uno malicioso', async () => {
    backend();
    const first = mountApp('/verificar?redirect=%2Fpropiedades');
    await userEvent.type(await screen.findByLabelText(es.auth.verify.code), '123456');
    await waitFor(() => expect(first.history.location.pathname).toBe('/propiedades'));
    first.unmount();

    backend();
    const second = mountApp(`/verificar?redirect=${encodeURIComponent('//evil.com')}`);
    await userEvent.type(await screen.findByLabelText(es.auth.verify.code), '123456');
    await waitFor(() => expect(second.history.location.pathname).toBe('/'));
  });

  it('código inválido → alerta, el campo se vacía y recupera el foco', async () => {
    backend({ totp: invalidCode });
    const { history } = mountApp('/verificar');
    const input = await screen.findByLabelText(es.auth.verify.code);
    await userEvent.type(input, '000000');
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.errors.codeInvalid);
    await waitFor(() => expect(input).toHaveValue(''));
    await waitFor(() => expect(input).toHaveFocus());
    expect(history.location.pathname).toBe('/verificar');
  });

  it('código de respaldo: cambia el campo y envía a verify-backup-code', async () => {
    const seen = backend();
    const { history } = mountApp('/verificar');
    await userEvent.click(await screen.findByRole('button', { name: es.auth.verify.useBackup }));
    const field = await screen.findByLabelText(es.auth.verify.backupCode);
    expect(field).toHaveAttribute('autocomplete', 'off');
    await userEvent.type(field, 'abcde-12345');
    await userEvent.click(screen.getByRole('button', { name: es.auth.verify.submit }));
    await waitFor(() => expect(history.location.pathname).toBe('/'));
    expect(seen.backup).toEqual([{ code: 'abcde-12345' }]);
    expect(seen.totp).toEqual([]);
  });

  it('INVALID_TWO_FACTOR_COOKIE → mensaje de verificación vencida y salida a login', async () => {
    backend({
      totp: () =>
        HttpResponse.json(
          { code: 'INVALID_TWO_FACTOR_COOKIE', message: 'Invalid two factor cookie' },
          { status: 401 },
        ),
    });
    const { history } = mountApp('/verificar');
    await userEvent.type(await screen.findByLabelText(es.auth.verify.code), '123456');
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.errors.twoFactorExpired);
    await userEvent.click(screen.getByRole('button', { name: es.auth.verify.backToLogin }));
    await waitFor(() => expect(history.location.pathname).toBe('/iniciar-sesion'));
  });

  it('429 → muestra la espera y deshabilita la entrada', async () => {
    backend({
      totp: () =>
        HttpResponse.json(
          { message: 'Too many requests' },
          { status: 429, headers: { 'X-Retry-After': '30' } },
        ),
    });
    mountApp('/verificar');
    const input = await screen.findByLabelText(es.auth.verify.code);
    await userEvent.type(input, '123456');
    expect(await screen.findByRole('alert')).toHaveTextContent('30');
    await waitFor(() => expect(input).toBeDisabled());
    expect(screen.getByRole('button', { name: es.auth.verify.submit })).toBeDisabled();
  });

  it('completar el código y pulsar Verificar a la vez → una sola petición', async () => {
    const seen = backend({
      totp: async () => {
        await delay(50);
        return HttpResponse.json({ status: true });
      },
    });
    mountApp('/verificar');
    const user = userEvent.setup();
    const input = await screen.findByLabelText(es.auth.verify.code);
    const submit = screen.getByRole('button', { name: es.auth.verify.submit });
    await user.type(input, '123456');
    await user.click(submit);
    await screen.findByRole('heading', { level: 1, name: es.nav.home });
    expect(seen.totp).toHaveLength(1);
  });
});
