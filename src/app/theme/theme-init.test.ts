import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import script from '../../../public/theme-init.js?raw';

function runScript() {
  new Function(script)();
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('public/theme-init.js', () => {
  it('aplica la clase dark si innmo-theme es dark', () => {
    localStorage.setItem('innmo-theme', 'dark');
    runScript();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('sin valor guardado respeta la preferencia oscura del sistema', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn() }),
    );
    runScript();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('no lanza si localStorage lanza', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => runScript()).not.toThrow();
  });
});
