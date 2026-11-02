import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { meFixture } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

function accessibleName(element: Element): string {
  const aria = element.getAttribute('aria-label');
  if (aria) return aria;
  return (element.textContent ?? '').trim();
}

describe('accesibilidad del shell', () => {
  it('tiene los landmarks y todo control interactivo tiene nombre', async () => {
    server.use(http.get('*/v1/me', () => HttpResponse.json(meFixture())));
    mountApp('/');
    await screen.findByRole('navigation', { name: es.shell.mainNav });
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
      expect(accessibleName(control), control.outerHTML).not.toBe('');
    }
  });

  it('el botón de plegar y el menú de usuario se alcanzan con el teclado', async () => {
    server.use(http.get('*/v1/me', () => HttpResponse.json(meFixture())));
    mountApp('/');
    const nav = await screen.findByRole('navigation', { name: es.shell.mainNav });
    const toggle = screen.getByRole('button', { name: es.shell.toggleMenu });
    toggle.focus();
    expect(toggle).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab();
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: es.theme.toggle }),
    ).toBeVisible();
    expect(within(nav).getByRole('link', { name: es.nav.home })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
