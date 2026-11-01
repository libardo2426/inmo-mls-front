import { createFileRoute } from '@tanstack/react-router';
import { RequestResetPage } from '@/features/auth/screens/RequestResetPage';
import { enforce } from '@/features/auth/session/enforce';

export const Route = createFileRoute('/recuperar')({
  beforeLoad: ({ context, location }) => enforce('public-only', { context, location }),
  component: RequestResetPage,
});
