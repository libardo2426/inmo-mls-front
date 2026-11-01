export type ProxyEnv = {
  /** Backend local, p. ej. http://localhost:3000. */
  API_TARGET: string;
  /** País que el proxy fija con `X-Tenant` (solo funciona fuera de producción). */
  TENANT_CODE: string;
  /** Host del plano de control; el backend lo enruta por `Host`. */
  PLATFORM_HOST: string;
};

export type ProxyRule = {
  target: string;
  headers: Record<string, string>;
  rewrite?: (path: string) => string;
};

/** Proxy de mismo origen para desarrollo (ADR-0005): el navegador nunca ve el dominio del backend. */
export function buildProxy(env: ProxyEnv): Record<string, ProxyRule> {
  return {
    '/v1': {
      target: env.API_TARGET,
      headers: { 'X-Tenant': env.TENANT_CODE },
    },
    '/plataforma/v1': {
      target: env.API_TARGET,
      headers: { Host: env.PLATFORM_HOST },
      rewrite: (path) => path.replace(/^\/plataforma/, ''),
    },
  };
}
