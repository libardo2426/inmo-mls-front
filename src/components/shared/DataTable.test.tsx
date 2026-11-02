import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { es } from '@/lib/i18n/es';
import { DataTable, type Column } from './DataTable';

type Row = { id: string; name: string };
const columns: Column<Row>[] = [
  { id: 'id', header: 'Código', cell: (r) => r.id },
  { id: 'name', header: 'Nombre', cell: (r) => r.name },
];
const rows: Row[] = [
  { id: 'a1', name: 'Alfa' },
  { id: 'b2', name: 'Beta' },
];
const base = {
  columns,
  rows,
  getRowKey: (r: Row) => r.id,
  caption: 'Tabla de prueba',
  empty: { title: 'Sin datos' },
};

describe('DataTable', () => {
  it('muestra encabezados y filas, y la tabla tiene nombre accesible', () => {
    render(<DataTable {...base} />);
    const table = screen.getByRole('table', { name: 'Tabla de prueba' });
    expect(within(table).getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
    expect(within(table).getByText('Alfa')).toBeInTheDocument();
    expect(within(table).getByText('Beta')).toBeInTheDocument();
  });

  it('isLoading muestra esqueletos y no filas', () => {
    render(<DataTable {...base} isLoading />);
    expect(screen.queryByText('Alfa')).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Tabla de prueba' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('con error muestra ErrorState y llama onRetry', async () => {
    const onRetry = vi.fn();
    render(<DataTable {...base} error={new Error('x')} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: es.states.retry }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('sin filas muestra el EmptyState', () => {
    render(
      <DataTable {...base} rows={[]} empty={{ title: 'Sin datos', description: 'Nada aún' }} />,
    );
    expect(screen.getByRole('heading', { name: 'Sin datos' })).toBeInTheDocument();
    expect(screen.getByText('Nada aún')).toBeInTheDocument();
  });

  it('Enter y clic sobre una fila llaman onRowActivate con la fila', async () => {
    const onRowActivate = vi.fn();
    render(<DataTable {...base} onRowActivate={onRowActivate} />);
    const row = screen.getByRole('row', { name: /Alfa/ });
    row.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowActivate).toHaveBeenLastCalledWith(rows[0]);
    await userEvent.click(screen.getByText('Beta'));
    expect(onRowActivate).toHaveBeenLastCalledWith(rows[1]);
  });

  it('las filas no son activables si no hay onRowActivate', () => {
    render(<DataTable {...base} />);
    expect(screen.getByRole('row', { name: /Alfa/ })).not.toHaveAttribute('tabindex');
  });

  it('hasMore muestra «Cargar más» y llama onLoadMore; sin hasMore no aparece', async () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(<DataTable {...base} hasMore onLoadMore={onLoadMore} />);
    await userEvent.click(screen.getByRole('button', { name: es.states.loadMore }));
    expect(onLoadMore).toHaveBeenCalledOnce();
    rerender(<DataTable {...base} hasMore={false} onLoadMore={onLoadMore} />);
    expect(screen.queryByRole('button', { name: es.states.loadMore })).not.toBeInTheDocument();
  });

  it('isLoadingMore deshabilita «Cargar más»', () => {
    render(<DataTable {...base} hasMore isLoadingMore onLoadMore={() => {}} />);
    expect(screen.getByRole('button', { name: es.states.loadMore })).toBeDisabled();
  });
});
