import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';
import { buildProxy } from './vite.proxy.ts';
import { zodJitlessFirst } from './vite.zod.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      // Garantiza que `zod-config` (jitless) se evalúe antes que cualquier esquema de Zod.
      zodJitlessFirst(fileURLToPath(new URL('./src/lib/zod-config.ts', import.meta.url))),
      // Debe ir antes de react(): genera `src/routeTree.gen.ts` y divide el código por ruta.
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: 'app.localtest.me',
      port: 5173,
      proxy: buildProxy({
        API_TARGET: env.API_TARGET ?? 'http://localhost:3000',
        TENANT_CODE: env.TENANT_CODE ?? 'co',
        PLATFORM_HOST: env.PLATFORM_HOST ?? 'admin.api.localtest.me',
      }),
    },
    build: {
      sourcemap: false,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      // Los *.spec.ts de e2e/ son de Playwright (corren en Docker), no de Vitest.
      exclude: [...configDefaults.exclude, 'e2e/**', '.claude/**', '.superpowers/**'],
      globals: false,
      // Debe superar a `asyncUtilTimeout` (src/test/setup.ts) para que el fallo sea el de la aserción.
      testTimeout: 15_000,
    },
  };
});
