import { StatusBadge, type Tone } from '@/components/shared/StatusBadge';
import type { AgencyStatus } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';

const TONE: Record<AgencyStatus, Tone> = {
  pending: 'warning',
  changes_requested: 'info',
  active: 'success',
  rejected: 'danger',
  suspended: 'danger',
  terminated: 'neutral',
};

export function AgencyStatusBadge({ status }: { status: AgencyStatus }) {
  // Un estado nuevo del backend no debe romper la pantalla: tono neutro y valor crudo.
  const label = (es.agencies.status as Record<string, string>)[status] ?? status;
  return <StatusBadge tone={TONE[status] ?? 'neutral'}>{label}</StatusBadge>;
}
