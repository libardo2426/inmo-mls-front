import { QueryClient } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { RouterContext } from '@/app/router-context';
import { ApiError, createHttpClient } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { validConfig } from '@/test/mount';
import { loadConfig } from '@/lib/config';
import { RouteErrorBoundary } from './RouteErrorBoundary';

describe('RouteErrorBoundary — Reintentar', () => {
  it('vuelve a cargar la ruta y muestra el contenido cuando el servidor ya responde', async () => {
    let calls = 0;
    const http = createHttpClient({
      config: loadConfig({ __APP_CONFIG__: validConfig }),
      origin: 'http://localhost:3000',
    });
    const root = createRootRouteWithContext<RouterContext>()({ component: Outlet });
    const page = createRoute({
      getParentRoute: () => root,
      path: '/',
      beforeLoad: () => {
        calls += 1;
        if (calls === 1) {
          throw new ApiError({ status: 500, code: 'internal', title: 'Servicio caído' });
        }
      },
      component: () => <p>cargó bien</p>,
    });
    const router = createRouter({
      routeTree: root.addChildren([page]),
      context: { queryClient: new QueryClient(), http },
      history: createMemoryHistory({ initialEntries: ['/'] }),
      defaultErrorComponent: RouteErrorBoundary,
    });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Servicio caído')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: es.states.retry }));
    expect(await screen.findByText('cargó bien')).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});
