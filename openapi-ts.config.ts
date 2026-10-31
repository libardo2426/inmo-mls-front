import { defineConfig } from '@hey-api/openapi-ts';

// Genera solo tipos y schemas Zod (sin cliente HTTP): el único cliente es `src/lib/http`.
export default defineConfig({
  input: 'docs/backend/openapi.json',
  output: {
    path: 'src/lib/api/generated',
    clean: true,
  },
  plugins: ['@hey-api/typescript', 'zod'],
});
