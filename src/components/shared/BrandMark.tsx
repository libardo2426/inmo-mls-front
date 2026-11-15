import { cn } from '@/lib/utils';

/**
 * Símbolo de marca (la «m» con dos puertas). PROVISIONAL: aproximación tomada de las maquetas
 * (`docs/superpowers/design-refs/2026-11-15-vistas-admin`). Este es el único archivo a reemplazar
 * cuando llegue el SVG definitivo.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 76" aria-hidden="true" className={cn('shrink-0', className)}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M0 76V22A22 22 0 0 1 22 0H78A22 22 0 0 1 100 22V76Z M14 76V40A14 14 0 0 1 42 40V76Z M58 76V40A14 14 0 0 1 86 40V76Z"
      />
      <circle cx="36" cy="58" r="3.6" className="fill-leaf" />
    </svg>
  );
}
