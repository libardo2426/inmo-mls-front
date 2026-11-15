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
import { BrandMark } from '@/components/shared/BrandMark';
import { visibleNavigation } from '@/config/navigation';
import type { MeResponse } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';

/** Menú lateral: expandido o plegado a iconos, con los ítems que la sesión puede ver. */
export function AppSidebar({ me }: { me: MeResponse }) {
  const items = visibleNavigation(me);
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <BrandMark className="size-7" />
          <span className="type-section-title truncate group-data-[collapsible=icon]:hidden">
            {es.app.name}
          </span>
        </div>
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
