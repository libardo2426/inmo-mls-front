import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { featureBoundaryConfig } from './feature-boundaries.js';

async function lint(code, filePath) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: featureBoundaryConfig(['agencies', 'members']),
  });
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports');
}

describe('featureBoundaryConfig', () => {
  it('prohíbe importar de otra feature con alias', async () => {
    const msgs = await lint(
      "import x from '@/features/members/api';",
      'src/features/agencies/a.ts',
    );
    expect(msgs).toHaveLength(1);
  });

  it('prohíbe importar de otra feature con ruta relativa', async () => {
    const msgs = await lint("import x from '../members/api';", 'src/features/agencies/a.ts');
    expect(msgs).toHaveLength(1);
  });

  it('permite importar de la misma feature', async () => {
    const msgs = await lint("import x from '@/features/members/api';", 'src/features/members/b.ts');
    expect(msgs).toHaveLength(0);
  });

  it('con una sola feature produce una configuración válida y no prohíbe nada', async () => {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: featureBoundaryConfig(['auth']),
    });
    const [result] = await eslint.lintText("import x from '@/features/auth/api';", {
      filePath: 'src/features/auth/a.ts',
    });
    expect(result.messages.filter((m) => m.ruleId === 'no-restricted-imports')).toHaveLength(0);
    expect(result.fatalErrorCount).toBe(0);
  });

  it('permite importar de lib y components desde cualquier feature', async () => {
    const msgs = await lint(
      "import a from '@/lib/http'; import b from '@/components/shared/x';",
      'src/features/agencies/a.ts',
    );
    expect(msgs).toHaveLength(0);
  });
});
