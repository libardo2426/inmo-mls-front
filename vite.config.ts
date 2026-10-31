import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { buildProxy } from './vite.proxy.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
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
      globals: false,
    },
  };
});
