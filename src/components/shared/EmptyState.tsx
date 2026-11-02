import type { ReactNode } from 'react';

type EmptyStateProps = { title: string; description?: string; action?: ReactNode };

/** Estado vacío: no hay nada que mostrar (todavía). */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center gap-2 p-8 text-center">
      <h2 className="type-section-title">{title}</h2>
      {description ? <p className="type-data text-text-muted">{description}</p> : null}
      {action}
    </section>
  );
}
