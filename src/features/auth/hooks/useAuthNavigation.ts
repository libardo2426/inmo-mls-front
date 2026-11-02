import { useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';

export type AuthPath =
  | '/'
  | '/iniciar-sesion'
  | '/verificar'
  | '/activar-2fa'
  | '/recuperar'
  | '/restablecer'
  | '/sin-acceso';

type GoOptions = { search?: Record<string, string>; replace?: boolean };

/**
 * Navegación de las pantallas de autenticación. El destino se limita a `AuthPath`;
 * el cast interno evita depender del orden en que se crean las rutas tipadas.
 */
export function useAuthNavigation() {
  const router = useRouter();
  return useMemo(
    () => ({
      go: (to: AuthPath, options: GoOptions = {}) =>
        void router.navigate({ to, ...options } as Parameters<typeof router.navigate>[0]),
      /** Para rutas arbitrarias ya validadas con `safeRedirect` (incluye búsqueda). */
      goHref: (href: string) => router.history.push(href),
    }),
    [router],
  );
}
