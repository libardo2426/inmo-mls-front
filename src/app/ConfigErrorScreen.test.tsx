import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfigErrorScreen } from '@/app/ConfigErrorScreen';
import { ConfigError } from '@/lib/config';
import { es } from '@/lib/i18n/es';

describe('ConfigErrorScreen', () => {
  it('muestra el título y cada problema de configuración', () => {
    const error = new ConfigError(['TENANT_CODE: requerido', 'API_BASE_PATH: debe empezar con /']);
    render(<ConfigErrorScreen error={error} />);
    expect(screen.getByRole('heading', { name: es.config.errorTitle })).toBeInTheDocument();
    expect(screen.getByText('TENANT_CODE: requerido')).toBeInTheDocument();
    expect(screen.getByText('API_BASE_PATH: debe empezar con /')).toBeInTheDocument();
  });

  it('no muestra stack traces', () => {
    const error = new ConfigError(['TENANT_CODE: requerido']);
    render(<ConfigErrorScreen error={error} />);
    expect(screen.queryByText(/at .*\.(ts|tsx|js)/)).toBeNull();
  });
});
