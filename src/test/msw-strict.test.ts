import { describe, expect, it, vi } from 'vitest';

describe('MSW en modo estricto (CA11)', () => {
  it('una petición sin handler es interceptada por MSW y falla', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(globalThis.fetch('http://localhost:3000/v1/sin-handler')).rejects.toThrow();
    const logged = consoleError.mock.calls.map((call) => String(call[0])).join('\n');
    consoleError.mockRestore();
    expect(logged).toContain(
      '[MSW] Error: intercepted a request without a matching request handler',
    );
  });
});
