import { StatusBadge } from '@/components/shared/StatusBadge';
import { es } from '@/lib/i18n/es';
import { propertyStatusTone } from '../model';

export function PropertyStatusBadge({ status }: { status: string }) {
  // Un estado nuevo del backend no debe romper la pantalla: tono neutro y valor crudo.
  const label = (es.properties.status as Record<string, string>)[status] ?? status;
  return <StatusBadge tone={propertyStatusTone(status)}>{label}</StatusBadge>;
}
