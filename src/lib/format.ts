const dateFormat = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Bogota',
});

/** Fecha corta en es-CO a partir de un ISO 8601. */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
