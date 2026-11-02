import type { MouseEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export type DataTableProps<T> = {
  columns: readonly Column<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  /** Nombre accesible de la tabla. */
  caption: string;
  /** Primera carga: filas de esqueleto. */
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty: { title: string; description?: string };
  /**
   * Comodidad para el ratón: clic en cualquier parte de la fila. El acceso por teclado y
   * lectores de pantalla es un enlace real dentro de la fila (`cell` de la primera columna).
   */
  onRowActivate?: (row: T) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
};

const SKELETON_ROWS = 5;

/** Tabla densa con estados de carga, error y vacío, y paginación por cursor («Cargar más»). */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
  isLoading = false,
  error,
  onRetry,
  empty,
  onRowActivate,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}: DataTableProps<T>) {
  const hasError = error !== undefined && error !== null;
  // Sin filas, el error ocupa la pantalla; con filas (falló «Cargar más» o una recarga) se conserva la tabla.
  if (hasError && rows.length === 0) return <ErrorState error={error} onRetry={onRetry} />;
  if (!isLoading && rows.length === 0) {
    return (
      <EmptyState
        title={empty.title}
        {...(empty.description ? { description: empty.description } : {})}
      />
    );
  }

  const onRowClick = (event: MouseEvent, row: T) => {
    const modified = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
    const onInteractive = (event.target as Element).closest('a, button') !== null;
    if (!modified && !onInteractive) onRowActivate?.(row);
  };

  return (
    <div className="flex flex-col gap-3">
      <Table aria-label={caption} aria-busy={isLoading}>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.id} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <TableRow key={index} aria-hidden="true">
                  {columns.map((column) => (
                    <TableCell key={column.id} className="py-1.5">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : rows.map((row) => (
                <TableRow
                  key={getRowKey(row)}
                  {...(onRowActivate
                    ? {
                        className: 'cursor-pointer',
                        onClick: (event: MouseEvent) => onRowClick(event, row),
                      }
                    : {})}
                >
                  {columns.map((column) => (
                    <TableCell key={column.id} className={`py-1.5 ${column.className ?? ''}`}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {hasError ? (
        <div role="alert" className="flex items-center gap-3 text-sm">
          <span>{error instanceof ApiError ? error.title : es.states.genericError}</span>
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              {es.states.retry}
            </Button>
          ) : null}
        </div>
      ) : null}
      {hasMore ? (
        <Button
          variant="outline"
          size="sm"
          className="self-center"
          disabled={isLoadingMore}
          onClick={onLoadMore}
        >
          {es.states.loadMore}
        </Button>
      ) : null}
    </div>
  );
}
