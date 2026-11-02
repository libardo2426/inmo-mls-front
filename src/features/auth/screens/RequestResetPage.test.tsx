import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

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
    http.post('*/v1/auth/request-password-reset', async ({ request }) => {
      seen.push(await request.json());
      return respond();
    }),
  );
  return seen;
}

async function submit(email: string) {
  const user = userEvent.setup();
  const field = await screen.findByLabelText(es.auth.recover.email);
  if (email !== '') await user.type(field, email);
  await user.click(screen.getByRole('button', { name: es.auth.recover.submit }));
  return user;
}

describe('RequestResetPage', () => {
  it('muestra el título y un campo de correo', async () => {
    backend();
    mountApp('/recuperar');
    expect(
      await screen.findByRole('heading', { level: 1, name: es.auth.recover.title }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(es.auth.recover.email)).toHaveAttribute('type', 'email');
  });

  it.each(['', 'no-es-un-correo'])(
    'correo %j → error de validación y ninguna petición',
    async (email) => {
      const seen = backend();
      mountApp('/recuperar');
      await submit(email);
      expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.recover.validation);
      expect(seen).toEqual([]);
    },
  );

  it('envío correcto → mensaje fijo y se envía { email }', async () => {
    const seen = backend();
    mountApp('/recuperar');
    await submit('admin@innmo.test');
    expect(await screen.findByText(es.auth.recover.sent)).toBeInTheDocument();
    expect(seen).toEqual([{ email: 'admin@innmo.test' }]);
  });

  it('un 400 por correo inexistente muestra el mismo mensaje (sin enumerar cuentas)', async () => {
    backend(() =>
      HttpResponse.json({ code: 'USER_NOT_FOUND', message: 'User not found' }, { status: 400 }),
    );
    mountApp('/recuperar');
    await submit('nadie@innmo.test');
    expect(await screen.findByText(es.auth.recover.sent)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('429 → muestra la espera y deshabilita el botón', async () => {
    backend(() =>
      HttpResponse.json(
        { message: 'Too many requests' },
        { status: 429, headers: { 'X-Retry-After': '120' } },
      ),
    );
    mountApp('/recuperar');
    await submit('admin@innmo.test');
    expect(await screen.findByRole('alert')).toHaveTextContent('120');
    expect(screen.getByRole('button', { name: es.auth.recover.submit })).toBeDisabled();
    expect(screen.queryByText(es.auth.recover.sent)).not.toBeInTheDocument();
  });

  it('doble clic → una sola petición', async () => {
    const seen = backend(async () => {
      await delay(50);
      return HttpResponse.json({ status: true });
    });
    mountApp('/recuperar');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(es.auth.recover.email), 'admin@innmo.test');
    await user.dblClick(screen.getByRole('button', { name: es.auth.recover.submit }));
    await screen.findByText(es.auth.recover.sent);
    expect(seen).toHaveLength(1);
  });

  it('el enlace «Volver» lleva a /iniciar-sesion', async () => {
    backend();
    const { history } = mountApp('/recuperar');
    await userEvent.click(await screen.findByRole('link', { name: es.auth.recover.backToLogin }));
    await waitFor(() => expect(history.location.pathname).toBe('/iniciar-sesion'));
  });
});
