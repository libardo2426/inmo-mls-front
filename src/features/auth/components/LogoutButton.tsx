import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { es } from '@/lib/i18n/es';
import { useLogout } from '../hooks/useLogout';

type LogoutButtonProps = { label: string; variant?: 'default' | 'outline' };

/** Botón de «Cerrar sesión»: se bloquea mientras cierra para no repetir la petición. */
export function LogoutButton({ label, variant = 'outline' }: LogoutButtonProps) {
  const logout = useLogout();
  const [pending, setPending] = useState(false);
  const running = useRef(false);

  async function onClick() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    try {
      await logout();
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  return (
    <Button type="button" variant={variant} disabled={pending} onClick={() => void onClick()}>
      {pending ? <Spinner data-icon="inline-start" /> : null}
      {pending ? es.auth.home.loggingOut : label}
    </Button>
  );
}
