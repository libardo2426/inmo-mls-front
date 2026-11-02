import { useRouter } from '@tanstack/react-router';
import { ErrorState } from '@/components/shared/ErrorState';
import { ForbiddenState } from '@/components/shared/ForbiddenState';
import { PermissionDeniedError } from '@/lib/permissions/guard';

type RouteErrorBoundaryProps = { error: unknown; reset: () => void };

/** `defaultErrorComponent` del router: «sin permiso» o error de la pantalla, dentro del shell. */
export function RouteErrorBoundary({ error, reset }: RouteErrorBoundaryProps) {
  const router = useRouter();
  if (error instanceof PermissionDeniedError) return <ForbiddenState />;
  // `reset` solo reinicia el límite de error; hay que volver a cargar la ruta para reintentar.
  return <ErrorState error={error} onRetry={() => void router.invalidate().then(reset)} />;
}
