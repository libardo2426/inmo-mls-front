import { StatusBadge, type Tone } from '@/components/shared/StatusBadge';
import type { MemberStatus } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';

const TONE: Record<MemberStatus, Tone> = {
  active: 'success',
  suspended: 'danger',
  terminated: 'neutral',
};

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  // Un estado nuevo del backend no debe romper la pantalla: tono neutro y valor crudo.
  const label = (es.members.status as Record<string, string>)[status] ?? status;
  return <StatusBadge tone={TONE[status] ?? 'neutral'}>{label}</StatusBadge>;
}
