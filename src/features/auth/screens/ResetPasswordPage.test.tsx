import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

const GOOD = 'una-clave-bien-larga-1';

function backend(
  respond: () => Response | Promise<Response> = () => HttpResponse.json({ status: true }),
) {
  const seen: unknown[] = [];
  server.use(
    http.get('*/v1/me', () =>
      HttpResponse.json(
        { title: 'x', status: 401, code: 'unauthorized' },
        { status: 401, headers: { 'content-type': 'application/problem+json' } },
      ),
    ),
    http.post('*/v1/auth/reset-password', async ({ request }) => {
      seen.push(await request.json());
      return respond();
    }),
  );
  return seen;
}

async function fill(password: string, confirm: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(es.auth.reset.password), password);
  await user.type(screen.getByLabelText(es.auth.reset.confirm), confirm);
  await user.click(screen.getByRole('button', { name: es.auth.reset.submit }));
  return user;
}

describe('ResetPasswordPage', () => {
  it('lee el token del hash y lo elimina de la ubicación al montar', async () => {
    backend();
    const { history } = mountApp('/restablecer#token=abc');
    expect(
      await screen.findByRole('heading', { level: 1, name: es.auth.reset.title }),
    ).toBeInTheDocument();
    await waitFor(() => expect(history.location.hash).toBe(''));
    expect(history.location.href).not.toContain('abc');
    expect(history.location.pathname).toBe('/restablecer');
  });

  it('los campos nuevos usan autocomplete="new-password"', async () => {
    backend();
    mountApp('/restablecer#token=abc');
    expect(await screen.findByLabelText(es.auth.reset.password)).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
    expect(screen.getByLabelText(es.auth.reset.confirm)).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
  });

  it('contraseña de 11 caracteres → error de longitud y ninguna petición', async () => {
    const seen = backend();
    mountApp('/restablecer#token=abc');
    await fill('a'.repeat(11), 'a'.repeat(11));
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.reset.tooShort);
    expect(seen).toEqual([]);
  });

  it('12 caracteres es suficiente', async () => {
    const seen = backend();
    mountApp('/restablecer#token=abc');
    await fill('a'.repeat(12), 'a'.repeat(12));
    await waitFor(() => expect(seen).toHaveLength(1));
  });

  it('confirmación distinta → error y ninguna petición', async () => {
    const seen = backend();
    mountApp('/restablecer#token=abc');
    await fill(GOOD, `${GOOD}x`);
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.reset.mismatch);
    expect(seen).toEqual([]);
  });

  it('envío correcto → { newPassword, token } y vuelve a login con el aviso', async () => {
    const seen = backend();
    const { history } = mountApp('/restablecer#token=abc');
    await fill(GOOD, GOOD);
    await waitFor(() => expect(history.location.pathname).toBe('/iniciar-sesion'));
    expect(seen).toEqual([{ newPassword: GOOD, token: 'abc' }]);
    expect(await screen.findByText(es.auth.reset.done)).toBeInTheDocument();
  });

  it('INVALID_TOKEN → tokenInvalid con enlace a /recuperar', async () => {
    backend(() =>
      HttpResponse.json({ code: 'INVALID_TOKEN', message: 'Invalid token' }, { status: 400 }),
    );
    const { history } = mountApp('/restablecer#token=vencido');
    await fill(GOOD, GOOD);
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.errors.tokenInvalid);
    await userEvent.click(screen.getByRole('link', { name: es.auth.reset.requestNew }));
    await waitFor(() => expect(history.location.pathname).toBe('/recuperar'));
  });

  it.each(['/restablecer', '/restablecer#token=', '/restablecer#otro=1'])(
    '%s → aviso de enlace inválido, sin formulario y sin petición',
    async (path) => {
      const seen = backend();
      const { history } = mountApp(path);
      expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.errors.tokenInvalid);
      expect(screen.queryByLabelText(es.auth.reset.password)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: es.auth.reset.submit })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('link', { name: es.auth.reset.requestNew }));
      await waitFor(() => expect(history.location.pathname).toBe('/recuperar'));
      expect(seen).toEqual([]);
    },
  );

  it('doble clic en Cambiar contraseña → una sola petición', async () => {
    const seen = backend(async () => {
      await delay(50);
      return HttpResponse.json({ status: true });
    });
    mountApp('/restablecer#token=abc');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(es.auth.reset.password), GOOD);
    await user.type(screen.getByLabelText(es.auth.reset.confirm), GOOD);
    await user.dblClick(screen.getByRole('button', { name: es.auth.reset.submit }));
    await screen.findByText(es.auth.reset.done);
    expect(seen).toHaveLength(1);
  });
});
