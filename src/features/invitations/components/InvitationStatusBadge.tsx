import { StatusBadge, type Tone } from '@/components/shared/StatusBadge';
import type { InvitationStatus } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';

const TONE: Record<InvitationStatus, Tone> = {
  pending: 'warning',
  accepted: 'success',
  cancelled: 'neutral',
  expired: 'danger',
};

export function InvitationStatusBadge({ status }: { status: InvitationStatus }) {
  // Un estado nuevo del backend no debe romper la pantalla: tono neutro y valor crudo.
  const label = (es.invitations.status as Record<string, string>)[status] ?? status;
  return <StatusBadge tone={TONE[status] ?? 'neutral'}>{label}</StatusBadge>;
}
