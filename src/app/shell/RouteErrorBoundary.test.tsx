import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { PermissionDeniedError } from '@/lib/permissions/guard';
import { RouteErrorBoundary } from './RouteErrorBoundary';

describe('RouteErrorBoundary', () => {
  it('PermissionDeniedError → pantalla de sin permiso', () => {
    render(<RouteErrorBoundary error={new PermissionDeniedError()} reset={() => undefined} />);
    expect(screen.getByText(es.states.forbiddenTitle)).toBeInTheDocument();
  });

  it('otro error → ErrorState y Reintentar llama a reset', async () => {
    const reset = vi.fn();
    const error = new ApiError({ status: 500, code: 'x', title: 'Falló', requestId: 'r-1' });
    render(<RouteErrorBoundary error={error} reset={reset} />);
    expect(screen.getByText('Falló')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: es.states.retry }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
