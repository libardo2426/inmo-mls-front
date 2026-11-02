import { QueryClient } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { Providers } from '@/app/providers';
import type { RouterContext } from '@/app/router-context';
import { enforce } from '@/features/auth/session/enforce';
import { loadConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { assertCan } from '@/lib/permissions';
import { meFixture } from '@/test/fixtures';
import { validConfig } from '@/test/mount';
import { server } from '@/test/server';
import { AppShell } from './AppShell';
import { RouteErrorBoundary } from './RouteErrorBoundary';

/** App mínima: el shell real y una ruta hija que exige `agency.approve`. */
function mountGuardedApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const config = loadConfig({ __APP_CONFIG__: validConfig });
  const client = createHttpClient({ config, origin: 'http://localhost:3000' });
  const root = createRootRouteWithContext<RouterContext>()({ component: Outlet });
  const shell = createRoute({
    getParentRoute: () => root,
    id: '_shell',
    beforeLoad: async ({ context, location }) => {
      const state = await enforce('protected', { context, location });
      if (state.status !== 'authenticated') throw new Error('sin sesión');
      return { me: state.me };
    },
    component: AppShell,
  });
  const secret = createRoute({
    getParentRoute: () => shell,
    path: '/secreto',
    beforeLoad: ({ context }) => assertCan(context.me, 'agency.approve'),
    component: () => <p>contenido secreto</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([shell.addChildren([secret])]),
    context: { queryClient, http: client },
    history: createMemoryHistory({ initialEntries: ['/secreto'] }),
    defaultErrorComponent: RouteErrorBoundary,
  });
  render(
    <Providers config={config} queryClient={queryClient} http={client}>
      <RouterProvider router={router} />
    </Providers>,
  );
}

function meWith(permissions: Record<string, 'own' | 'agency' | 'network'>) {
  const me = meFixture();
  if (!me.membership) throw new Error('la fixture debe traer membresía');
  return { ...me, membership: { ...me.membership, permissions } };
}

describe('ruta con permiso dentro del shell', () => {
  it('sin el permiso muestra «sin permiso» con el menú visible y sin nombrar el permiso', async () => {
    server.use(http.get('*/v1/me', () => HttpResponse.json(meWith({ 'agency.read': 'network' }))));
    mountGuardedApp();
    expect(await screen.findByText(es.states.forbiddenTitle)).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation')).getByRole('link', { name: es.nav.home }),
    ).toBeVisible();
    expect(screen.queryByText('contenido secreto')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('agency.approve');
  });

  it('con el permiso muestra el contenido de la ruta', async () => {
    server.use(
      http.get('*/v1/me', () => HttpResponse.json(meWith({ 'agency.approve': 'network' }))),
    );
    mountGuardedApp();
    expect(await screen.findByText('contenido secreto')).toBeInTheDocument();
    expect(screen.queryByText(es.states.forbiddenTitle)).not.toBeInTheDocument();
  });
});
