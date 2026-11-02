import { createFileRoute, Outlet } from '@tanstack/react-router';
import { enforce } from '@/features/auth/session/enforce';

export const Route = createFileRoute('/_protegido')({
  beforeLoad: ({ context, location }) => enforce('protected', { context, location }),
  component: Outlet,
});
