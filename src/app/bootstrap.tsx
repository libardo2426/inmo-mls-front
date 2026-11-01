import { RouterProvider, type RouterHistory } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigErrorScreen } from '@/app/ConfigErrorScreen';
import { Providers } from '@/app/providers';
import { createAppRouter } from '@/app/router';
import { ConfigError, loadConfig } from '@/lib/config';

/**
 * Valida la configuración de runtime y monta la app. Si es inválida, muestra
 * la pantalla de error y NO monta el router. `history` permite probar rutas.
 */
export function renderApp(
  container: HTMLElement,
  win: { __APP_CONFIG__?: unknown },
  history?: RouterHistory,
): void {
  const root = createRoot(container);
  try {
    const config = loadConfig(win);
    const router = createAppRouter(history);
    root.render(
      <StrictMode>
        <Providers config={config}>
          <RouterProvider router={router} />
        </Providers>
      </StrictMode>,
    );
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    root.render(<ConfigErrorScreen error={error} />);
  }
}
