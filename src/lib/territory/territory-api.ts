import { queryOptions } from '@tanstack/react-query';
import { territoryPageResponseSchema } from '@/lib/api/schemas';
import type { HttpClient } from '@/lib/http';

export type TerritoryLevel = 'municipality' | 'department';
export type TerritoryUnit = { code: string; name: string; parentCode: string | null };

/** Máximo de códigos por petición que acepta el backend (más ⇒ 400). */
export const MAX_CODES = 100;

/**
 * Resuelve unidades territoriales por código con el filtro `codes` (una sola petición, `limit=100`).
 * Solo devuelve las unidades cuyo código fue pedido: un backend sin el filtro respondería la
 * primera página sin filtrar, y eso no debe tomarse por la respuesta.
 */
export async function fetchTerritoryUnits(
  http: HttpClient,
  country: string,
  level: TerritoryLevel,
  codes: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, TerritoryUnit>> {
  const wanted = [...new Set(codes.map((code) => code.trim()).filter(Boolean))].slice(0, MAX_CODES);
  const units = new Map<string, TerritoryUnit>();
  if (wanted.length === 0) return units;

  const page = await http.request({
    host: 'country',
    path: `/territory/units/${encodeURIComponent(country)}/${level}`,
    query: { codes: wanted.join(','), limit: MAX_CODES },
    schema: territoryPageResponseSchema,
    ...(signal ? { signal } : {}),
  });
  for (const item of page.items) {
    if (wanted.includes(item.code)) {
      units.set(item.code, { code: item.code, name: item.name, parentCode: item.parentCode });
    }
  }
  return units;
}

/** Una unidad por código; `null` si no existe (o si el backend no la devolvió). */
export function territoryUnitQueryOptions(
  http: HttpClient,
  country: string,
  level: TerritoryLevel,
  code: string,
) {
  return queryOptions({
    queryKey: ['territory', country, level, code] as const,
    queryFn: async ({ signal }): Promise<TerritoryUnit | null> =>
      (await fetchTerritoryUnits(http, country, level, [code], signal)).get(code) ?? null,
    staleTime: Infinity,
    retry: false,
  });
}
