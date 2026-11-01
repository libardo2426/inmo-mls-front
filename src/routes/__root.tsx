import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { RouterContext } from '@/app/router-context';
import { es } from '@/lib/i18n/es';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: () => (
    <main>
      <h1>{es.notFound.title}</h1>
      <p>{es.notFound.help}</p>
    </main>
  ),
});
