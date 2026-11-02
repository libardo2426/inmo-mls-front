import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '@/features/auth/screens/HomePage';

export const Route = createFileRoute('/_protegido/')({
  component: HomePage,
});
