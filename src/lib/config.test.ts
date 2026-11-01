import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, parseConfig } from '@/lib/config';

const valid = {
  APP_ENV: 'development',
  API_BASE_PATH: '/v1',
  PLATFORM_API_BASE_PATH: '/plataforma/v1',
  TENANT_CODE: 'co',
};

describe('parseConfig', () => {
  it('acepta una configuración válida', () => {
    expect(parseConfig(valid)).toEqual(valid);
  });

  it('exige que las rutas base empiecen con / y no terminen en /', () => {
    expect(() => parseConfig({ ...valid, API_BASE_PATH: 'v1' })).toThrow(ConfigError);
    expect(() => parseConfig({ ...valid, API_BASE_PATH: '/v1/' })).toThrow(ConfigError);
  });

  it('normaliza SENTRY_DSN vacío a undefined', () => {
    expect(parseConfig({ ...valid, SENTRY_DSN: '' }).SENTRY_DSN).toBeUndefined();
  });

  it('conserva un SENTRY_DSN válido', () => {
    const dsn = 'https://abc@o0.ingest.example.test/1';
    expect(parseConfig({ ...valid, SENTRY_DSN: dsn }).SENTRY_DSN).toBe(dsn);
  });

  it('lanza ConfigError con el campo faltante en issues', () => {
    const incomplete: Partial<typeof valid> = { ...valid };
    delete incomplete.TENANT_CODE;
    try {
      parseConfig(incomplete);
      expect.unreachable('debía lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).issues.join(' ')).toContain('TENANT_CODE');
    }
  });
});

describe('loadConfig', () => {
  it('lanza ConfigError que menciona /config.js si no hay configuración en window', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/\/config\.js/);
  });

  it('lee window.__APP_CONFIG__', () => {
    expect(loadConfig({ __APP_CONFIG__: valid }).TENANT_CODE).toBe('co');
  });
});
