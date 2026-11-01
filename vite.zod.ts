import type { Plugin } from 'vite';

const IMPORTS_ZOD = /\bfrom\s*['"]zod['"]/;

/**
 * Zod 4 sondea `new Function` al construir el primer esquema y la CSP (sin 'unsafe-eval') lo
 * reporta como violación aunque Zod lo capture. `zod-config` lo evita con `jitless`, pero solo
 * si se evalúa antes que cualquier esquema; con carga por rutas, el orden de los chunks no lo
 * garantiza. Este plugin hace que todo módulo de `src` que importa `zod` dependa de `zod-config`,
 * de modo que el orden lo fija el grafo de dependencias (también para el código generado).
 */
export function zodJitlessFirst(zodConfigPath: string): Plugin {
  const statement = `import ${JSON.stringify(zodConfigPath)};\n`;
  return {
    name: 'zod-jitless-first',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0] ?? id;
      if (file === zodConfigPath || file.includes('/node_modules/') || !file.includes('/src/')) {
        return null;
      }
      if (!IMPORTS_ZOD.test(code) || code.includes(zodConfigPath)) return null;
      return { code: statement + code, map: null };
    },
  };
}
