import { createMemoryHistory } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '@/app/bootstrap';
import { es } from '@/lib/i18n/es';
import { meFixture } from '@/test/fixtures';
import { validConfig } from '@/test/mount';
import { server } from '@/test/server';

let container: HTMLElement | undefined;

function mount(win: { __APP_CONFIG__?: unknown }, path: string) {
  container = document.createElement('div');
  document.body.appendChild(container);
  renderApp(container, win, createMemoryHistory({ initialEntries: [path] }));
}

afterEach(() => {
  container?.remove();
});

describe('renderApp', () => {
  it('con config válida y sesión, / muestra el encabezado y el conmutador de tema', async () => {
    server.use(http.get('*/v1/me', () => HttpResponse.json(meFixture())));
    mount({ __APP_CONFIG__: validConfig }, '/');
    expect(await screen.findByRole('heading', { name: es.app.name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: es.theme.toggle })).toBeInTheDocument();
  });

  it('en una ruta inexistente muestra "Página no encontrada"', async () => {
    mount({ __APP_CONFIG__: validConfig }, '/ruta-que-no-existe');
    expect(await screen.findByText(es.notFound.title)).toBeInTheDocument();
  });

  it('con config inválida muestra la pantalla de error y no monta el router', async () => {
    mount({ __APP_CONFIG__: { ...validConfig, TENANT_CODE: '' } }, '/');
    expect(await screen.findByRole('heading', { name: es.config.errorTitle })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: es.app.name })).toBeNull();
  });

  // Se completa en la pantalla de inicio de sesión (Task 5).
  it.todo('sin sesión, / redirige a /iniciar-sesion');
});
