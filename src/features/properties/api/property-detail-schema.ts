import { z } from 'zod';
import { zPropertyDetailResponse } from '@/lib/api/generated/zod.gen';

/**
 * El esquema generado declara `status` y `history[].field` como enums cerrados: un valor nuevo del
 * backend haría fallar toda la ficha. Aquí se toleran como texto (se muestran crudos en neutro).
 */
const historyEntry = zPropertyDetailResponse.shape.history.element.extend({ field: z.string() });

export const propertyDetailSchema = zPropertyDetailResponse.extend({
  status: z.string(),
  history: z.array(historyEntry),
});

export type PropertyDetail = z.infer<typeof propertyDetailSchema>;
