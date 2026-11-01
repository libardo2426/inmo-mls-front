import { createMemoryHistory, type RouterHistory } from '@tanstack/react-router';
import { act } from '@testing-library/react';
import { afterEach } from 'vitest';
import { renderApp } from '@/app/bootstrap';

export const validConfig = {
  APP_ENV: 'development',
  API_BASE_PATH: '/v1',
  PLATFORM_API_BASE_PATH: '/plataforma/v1',
  TENANT_CODE: 'co',
};

const mounted: Array<() => void> = [];

// Cada test empieza sin restos de la app del anterior.
afterEach(() => {
  act(() => {
    for (const unmount of mounted.splice(0)) unmount();
  });
});

/**
 * Monta la app completa (config, router, providers) en una ruta; los tests mockean la red con MSW.
 * `history.location` permite comprobar a qué ruta terminó navegando la app.
 */
export function mountApp(path: string): {
  container: HTMLElement;
  history: RouterHistory;
  unmount: () => void;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const history = createMemoryHistory({ initialEntries: [path] });
  const unrender = renderApp(container, { __APP_CONFIG__: validConfig }, history);
  const unmount = () => {
    unrender();
    container.remove();
  };
  mounted.push(unmount);
  return { container, history, unmount };
}
