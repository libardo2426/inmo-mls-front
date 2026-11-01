import { useSuspenseQuery } from '@tanstack/react-query';
import { useHttpClient } from '@/app/app-context';
import { ThemeToggle } from '@/app/theme/ThemeToggle';
import { es } from '@/lib/i18n/es';
import { LogoutButton } from '../components/LogoutButton';
import { meQueryOptions } from '../session/me';

/** Página autenticada mínima de F1; el shell y la navegación por permisos llegan en F2. */
export function HomePage() {
  const http = useHttpClient();
  const { data: me } = useSuspenseQuery(meQueryOptions(http));

  return (
    <main className="flex min-h-svh flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{es.app.name}</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LogoutButton label={es.auth.home.logout} />
        </div>
      </header>
      <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{es.auth.home.signedInAs}</dt>
        <dd>{me.user.email}</dd>
        <dt className="text-muted-foreground">{es.auth.home.country}</dt>
        <dd>{me.tenant.name}</dd>
      </dl>
    </main>
  );
}
