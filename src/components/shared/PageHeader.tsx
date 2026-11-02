import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  backLink?: ReactNode;
};

/** Encabezado de página (un `div`, no `header`, para no duplicar el landmark `banner`): enlace de regreso, título (único `h1`), descripción y acciones. */
export function PageHeader({ title, description, actions, backLink }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      {backLink}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="type-page-title min-w-0 wrap-break-word">{title}</h1>
          {description ? <p className="type-data text-primary font-bold">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
