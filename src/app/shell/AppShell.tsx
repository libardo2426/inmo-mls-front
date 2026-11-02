import { useSuspenseQuery } from '@tanstack/react-query';
import { Outlet } from '@tanstack/react-router';
import { useHttpClient } from '@/app/app-context';
import { ThemeToggle } from '@/app/theme/ThemeToggle';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { meQueryOptions } from '@/features/auth/session/me';
import { es } from '@/lib/i18n/es';
import { PermissionsProvider } from '@/lib/permissions';
import { AppSidebar } from './AppSidebar';
import { UserMenu } from './UserMenu';
import { useSidebarPreference } from './useSidebarPreference';

/** Layout de las rutas protegidas: menú lateral, cabecera y contenido. */
export function AppShell() {
  const http = useHttpClient();
  const { data: me } = useSuspenseQuery(meQueryOptions(http));
  const [open, setOpen] = useSidebarPreference();

  return (
    <PermissionsProvider me={me}>
      <TooltipProvider>
        <SidebarProvider open={open} onOpenChange={setOpen}>
          <AppSidebar me={me} />
          <SidebarInset>
            <header className="bg-surface flex h-12 items-center gap-2 border-b px-3">
              <SidebarTrigger aria-label={es.shell.toggleMenu} />
              <div className="ml-auto flex items-center gap-1">
                <ThemeToggle />
                <UserMenu me={me} />
              </div>
            </header>
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </PermissionsProvider>
  );
}
