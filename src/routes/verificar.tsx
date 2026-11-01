import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { VerifyPage } from '@/features/auth/screens/VerifyPage';
import { enforce } from '@/features/auth/session/enforce';

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute('/verificar')({
  validateSearch: (search) => searchSchema.catch({}).parse(search),
  beforeLoad: ({ context, location }) => enforce('public-only', { context, location }),
  component: VerifyRoute,
});

function VerifyRoute() {
  const { redirect } = Route.useSearch();
  return <VerifyPage redirectTo={redirect} />;
}
