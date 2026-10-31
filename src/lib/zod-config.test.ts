import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import '@/lib/zod-config';

describe('zod-config', () => {
  it('desactiva la compilación JIT de Zod (usa new Function, bloqueado por la CSP sin unsafe-eval)', () => {
    expect(z.core.globalConfig.jitless).toBe(true);
  });
});
