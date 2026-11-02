import { createRouter, type RouterHistory } from '@tanstack/react-router';
import type { RouterContext } from '@/app/router-context';
import { routeTree } from '@/routeTree.gen';

export function createAppRouter(options: RouterContext & { history?: RouterHistory }) {
  const { history, ...context } = options;
  return createRouter({ routeTree, context, ...(history ? { history } : {}) });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
