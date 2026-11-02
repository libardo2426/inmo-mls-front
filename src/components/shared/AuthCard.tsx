import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { es } from '@/lib/i18n/es';

type AuthCardProps = { title: string; description?: string; children: ReactNode };

/** Contenedor común de las pantallas de autenticación: tarjeta centrada con un único `h1`. */
export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-muted-foreground text-sm font-medium">{es.app.name}</p>
          <h1 className="text-lg font-semibold">{title}</h1>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
