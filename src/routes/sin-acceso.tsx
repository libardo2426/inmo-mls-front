import { createFileRoute } from '@tanstack/react-router';
import { NoAccessPage } from '@/features/auth/screens/NoAccessPage';
import { enforce } from '@/features/auth/session/enforce';

export const Route = createFileRoute('/sin-acceso')({
  beforeLoad: ({ context, location }) => enforce('no-access', { context, location }),
  component: NoAccessPage,
});
