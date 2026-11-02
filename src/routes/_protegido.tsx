import { createFileRoute, Outlet } from '@tanstack/react-router';
import { enforce } from '@/features/auth/session/enforce';

export const Route = createFileRoute('/_protegido')({
  beforeLoad: async ({ context, location }) => {
    const state = await enforce('protected', { context, location });
    // `enforce` ya redirigió a quien no tiene sesión; esto solo estrecha el tipo.
    if (state.status !== 'authenticated') throw new Error('Sesión no autenticada');
    return { me: state.me };
  },
  component: Outlet,
});
