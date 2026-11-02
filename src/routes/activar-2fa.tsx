import { createFileRoute } from '@tanstack/react-router';
import { ActivateTwoFactorPage } from '@/features/auth/screens/ActivateTwoFactorPage';
import { enforce } from '@/features/auth/session/enforce';

export const Route = createFileRoute('/activar-2fa')({
  beforeLoad: ({ context, location }) => enforce('two-factor-setup', { context, location }),
  component: ActivateTwoFactorPage,
});
