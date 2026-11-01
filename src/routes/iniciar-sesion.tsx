import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { enforce } from '@/features/auth/session/enforce';
import { LoginPage } from '@/features/auth/screens/LoginPage';

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute('/iniciar-sesion')({
  validateSearch: (search) => searchSchema.catch({}).parse(search),
  beforeLoad: ({ context, location }) => enforce('public-only', { context, location }),
  component: LoginRoute,
});

function LoginRoute() {
  const { redirect } = Route.useSearch();
  return <LoginPage redirectTo={redirect} />;
}
