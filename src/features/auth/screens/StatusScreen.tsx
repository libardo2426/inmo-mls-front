import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { es } from '@/lib/i18n/es';

const COPY = {
  maintenance: { title: es.auth.status.maintenanceTitle, help: es.auth.status.maintenanceHelp },
  offline: { title: es.auth.status.offlineTitle, help: es.auth.status.offlineHelp },
} as const;

/** Pantalla de estado del servicio (mantenimiento 503 o sin conexión) con reintento. */
export function StatusScreen({ kind }: { kind: keyof typeof COPY }) {
  const navigate = useNavigate();
  const { title, help } = COPY[kind];

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-muted-foreground text-sm">{help}</p>
      <Button className="self-start" onClick={() => void navigate({ to: '/' })}>
        {es.auth.status.retry}
      </Button>
    </main>
  );
}
