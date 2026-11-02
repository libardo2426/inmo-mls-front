import { RouterProvider, type RouterHistory } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigErrorScreen } from '@/app/ConfigErrorScreen';
import { Providers } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import { createAppRouter } from '@/app/router';
import { installAuthHandlers } from '@/features/auth/session/handlers';
import { ConfigError, loadConfig } from '@/lib/config';
import { createHttpClient } from '@/lib/http';

/**
 * Valida la configuración de runtime y monta la app. Si es inválida, muestra
 * la pantalla de error y NO monta el router. `history` permite probar rutas.
 */
export function renderApp(
  container: HTMLElement,
  win: { __APP_CONFIG__?: unknown },
  history?: RouterHistory,
): () => void {
  const root = createRoot(container);
  try {
    const config = loadConfig(win);
    const queryClient = createQueryClient();
    const http = createHttpClient({ config });
    const router = createAppRouter({ queryClient, http, ...(history ? { history } : {}) });
    installAuthHandlers({
      queryClient,
      navigate: (target) => void router.navigate(target as Parameters<typeof router.navigate>[0]),
      currentPath: () => router.state.location.href,
    });
    root.render(
      <StrictMode>
        <Providers config={config} queryClient={queryClient} http={http}>
          <RouterProvider router={router} />
        </Providers>
      </StrictMode>,
    );
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    root.render(<ConfigErrorScreen error={error} />);
  }
  return () => root.unmount();
}
