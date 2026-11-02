import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { UserIcon } from 'lucide-react';
import { useState } from 'react';
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
import { ME_QUERY_KEY } from '@/features/auth/session/me';
import { LeaveAgencyDialog } from '@/features/members/components/LeaveAgencyDialog';
import { canLeaveAgency } from '@/features/members/terminate-rules';
import type { MeResponse } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';

/** Menú de la persona: correo, país y cierre de sesión. */
export function UserMenu({ me }: { me: MeResponse }) {
  const logout = useLogout();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  return (
    <>
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
          {canLeaveAgency(me) ? (
            <DropdownMenuItem onSelect={() => setLeaving(true)}>
              {es.members.leave.menu}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => void logout()}>{es.shell.logout}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {leaving ? (
        <LeaveAgencyDialog
          open
          onOpenChange={(open) => (open ? undefined : setLeaving(false))}
          onDone={() => {
            // Ya no hay membresía: se descarta `/me` y la guarda lleva a /sin-acceso.
            queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
            void router.invalidate();
          }}
        />
      ) : null}
    </>
  );
}
