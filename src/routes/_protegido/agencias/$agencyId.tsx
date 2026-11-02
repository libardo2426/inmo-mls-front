import { createFileRoute } from '@tanstack/react-router';
import { assertCan } from '@/lib/permissions';

export const Route = createFileRoute('/_protegido/agencias/$agencyId')({
  beforeLoad: ({ context }) => assertCan(context.me, 'agency.list', 'network'),
  // Provisional: la pantalla de detalle llega en la Tarea 5.
  component: () => null,
});
