import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { MeResponse } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';
import { agentMeFixture, meFixture } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

/** `/me` responde con `me` hasta que se renuncia; después, 403 `no_membership`. */
function backend(me: MeResponse) {
  const state = { left: 0 };
  server.use(
    http.get('*/v1/me', () =>
      state.left > 0
        ? HttpResponse.json(
            { title: 'x', status: 403, code: 'no_membership' },
            { status: 403, headers: { 'content-type': 'application/problem+json' } },
          )
        : HttpResponse.json(me),
    ),
    http.post('*/v1/members/me/leave', () => {
      state.left += 1;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return state;
}

async function openMenu() {
  await userEvent.click(await screen.findByRole('button', { name: es.shell.userMenu }));
}

describe('menú de usuario: dejar la inmobiliaria', () => {
  it('un agent ve «Dejar la inmobiliaria»; confirmar renuncia y lleva a /sin-acceso', async () => {
    const state = backend(agentMeFixture());
    const { history } = mountApp('/');
    await openMenu();
    await userEvent.click(await screen.findByRole('menuitem', { name: es.members.leave.menu }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      await within(dialog).findByRole('button', { name: es.members.leave.submit }),
    );
    await vi.waitFor(() => expect(history.location.pathname).toBe('/sin-acceso'));
    expect(state.left).toBe(1);
  });

  it('el personal del MLS (sin inmobiliaria) no ve la opción', async () => {
    backend(meFixture());
    mountApp('/');
    await openMenu();
    expect(await screen.findByRole('menuitem', { name: es.shell.logout })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: es.members.leave.menu })).not.toBeInTheDocument();
  });
});
