import { Badge } from '@/components/ui/badge';
import type { AgencyStatus } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';

const VARIANT: Record<AgencyStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  changes_requested: 'outline',
  active: 'default',
  rejected: 'destructive',
  suspended: 'destructive',
  terminated: 'outline',
};

export function AgencyStatusBadge({ status }: { status: AgencyStatus }) {
  return <Badge variant={VARIANT[status]}>{es.agencies.status[status]}</Badge>;
}
