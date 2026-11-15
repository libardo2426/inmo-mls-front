import { z } from 'zod';

/**
 * Respuesta de `GET /v1/properties`. B-11: el backend aún no la declara en OpenAPI, así que se
 * tipa a mano. Cuando llegue el esquema generado, este archivo se borra.
 * `status` y `propertyType` se toleran como texto para no romper ante valores nuevos.
 */
export const propertyListItemSchema = z.object({
  id: z.string(),
  uniqueIdentifier: z.string(),
  propertyType: z.string(),
  status: z.string(),
  territorialUnitCode: z.string(),
  address: z.string(),
  editorAgencyId: z.string().nullable(),
  createdAt: z.string(),
});

export const propertyPageSchema = z.object({
  items: z.array(propertyListItemSchema),
  nextCursor: z.string().nullable(),
});

export type PropertyListItem = z.infer<typeof propertyListItemSchema>;
export type PropertyPage = z.infer<typeof propertyPageSchema>;
