import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuthApi } from './useAuthApi';
import { useAuthNavigation } from './useAuthNavigation';

/**
 * Cierra la sesión. Aunque `sign-out` falle (500 o sin red), se vacía la caché y se
 * vuelve a login: la guarda confirmará con `/me` si la sesión seguía viva.
 */
export function useLogout(): () => Promise<void> {
  const api = useAuthApi();
  const queryClient = useQueryClient();
  const { go } = useAuthNavigation();

  return useCallback(async () => {
    try {
      await api.signOut();
    } catch {
      /* el cierre en el servidor es de mejor esfuerzo */
    } finally {
      queryClient.clear();
      go('/iniciar-sesion');
    }
  }, [api, queryClient, go]);
}
