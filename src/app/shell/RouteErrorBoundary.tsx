import { ErrorState } from '@/components/shared/ErrorState';
import { ForbiddenState } from '@/components/shared/ForbiddenState';
import { PermissionDeniedError } from '@/lib/permissions/guard';

type RouteErrorBoundaryProps = { error: unknown; reset: () => void };

/** `defaultErrorComponent` del router: «sin permiso» o error de la pantalla, dentro del shell. */
export function RouteErrorBoundary({ error, reset }: RouteErrorBoundaryProps) {
  if (error instanceof PermissionDeniedError) return <ForbiddenState />;
  return <ErrorState error={error} onRetry={reset} />;
}
