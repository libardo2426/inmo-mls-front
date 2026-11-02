import { useId, type ReactNode } from 'react';

/** Sección de una pantalla: región nombrada por su título (`h2`). */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-section-title">
        {title}
      </h2>
      {children}
    </section>
  );
}
