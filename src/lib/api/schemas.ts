/**
 * Fachada estable sobre el código generado desde `docs/backend/openapi.json`.
 * El resto de la aplicación importa de aquí, nunca de `./generated`.
 */
import type { z } from 'zod';
import { zMeResponse, zProblemDetails, zPropertyDetailResponse } from './generated/zod.gen';

export const meResponseSchema = zMeResponse;
export const problemDetailsSchema = zProblemDetails;
export const propertyDetailResponseSchema = zPropertyDetailResponse;

export type MeResponse = z.infer<typeof meResponseSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
export type PropertyDetailResponse = z.infer<typeof propertyDetailResponseSchema>;
