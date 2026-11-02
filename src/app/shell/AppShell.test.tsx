import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import type { MeResponse } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';
import { meFixture } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

afterEach(() => localStorage.clear());

/** `/me` responde con `me` hasta cerrar sesión; después, 401. */
function backend(me: MeResponse = meFixture()) {
  const state = { signedOut: false, signOutCalls: 0 };
  server.use(
    http.get('*/v1/me', () =>
      state.signedOut
        ? HttpResponse.json(
            { title: 'x', status: 401, code: 'unauthorized' },
            { status: 401, headers: { 'content-type': 'application/problem+json' } },
          )
        : HttpResponse.json(me),
    ),
    http.post('*/v1/auth/sign-out', () => {
      state.signOutCalls += 1;
      state.signedOut = true;
      return HttpResponse.json({ success: true });
    }),
  );
  return state;
}

function meWith(permissions: Record<string, 'own' | 'agency' | 'network'>, email?: string) {
  const me = meFixture();
  if (!me.membership) throw new Error('la fixture debe traer membresía');
  return {
    ...me,
    user: { ...me.user, ...(email ? { email } : {}) },
    membership: { ...me.membership, permissions },
  };
}

const sidebar = () => document.querySelector('[data-slot="sidebar"]');

describe('AppShell', () => {
  it('el menú tiene Inicio como página actual', async () => {
    backend();
    mountApp('/');
    const nav = await screen.findByRole('navigation');
    const link = within(nav).getByRole('link', { name: es.nav.home });
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('con una membresía sin permisos el shell abre y el menú solo tiene Inicio', async () => {
    backend(meWith({}));
    mountApp('/');
    const nav = await screen.findByRole('navigation');
    expect(within(nav).getAllByRole('link')).toHaveLength(1);
  });

  it('el botón de plegar alterna el menú con el teclado y el enlace sigue accesible', async () => {
    backend();
    mountApp('/');
    const toggle = await screen.findByRole('button', { name: es.shell.toggleMenu });
    expect(sidebar()).toHaveAttribute('data-state', 'expanded');
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    expect(sidebar()).toHaveAttribute('data-state', 'collapsed');
    expect(screen.getByRole('link', { name: es.nav.home })).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(sidebar()).toHaveAttribute('data-state', 'expanded');
  });

  it('recuerda el menú plegado al volver a abrir la app', async () => {
    backend();
    const first = mountApp('/');
    await userEvent.click(await screen.findByRole('button', { name: es.shell.toggleMenu }));
    expect(sidebar()).toHaveAttribute('data-state', 'collapsed');
    first.unmount();
    mountApp('/');
    await screen.findByRole('button', { name: es.shell.toggleMenu });
    expect(sidebar()).toHaveAttribute('data-state', 'collapsed');
  });

  it('el menú de usuario muestra el correo y el país', async () => {
    backend();
    mountApp('/');
    await userEvent.click(await screen.findByRole('button', { name: es.shell.userMenu }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('admin@innmo.test')).toBeInTheDocument();
    expect(within(menu).getByText(/Colombia/)).toBeInTheDocument();
  });

  it('abrir el menú de usuario no inyecta <style> con texto (la CSP solo admite <style> vacíos)', async () => {
    backend();
    mountApp('/');
    await userEvent.click(await screen.findByRole('button', { name: es.shell.userMenu }));
    await screen.findByRole('menu');
    const withText = [...document.querySelectorAll('style')].filter((el) => el.textContent?.trim());
    expect(withText).toHaveLength(0);
  });

  it('un correo larguísimo se trunca en el menú de usuario', async () => {
    const long = `${'a'.repeat(70)}@innmo.test`;
    backend(meWith({}, long));
    mountApp('/');
    await userEvent.click(await screen.findByRole('button', { name: es.shell.userMenu }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText(long)).toHaveClass('truncate');
  });

  it('Cerrar sesión llama a sign-out y lleva a /iniciar-sesion', async () => {
    const state = backend();
    const { history } = mountApp('/');
    await userEvent.click(await screen.findByRole('button', { name: es.shell.userMenu }));
    await userEvent.click(await screen.findByRole('menuitem', { name: es.shell.logout }));
    await waitFor(() => expect(history.location.pathname).toBe('/iniciar-sesion'));
    expect(state.signOutCalls).toBe(1);
    expect(
      await screen.findByRole('heading', { level: 1, name: es.auth.login.title }),
    ).toBeInTheDocument();
  });

  it('tras cerrar sesión, / redirige a /iniciar-sesion?redirect=%2F (la caché ya no tiene [me])', async () => {
    backend();
    const { history } = mountApp('/');
    await userEvent.click(await screen.findByRole('button', { name: es.shell.userMenu }));
    await userEvent.click(await screen.findByRole('menuitem', { name: es.shell.logout }));
    await waitFor(() => expect(history.location.pathname).toBe('/iniciar-sesion'));
    history.push('/');
    await waitFor(() => expect(history.location.search).toBe('?redirect=%2F'));
    expect(history.location.pathname).toBe('/iniciar-sesion');
  });

  it('conserva el cambio de tema en la cabecera', async () => {
    backend();
    mountApp('/');
    expect(await screen.findByRole('button', { name: es.theme.toggle })).toBeInTheDocument();
  });
});
