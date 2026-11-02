import { Link } from '@tanstack/react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { visibleNavigation } from '@/config/navigation';
import type { MeResponse } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';

/** Menú lateral: expandido o plegado a iconos, con los ítems que la sesión puede ver. */
export function AppSidebar({ me }: { me: MeResponse }) {
  const items = visibleNavigation(me);
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <span className="text-section-title truncate px-2 py-1">{es.app.name}</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label={es.shell.mainNav}>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild tooltip={item.label}>
                      <Link
                        to={item.to}
                        activeOptions={{ exact: item.to === '/' }}
                        activeProps={{ 'data-active': true }}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
