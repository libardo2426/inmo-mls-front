/**
 * Fachada estable sobre el código generado desde `docs/backend/openapi.json`.
 * El resto de la aplicación importa de aquí, nunca de `./generated`.
 */
import type { z } from 'zod';
import {
  zAgencyApplicationResponse,
  zAgencyPageResponse,
  zAcceptedInvitationResponse,
  zInvitationPageResponse,
  zInvitationPreviewResponse,
  zInvitationWithWarningsResponse,
  zInviteMemberBody,
  zMeResponse,
  zMemberResponse,
  zMembersControllerListResponse,
  zProblemDetails,
  zPropertyDetailResponse,
  zTerritoryPageResponse,
} from './generated/zod.gen';

export const meResponseSchema = zMeResponse;
export const problemDetailsSchema = zProblemDetails;
export const propertyDetailResponseSchema = zPropertyDetailResponse;
export const agencyApplicationResponseSchema = zAgencyApplicationResponse;
export const agencyPageResponseSchema = zAgencyPageResponse;
export const memberResponseSchema = zMemberResponse;
export const memberListSchema = zMembersControllerListResponse;
export const inviteMemberBodySchema = zInviteMemberBody;
export const invitationPageSchema = zInvitationPageResponse;
export const invitationWithWarningsSchema = zInvitationWithWarningsResponse;
export const invitationPreviewSchema = zInvitationPreviewResponse;
export const acceptedInvitationSchema = zAcceptedInvitationResponse;
export const territoryPageResponseSchema = zTerritoryPageResponse;

export type MeResponse = z.infer<typeof meResponseSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
export type PropertyDetailResponse = z.infer<typeof propertyDetailResponseSchema>;
export type AgencyApplication = z.infer<typeof agencyApplicationResponseSchema>;
export type AgencyPage = z.infer<typeof agencyPageResponseSchema>;
export type AgencySummary = AgencyPage['items'][number];
export type AgencyStatus = AgencyApplication['status'];
export type Member = z.infer<typeof memberResponseSchema>;
export type MemberStatus = Member['status'];
export type MemberRole = Member['role'];
export type InvitationPage = z.infer<typeof invitationPageSchema>;
export type Invitation = InvitationPage['items'][number];
export type InvitationStatus = Invitation['status'];
export type InvitationWithWarnings = z.infer<typeof invitationWithWarningsSchema>;
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;
export type AcceptedInvitation = z.infer<typeof acceptedInvitationSchema>;

/** Roles que una inmobiliaria puede invitar y asignar (el backend rechaza `admin` y `compliance`). */
export const INVITABLE_ROLES = ['broker', 'agent', 'assistant', 'read_only'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];
export type TerritoryPage = z.infer<typeof territoryPageResponseSchema>;
