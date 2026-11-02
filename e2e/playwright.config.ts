import { defineConfig, devices } from '@playwright/test';

// El e2e corre en local, en Docker, contra la imagen servida por Nginx (no corre en CI).
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  reporter: [['list']],
  // En Docker se redirige a /tmp para que el contenedor (root) no deje archivos en el repositorio.
  outputDir: process.env.PW_OUTPUT_DIR ?? '../test-results',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    colorScheme: 'light',
    locale: 'es-CO',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
