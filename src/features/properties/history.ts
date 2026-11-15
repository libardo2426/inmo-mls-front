import { es } from '@/lib/i18n/es';
import { formatMinorAmount } from './format-money';

const NONE = es.properties.detail.history.none;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Texto de un valor del historial (`oldValue`/`newValue` llegan sin tipo). Nunca devuelve
 * `[object Object]`: lo que no se reconoce se muestra como «—».
 */
export function formatHistoryValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return NONE;
  if (typeof value === 'string') {
    if (field === 'status') {
      return (es.properties.status as Record<string, string>)[value] ?? value;
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (isRecord(value)) {
    if (typeof value.amountMinor === 'string' && typeof value.currency === 'string') {
      return formatMinorAmount(value.amountMinor, value.currency);
    }
    if (typeof value.name === 'string') return value.name;
  }
  return NONE;
}
