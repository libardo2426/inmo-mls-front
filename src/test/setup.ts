import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '@/test/server';

// El primer render de una ruta carga su chunk perezoso; con la suite en paralelo 1 s no alcanza.
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => {
  // jsdom no implementa scrollTo; el router lo invoca al navegar.
  window.scrollTo = () => undefined;
  // jsdom no implementa elementFromPoint; input-otp lo usa para detectar el gestor de contraseñas.
  document.elementFromPoint = () => null;
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
