import { createFileRoute } from '@tanstack/react-router';
import { ThemeToggle } from '@/app/theme/ThemeToggle';
import { es } from '@/lib/i18n/es';

export const Route = createFileRoute('/_protegido/')({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="flex min-h-svh flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{es.app.name}</h1>
        <ThemeToggle />
      </header>
    </main>
  );
}
