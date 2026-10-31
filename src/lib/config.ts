import { z } from 'zod';

const basePath = z
  .string()
  .startsWith('/', 'debe empezar con /')
  .refine((value) => !value.endsWith('/'), 'no debe terminar en /');

export const appConfigSchema = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']),
  API_BASE_PATH: basePath,
  PLATFORM_API_BASE_PATH: basePath,
  TENANT_CODE: z.string().min(1),
  SENTRY_DSN: z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? undefined : value))
    .pipe(z.url().optional()),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export class ConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Configuración inválida: ${issues.join('; ')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

export function parseConfig(raw: unknown): AppConfig {
  const result = appConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`),
    );
  }
  return result.data;
}

export function loadConfig(win: { __APP_CONFIG__?: unknown } = window): AppConfig {
  if (win.__APP_CONFIG__ === undefined) {
    throw new ConfigError([
      'No se encontró window.__APP_CONFIG__: revise que /config.js se cargue',
    ]);
  }
  return parseConfig(win.__APP_CONFIG__);
}
