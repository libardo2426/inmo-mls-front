import { createFileRoute } from '@tanstack/react-router';
import { ResetPasswordPage } from '@/features/auth/screens/ResetPasswordPage';
import { enforce } from '@/features/auth/session/enforce';

export const Route = createFileRoute('/restablecer')({
  beforeLoad: ({ context, location }) => enforce('public-only', { context, location }),
  component: ResetPasswordPage,
});
