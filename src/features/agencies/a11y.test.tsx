import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { es } from '@/lib/i18n/es';
import { agencyDetailFixture, agencySummaryFixture, meWithPermissions } from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

const ID = agencyDetailFixture().id;
const REVIEWER = meWithPermissions({
  'agency.list': 'network',
  'agency.approve': 'network',
  'agency.request_changes': 'network',
  'agency.reject': 'network',
});

function accessibleName(element: Element): string {
  return element.getAttribute('aria-label') || (element.textContent ?? '').trim();
}

function useBackend() {
  server.use(
    http.get('*/v1/me', () => HttpResponse.json(REVIEWER)),
    http.get('*/v1/agencies', () =>
      HttpResponse.json({ items: [agencySummaryFixture()], nextCursor: null }),
    ),
    http.get(`*/v1/agencies/${ID}`, () => HttpResponse.json(agencyDetailFixture())),
    http.get('*/v1/territory/units/co/:level', () =>
      HttpResponse.json({ items: [], nextCursor: null }),
    ),
  );
}

describe('accesibilidad de agencias', () => {
  it('el listado tiene un único h1, una tabla con encabezados y controles con nombre', async () => {
    useBackend();
    mountApp('/agencias');
    await screen.findByText('Inmobiliaria Demo');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const table = screen.getByRole('table', { name: es.agencies.list.caption });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(5);
    for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
      expect(accessibleName(control), control.outerHTML).not.toBe('');
    }
    expect(screen.getByRole('combobox', { name: es.agencies.list.filterLabel })).toBeVisible();
  });

  it('Enter sobre una fila abre el detalle', async () => {
    useBackend();
    const { history } = mountApp('/agencias');
    await screen.findByText('Inmobiliaria Demo');
    screen.getByRole('row', { name: /Inmobiliaria Demo/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(history.location.pathname).toBe(`/agencias/${ID}`);
  });

  it('el detalle tiene un único h1 y todo control tiene nombre', async () => {
    useBackend();
    mountApp(`/agencias/${ID}`);
    await screen.findByRole('heading', { level: 1, name: 'Inmobiliaria Demo' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
      expect(accessibleName(control), control.outerHTML).not.toBe('');
    }
  });

  it('el diálogo recibe el foco, se cierra con Escape y el foco vuelve al botón que lo abrió', async () => {
    useBackend();
    mountApp(`/agencias/${ID}`);
    await screen.findByRole('heading', { level: 1, name: 'Inmobiliaria Demo' });
    const opener = screen.getByRole('button', { name: es.agencies.review.actions.reject });
    await userEvent.click(opener);
    const dialog = await screen.findByRole('dialog', { name: es.agencies.review.titles.reject });
    expect(dialog.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard('{Escape}');
    await waitForDialogClosed();
    expect(opener).toHaveFocus();
  });
});

async function waitForDialogClosed() {
  await screen.findByRole('button', { name: es.agencies.review.actions.reject });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
}
