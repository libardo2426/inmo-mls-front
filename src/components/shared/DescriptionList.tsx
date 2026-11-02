import type { ReactNode } from 'react';
import { es } from '@/lib/i18n/es';

/** Lista de datos etiqueta/valor en rejilla. */
export function DescriptionList({ children }: { children: ReactNode }) {
  return <dl className="grid max-w-2xl grid-cols-[10rem_1fr] gap-x-4 gap-y-1.5">{children}</dl>;
}

/** Un dato; sin valor (`null`, `undefined` o cadena vacía) muestra el marcador «sin dato». */
export function DescriptionItem({ label, children }: { label: string; children?: ReactNode }) {
  const empty = children === null || children === undefined || children === '';
  return (
    <>
      <dt className="text-label">{label}</dt>
      <dd className="text-data">{empty ? es.agencies.detail.none : children}</dd>
    </>
  );
}
