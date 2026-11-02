import { UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLogout } from '@/features/auth/hooks/useLogout';
import type { MeResponse } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';

/** Menú de la persona: correo, país y cierre de sesión. */
export function UserMenu({ me }: { me: MeResponse }) {
  const logout = useLogout();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={es.shell.userMenu}>
          <UserIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-[min(20rem,calc(100vw-1rem))]">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate text-sm font-medium">{me.user.email}</span>
          <span className="text-muted-foreground text-xs">
            {es.shell.country}: {me.tenant.name}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>{es.shell.logout}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
