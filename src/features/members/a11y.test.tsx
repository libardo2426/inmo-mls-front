import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { agencyDetailFixture, memberFixture, meWithPermissions } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

const ID = agencyDetailFixture().id;
const ADMIN = meWithPermissions({
  'agency.list': 'network',
  'member.read': 'network',
  'member.terminate_any': 'network',
});

function accessibleName(element: Element): string {
  return element.getAttribute('aria-label') || (element.textContent ?? '').trim();
}

function useBackend() {
  server.use(
    http.get('*/v1/me', () => HttpResponse.json(ADMIN)),
    http.get(`*/v1/agencies/${ID}`, () => HttpResponse.json(agencyDetailFixture())),
    http.get(`*/v1/agencies/${ID}/members`, () => HttpResponse.json([memberFixture()])),
    http.get('*/v1/territory/units/co/:level', () =>
      HttpResponse.json({ items: [], nextCursor: null }),
    ),
  );
}

describe('accesibilidad de miembros', () => {
  it('la sección es una región con tabla con nombre, encabezados y botones con nombre', async () => {
    useBackend();
    mountApp(`/agencias/${ID}`);
    const region = await screen.findByRole('region', { name: es.members.title });
    await within(region).findByText('Luis Demo');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const table = within(region).getByRole('table', { name: es.members.caption });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(6);
    for (const button of within(table).getAllByRole('button')) {
      expect(accessibleName(button), button.outerHTML).not.toBe('');
    }
  });

  it('el diálogo tiene título, campo con etiqueta y devuelve el foco al cerrar', async () => {
    useBackend();
    mountApp(`/agencias/${ID}`);
    const opener = await screen.findByRole('button', {
      name: es.members.terminate.actionFor('Luis Demo'),
    });
    await userEvent.click(opener);
    const dialog = await screen.findByRole('dialog', {
      name: es.members.terminate.title('Luis Demo'),
    });
    expect(
      within(dialog).getByRole('textbox', { name: es.members.terminate.reasonLabel }),
    ).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole('button', { name: es.members.terminate.cancel }),
    );
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
