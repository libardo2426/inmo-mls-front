import type { KeyboardEvent, ReactNode } from 'react';
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
  /** Clic o Enter sobre una fila. */
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
  if (error !== undefined && error !== null) return <ErrorState error={error} onRetry={onRetry} />;
  if (!isLoading && rows.length === 0) {
    return (
      <EmptyState
        title={empty.title}
        {...(empty.description ? { description: empty.description } : {})}
      />
    );
  }

  const onKeyDown = (event: KeyboardEvent, row: T) => {
    if (event.key === 'Enter') onRowActivate?.(row);
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
                        tabIndex: 0,
                        className: 'cursor-pointer',
                        onClick: () => onRowActivate(row),
                        onKeyDown: (event: KeyboardEvent) => onKeyDown(event, row),
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
