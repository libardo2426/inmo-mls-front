import { createFileRoute } from '@tanstack/react-router';
import { StatusScreen } from '@/features/auth/screens/StatusScreen';

export const Route = createFileRoute('/sin-conexion')({
  component: () => <StatusScreen kind="offline" />,
});
