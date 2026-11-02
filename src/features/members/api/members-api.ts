import { z } from 'zod';
import { memberListSchema, type Member } from '@/lib/api/schemas';
import type { HttpClient } from '@/lib/http';

export type MembersApi = {
  list(agencyId: string, signal?: AbortSignal): Promise<Member[]>;
  terminate(memberId: string, reason: string): Promise<void>;
};

/** Cuerpo vacío (204). */
const noContent = z.void();

/** Cliente de `/v1/agencies/{id}/members` y `/v1/members/{id}/terminate` sobre el cliente HTTP único. */
export function createMembersApi(http: HttpClient): MembersApi {
  return {
    list: (agencyId, signal) =>
      http.request({
        host: 'country',
        path: `/agencies/${encodeURIComponent(agencyId)}/members`,
        schema: memberListSchema,
        ...(signal ? { signal } : {}),
      }),
    terminate: async (memberId, reason) => {
      await http.request({
        host: 'country',
        path: `/members/${encodeURIComponent(memberId)}/terminate`,
        method: 'POST',
        body: { reason },
        schema: noContent,
      });
    },
  };
}
