import { z } from 'zod';
import {
  acceptedInvitationSchema,
  invitationPageSchema,
  invitationPreviewSchema,
  invitationWithWarningsSchema,
  type AcceptedInvitation,
  type InvitableRole,
  type InvitationPage,
  type InvitationPreview,
  type InvitationStatus,
  type InvitationWithWarnings,
} from '@/lib/api/schemas';
import type { HttpClient } from '@/lib/http';

export type InviteMemberInput = { email: string; fullName: string; role: InvitableRole };

export type InvitationListInput = {
  status?: InvitationStatus;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
};

export type InvitationsApi = {
  list(agencyId: string, input?: InvitationListInput): Promise<InvitationPage>;
  invite(agencyId: string, body: InviteMemberInput): Promise<InvitationWithWarnings>;
  resend(agencyId: string, id: string): Promise<InvitationWithWarnings>;
  cancel(agencyId: string, id: string): Promise<void>;
  preview(token: string): Promise<InvitationPreview>;
  accept(token: string): Promise<AcceptedInvitation>;
};

/** Cuerpo vacío (204). */
const noContent = z.void();

/** Cliente de `/v1/agencies/{id}/invitations*` y `/v1/invitations/*` sobre el cliente HTTP único. */
export function createInvitationsApi(http: HttpClient): InvitationsApi {
  const base = (agencyId: string) => `/agencies/${encodeURIComponent(agencyId)}/invitations`;

  return {
    list: (agencyId, { status, cursor, limit, signal } = {}) =>
      http.request({
        host: 'country',
        path: base(agencyId),
        query: { status, cursor, limit },
        schema: invitationPageSchema,
        ...(signal ? { signal } : {}),
      }),
    invite: (agencyId, body) =>
      http.request({
        host: 'country',
        path: base(agencyId),
        method: 'POST',
        body,
        schema: invitationWithWarningsSchema,
      }),
    resend: (agencyId, id) =>
      http.request({
        host: 'country',
        path: `${base(agencyId)}/${encodeURIComponent(id)}/resend`,
        method: 'POST',
        schema: invitationWithWarningsSchema,
      }),
    cancel: async (agencyId, id) => {
      await http.request({
        host: 'country',
        path: `${base(agencyId)}/${encodeURIComponent(id)}/cancel`,
        method: 'POST',
        schema: noContent,
      });
    },
    preview: (token) =>
      http.request({
        host: 'country',
        path: '/invitations/preview',
        method: 'POST',
        body: { token },
        schema: invitationPreviewSchema,
      }),
    accept: (token) =>
      http.request({
        host: 'country',
        path: '/invitations/accept',
        method: 'POST',
        body: { token },
        schema: acceptedInvitationSchema,
      }),
  };
}
