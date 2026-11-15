/** El backend guarda los importes en centavos: 2 decimales fijos (no los de `Intl`, que en COP son 0). */
export const MINOR_UNIT_DECIMALS = 2;

/** `amountMinor` (texto de dígitos en unidades menores) con símbolo de moneda en es-CO. */
export function formatMinorAmount(amountMinor: string, currency: string): string {
  if (!/^\d+$/.test(amountMinor)) return amountMinor;
  const scale = 10n ** BigInt(MINOR_UNIT_DECIMALS);
  const value = BigInt(amountMinor);
  const whole = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / scale);
  const cents = (value % scale).toString().padStart(MINOR_UNIT_DECIMALS, '0');
  return `${whole},${cents}`;
}
