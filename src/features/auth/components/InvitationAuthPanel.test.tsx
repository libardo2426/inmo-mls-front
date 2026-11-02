import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import { loadConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { validConfig } from '@/test/mount';
import { server } from '@/test/server';
import { InvitationAuthPanel } from './InvitationAuthPanel';

const config = loadConfig({ __APP_CONFIG__: validConfig });
const t = es.auth.invitation;
const GOOD = 'una-clave-larga-1';

const authError = (status: number, code: string) =>
  HttpResponse.json(
    { code, message: 'x' },
    { status, headers: { 'content-type': 'application/json' } },
  );

type Calls = { signUp: unknown[]; signIn: unknown[]; signOut: number };

function backend(overrides: { signUp?: () => Response; signIn?: () => Response } = {}): Calls {
  const calls: Calls = { signUp: [], signIn: [], signOut: 0 };
  server.use(
    http.post('*/v1/auth/sign-up/email', async ({ request }) => {
      calls.signUp.push(await request.json());
      return overrides.signUp?.() ?? HttpResponse.json({ token: null, user: {} });
    }),
    http.post('*/v1/auth/sign-in/email', async ({ request }) => {
      calls.signIn.push(await request.json());
      return overrides.signIn?.() ?? HttpResponse.json({ redirect: false, token: 't', user: {} });
    }),
    http.post('*/v1/auth/sign-out', () => {
      calls.signOut += 1;
      return HttpResponse.json({ success: true });
    }),
  );
  return calls;
}

function setup(signedIn = false) {
  const onChanged = vi.fn();
  const client = createHttpClient({ config, origin: 'http://localhost:3000' });
  render(
    <Providers config={config} queryClient={createQueryClient()} http={client}>
      <InvitationAuthPanel
        email="nuevo@demo.test"
        fullName="Nuevo Demo"
        signedIn={signedIn}
        onChanged={onChanged}
      />
    </Providers>,
  );
  return { onChanged };
}

const password = () => screen.getByLabelText(t.password);
const submitCreate = () => screen.getByRole('button', { name: t.submitCreate });

describe('InvitationAuthPanel', () => {
  it('el correo viene de la invitación y no se puede editar; el nombre va prellenado', () => {
    setup();
    expect(screen.getByLabelText(t.email)).toHaveValue('nuevo@demo.test');
    expect(screen.getByLabelText(t.email)).toHaveAttribute('readonly');
    expect(screen.getByLabelText(t.name)).toHaveValue('Nuevo Demo');
  });

  it('una contraseña de 11 caracteres deshabilita enviar; con 12 se habilita', async () => {
    setup();
    await userEvent.type(password(), 'a'.repeat(11));
    expect(submitCreate()).toBeDisabled();
    await userEvent.type(password(), 'a');
    expect(submitCreate()).toBeEnabled();
  });

  it('crear cuenta hace sign-up, luego sign-in y avisa una sola vez', async () => {
    const calls = backend();
    const { onChanged } = setup();
    await userEvent.type(password(), GOOD);
    await userEvent.click(submitCreate());
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(calls.signUp).toEqual([
      { name: 'Nuevo Demo', email: 'nuevo@demo.test', password: GOOD },
    ]);
    expect(calls.signIn).toEqual([{ email: 'nuevo@demo.test', password: GOOD }]);
  });

  it('USER_ALREADY_EXISTS muestra su mensaje y ofrece pasar a «Ya tengo cuenta»', async () => {
    backend({ signUp: () => authError(422, 'USER_ALREADY_EXISTS') });
    setup();
    await userEvent.type(password(), GOOD);
    await userEvent.click(submitCreate());
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.errors.userExists);
    await userEvent.click(screen.getByRole('button', { name: t.switchToSignIn }));
    expect(screen.getByRole('button', { name: t.submitSignIn })).toBeVisible();
    expect(screen.getByLabelText(t.email)).toHaveValue('nuevo@demo.test');
  });

  it('«Ya tengo cuenta» solo inicia sesión con el correo bloqueado', async () => {
    const calls = backend();
    const { onChanged } = setup();
    await userEvent.click(screen.getByRole('tab', { name: t.haveAccount }));
    expect(screen.getByLabelText(t.email)).toHaveAttribute('readonly');
    await userEvent.type(password(), 'cualquier-clave');
    await userEvent.click(screen.getByRole('button', { name: t.submitSignIn }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(calls.signUp).toHaveLength(0);
    expect(calls.signIn).toEqual([{ email: 'nuevo@demo.test', password: 'cualquier-clave' }]);
  });

  it('EMAIL_NOT_VERIFIED en el sign-in pide revisar el correo', async () => {
    backend({ signIn: () => authError(403, 'EMAIL_NOT_VERIFIED') });
    const { onChanged } = setup();
    await userEvent.type(password(), GOOD);
    await userEvent.click(submitCreate());
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.errors.emailNotVerified);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('429 deshabilita el envío durante la cuenta atrás', async () => {
    const calls = backend({
      signUp: () =>
        HttpResponse.json(
          { code: 'RATE_LIMITED', message: 'x' },
          { status: 429, headers: { 'Retry-After': '30' } },
        ),
    });
    setup();
    await userEvent.type(password(), GOOD);
    await userEvent.click(submitCreate());
    expect(await screen.findByRole('alert')).toHaveTextContent(es.auth.errors.rateLimited(30));
    expect(submitCreate()).toBeDisabled();
    expect(calls.signUp).toHaveLength(1);
  });

  it('con sesión iniciada muestra «Usar otra cuenta» y al pulsarlo cierra sesión', async () => {
    const calls = backend();
    const { onChanged } = setup(true);
    expect(screen.getByText(t.signedIn)).toBeVisible();
    expect(screen.queryByLabelText(t.password)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.useOtherAccount }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(calls.signOut).toBe(1);
  });
});
