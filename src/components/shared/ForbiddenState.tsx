import { es } from '@/lib/i18n/es';

/** Sin permiso: no revela qué permiso falta. */
export function ForbiddenState() {
  return (
    <section className="flex flex-col gap-2 p-8">
      <h2 className="text-base font-semibold">{es.states.forbiddenTitle}</h2>
      <p className="text-muted-foreground text-sm">{es.states.forbiddenHelp}</p>
    </section>
  );
}
