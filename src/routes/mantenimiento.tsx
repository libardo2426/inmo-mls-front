import { createFileRoute } from '@tanstack/react-router';
import { StatusScreen } from '@/features/auth/screens/StatusScreen';

export const Route = createFileRoute('/mantenimiento')({
  component: () => <StatusScreen kind="maintenance" />,
});
