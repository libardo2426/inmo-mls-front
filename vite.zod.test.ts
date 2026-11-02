import { describe, expect, it } from 'vitest';
import { zodJitlessFirst } from './vite.zod.ts';

const CONFIG = '/repo/src/lib/zod-config.ts';
const plugin = zodJitlessFirst(CONFIG);

function run(code: string, id: string) {
  const transform = plugin.transform as (code: string, id: string) => { code: string } | null;
  return transform.call({}, code, id);
}

describe('zodJitlessFirst', () => {
  it('antepone la importación de zod-config a un módulo de src que importa zod', () => {
    const out = run(`import { z } from 'zod';\nexport const s = z.string();`, '/repo/src/a.ts');
    expect(out?.code.startsWith(`import ${JSON.stringify(CONFIG)};\n`)).toBe(true);
    expect(out?.code).toContain(`export const s = z.string();`);
  });

  it.each([`import * as z from "zod";`, `import { z } from 'zod'`, `export * from 'zod';`])(
    'reconoce %s',
    (line) => {
      expect(run(line, '/repo/src/b.ts')).not.toBeNull();
    },
  );

  it('también cubre el código generado', () => {
    expect(
      run(`import * as z from 'zod';`, '/repo/src/lib/api/generated/zod.gen.ts'),
    ).not.toBeNull();
  });

  it('ignora el id con parámetros de consulta de Vite', () => {
    expect(run(`import { z } from 'zod';`, '/repo/src/c.tsx?v=123')).not.toBeNull();
  });

  it.each([
    ['un módulo que no importa zod', `import { x } from 'otra-cosa';`, '/repo/src/d.ts'],
    ['un módulo de node_modules', `import { z } from 'zod';`, '/repo/node_modules/pkg/index.js'],
    ['el propio zod-config', `import { z } from 'zod';`, CONFIG],
    ['un archivo fuera de src', `import { z } from 'zod';`, '/repo/e2e/x.ts'],
    [
      'un módulo que ya lo importa',
      `import '${CONFIG}';\nimport { z } from 'zod';`,
      '/repo/src/e.ts',
    ],
  ])('no toca %s', (_name, code, id) => {
    expect(run(code, id)).toBeNull();
  });
});
