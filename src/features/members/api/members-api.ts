import { z } from 'zod';
import { memberListSchema, type InvitableRole, type Member } from '@/lib/api/schemas';
import type { HttpClient } from '@/lib/http';

export type MembersApi = {
  list(agencyId: string, signal?: AbortSignal): Promise<Member[]>;
  terminate(memberId: string, reason?: string): Promise<void>;
  changeRole(memberId: string, role: InvitableRole): Promise<void>;
  leave(): Promise<void>;
};

/** Cuerpo vacío (204). */
const noContent = z.void();

/** Cliente de `/v1/agencies/{id}/members` y `/v1/members/*` sobre el cliente HTTP único. */
export function createMembersApi(http: HttpClient): MembersApi {
  const send = async (path: string, method: 'POST' | 'PATCH', body: object) => {
    await http.request({ host: 'country', path, method, body, schema: noContent });
  };

  return {
    list: (agencyId, signal) =>
      http.request({
        host: 'country',
        path: `/agencies/${encodeURIComponent(agencyId)}/members`,
        schema: memberListSchema,
        ...(signal ? { signal } : {}),
      }),
    terminate: (memberId, reason) =>
      send(`/members/${encodeURIComponent(memberId)}/terminate`, 'POST', reason ? { reason } : {}),
    changeRole: (memberId, role) =>
      send(`/members/${encodeURIComponent(memberId)}/role`, 'PATCH', { role }),
    leave: () => send('/members/me/leave', 'POST', {}),
  };
}
