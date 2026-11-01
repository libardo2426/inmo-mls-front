import { describe, expect, it } from 'vitest';
import { buildProxy } from './vite.proxy';

const env = {
  API_TARGET: 'http://co.api.localtest.me:3000',
  TENANT_CODE: 'co',
  PLATFORM_HOST: 'admin.api.localtest.me',
};

describe('buildProxy', () => {
  it('/v1 apunta al backend y fija el país con X-Tenant', () => {
    const proxy = buildProxy(env)['/v1'];
    expect(proxy?.target).toBe('http://co.api.localtest.me:3000');
    expect(proxy?.headers).toEqual({ 'X-Tenant': 'co' });
  });

  it('/v1 envía al backend el Host del destino (el país se enruta por Host)', () => {
    expect(buildProxy(env)['/v1']?.changeOrigin).toBe(true);
  });

  it('/plataforma/v1 reescribe a /v1 y fija el Host del plano de control', () => {
    const proxy = buildProxy(env)['/plataforma/v1'];
    expect(proxy?.target).toBe('http://co.api.localtest.me:3000');
    expect(proxy?.changeOrigin).toBeUndefined();
    expect(proxy?.rewrite?.('/plataforma/v1/admin/tenants/co/config')).toBe(
      '/v1/admin/tenants/co/config',
    );
    expect(proxy?.headers).toEqual({ Host: 'admin.api.localtest.me' });
  });
});
