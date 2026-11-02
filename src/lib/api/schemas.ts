/**
 * Fachada estable sobre el código generado desde `docs/backend/openapi.json`.
 * El resto de la aplicación importa de aquí, nunca de `./generated`.
 */
import type { z } from 'zod';
import {
  zAgencyApplicationResponse,
  zAgencyPageResponse,
  zMeResponse,
  zProblemDetails,
  zPropertyDetailResponse,
  zTerritoryPageResponse,
} from './generated/zod.gen';

export const meResponseSchema = zMeResponse;
export const problemDetailsSchema = zProblemDetails;
export const propertyDetailResponseSchema = zPropertyDetailResponse;
export const agencyApplicationResponseSchema = zAgencyApplicationResponse;
export const agencyPageResponseSchema = zAgencyPageResponse;
export const territoryPageResponseSchema = zTerritoryPageResponse;

export type MeResponse = z.infer<typeof meResponseSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
export type PropertyDetailResponse = z.infer<typeof propertyDetailResponseSchema>;
export type AgencyApplication = z.infer<typeof agencyApplicationResponseSchema>;
export type AgencyPage = z.infer<typeof agencyPageResponseSchema>;
export type AgencySummary = AgencyPage['items'][number];
export type AgencyStatus = AgencyApplication['status'];
export type TerritoryPage = z.infer<typeof territoryPageResponseSchema>;
