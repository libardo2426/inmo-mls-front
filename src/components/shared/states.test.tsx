import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { ForbiddenState } from './ForbiddenState';

describe('ErrorState', () => {
  it('con un ApiError muestra su título y el requestId', () => {
    const error = new ApiError({
      status: 500,
      code: 'internal',
      title: 'Falló el servicio',
      requestId: 'req-123',
    });
    render(<ErrorState error={error} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Falló el servicio')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${es.states.reference}.*req-123`))).toBeInTheDocument();
  });

  it('con un error genérico muestra el texto genérico y no el mensaje interno', () => {
    render(<ErrorState error={new Error('stack secreto en db.ts:42')} />);
    expect(screen.getByText(es.states.genericError)).toBeInTheDocument();
    expect(screen.queryByText(/secreto/)).not.toBeInTheDocument();
  });

  it('ofrece Reintentar solo si hay onRetry, y lo llama', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState error={new Error('x')} />);
    expect(screen.queryByRole('button', { name: es.states.retry })).not.toBeInTheDocument();
    rerender(<ErrorState error={new Error('x')} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: es.states.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('ForbiddenState', () => {
  it('avisa que no hay permiso sin nombrar ningún permiso', () => {
    const { container } = render(<ForbiddenState />);
    expect(screen.getByText(es.states.forbiddenTitle)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\b[a-z_]+\.[a-z_]+\b/);
  });
});

describe('EmptyState', () => {
  it('renderiza título, descripción y acción', () => {
    render(
      <EmptyState
        title="Sin datos"
        description="Nada que mostrar"
        action={<button>Crear</button>}
      />,
    );
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
    expect(screen.getByText('Nada que mostrar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument();
  });
});

describe('jerarquía de los estados', () => {
  it('los títulos de error, sin permiso y vacío usan text-section-title', () => {
    render(
      <>
        <ErrorState error={new Error('x')} />
        <ForbiddenState />
        <EmptyState title="Sin datos" />
      </>,
    );
    for (const name of [es.states.genericError, es.states.forbiddenTitle, 'Sin datos']) {
      expect(screen.getByRole('heading', { name })).toHaveClass('text-section-title');
    }
  });
});
