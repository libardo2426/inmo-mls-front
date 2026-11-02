import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { PermissionDeniedError } from '@/lib/permissions/guard';
import { RouteErrorBoundary } from './RouteErrorBoundary';

describe('RouteErrorBoundary', () => {
  it('PermissionDeniedError → pantalla de sin permiso', () => {
    render(<RouteErrorBoundary error={new PermissionDeniedError()} reset={() => undefined} />);
    expect(screen.getByText(es.states.forbiddenTitle)).toBeInTheDocument();
  });

  it('otro error → ErrorState con título y referencia', () => {
    const error = new ApiError({ status: 500, code: 'x', title: 'Falló', requestId: 'r-1' });
    render(<RouteErrorBoundary error={error} reset={() => undefined} />);
    expect(screen.getByText('Falló')).toBeInTheDocument();
    expect(screen.getByText(/r-1/)).toBeInTheDocument();
  });
});
