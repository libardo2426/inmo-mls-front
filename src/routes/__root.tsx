import { createRootRoute, Outlet } from '@tanstack/react-router';
import { es } from '@/lib/i18n/es';

export const Route = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <main>
      <h1>{es.notFound.title}</h1>
      <p>{es.notFound.help}</p>
    </main>
  ),
});
