import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/http';
import { es } from '@/lib/i18n/es';

type ErrorStateProps = { error: unknown; onRetry?: () => void };

/** Error de una pantalla: título del problema y referencia, sin detalles internos. */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const apiError = error instanceof ApiError ? error : null;
  return (
    <section role="alert" className="flex flex-col items-start gap-2 p-8">
      <h2 className="text-base font-semibold">{apiError?.title ?? es.states.genericError}</h2>
      {apiError?.requestId ? (
        <p className="text-muted-foreground text-sm">
          {es.states.reference}: {apiError.requestId}
        </p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          {es.states.retry}
        </Button>
      ) : null}
    </section>
  );
}
