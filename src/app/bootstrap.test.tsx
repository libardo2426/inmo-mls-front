import { createMemoryHistory } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '@/app/bootstrap';
import { es } from '@/lib/i18n/es';

const validConfig = {
  APP_ENV: 'development',
  API_BASE_PATH: '/v1',
  PLATFORM_API_BASE_PATH: '/plataforma/v1',
  TENANT_CODE: 'co',
};

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
  it('con config válida en / muestra el encabezado y el conmutador de tema', async () => {
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
});
