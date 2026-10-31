// Configuración de runtime para desarrollo. En el contenedor la genera el entrypoint (ADR-0005).
window.__APP_CONFIG__ = {
  APP_ENV: 'development',
  API_BASE_PATH: '/v1',
  PLATFORM_API_BASE_PATH: '/plataforma/v1',
  TENANT_CODE: 'co',
};
