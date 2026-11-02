import { useSuspenseQuery } from '@tanstack/react-query';
import { useHttpClient } from '@/app/app-context';
import { es } from '@/lib/i18n/es';
import { meQueryOptions } from '../session/me';

/** Inicio: contenido de la página autenticada mínima; el shell la envuelve. */
export function HomePage() {
  const http = useHttpClient();
  const { data: me } = useSuspenseQuery(meQueryOptions(http));

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-lg font-semibold">{es.nav.home}</h1>
      <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{es.auth.home.signedInAs}</dt>
        <dd>{me.user.email}</dd>
        <dt className="text-muted-foreground">{es.auth.home.country}</dt>
        <dd>{me.tenant.name}</dd>
      </dl>
    </div>
  );
}
