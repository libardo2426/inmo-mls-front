import { z } from 'zod';
import {
  agencyApplicationResponseSchema,
  agencyPageResponseSchema,
  type AgencyApplication,
  type AgencyPage,
  type AgencyStatus,
} from '@/lib/api/schemas';
import type { HttpClient } from '@/lib/http';

export type AgencyListInput = {
  status?: AgencyStatus;
  limit?: number;
  cursor?: string;
  signal?: AbortSignal;
};

export type AgenciesApi = {
  list(input?: AgencyListInput): Promise<AgencyPage>;
  get(id: string, signal?: AbortSignal): Promise<AgencyApplication>;
  approve(id: string): Promise<void>;
  requestChanges(id: string, reason: string): Promise<void>;
  reject(id: string, reason: string): Promise<void>;
};

/** Cuerpo vacío (204). */
const noContent = z.void();

/** Cliente de `/v1/agencies*` (revisión por el personal del MLS) sobre el cliente HTTP único. */
export function createAgenciesApi(http: HttpClient): AgenciesApi {
  const review = async (id: string, action: string, body?: { reason: string }) => {
    await http.request({
      host: 'country',
      path: `/agencies/${encodeURIComponent(id)}/${action}`,
      method: 'POST',
      ...(body ? { body } : {}),
      schema: noContent,
    });
  };

  return {
    list: ({ status, limit, cursor, signal } = {}) =>
      http.request({
        host: 'country',
        path: '/agencies',
        query: { status, limit, cursor },
        schema: agencyPageResponseSchema,
        ...(signal ? { signal } : {}),
      }),
    get: (id, signal) =>
      http.request({
        host: 'country',
        path: `/agencies/${encodeURIComponent(id)}`,
        schema: agencyApplicationResponseSchema,
        ...(signal ? { signal } : {}),
      }),
    approve: (id) => review(id, 'approve'),
    requestChanges: (id, reason) => review(id, 'request-changes', { reason }),
    reject: (id, reason) => review(id, 'reject', { reason }),
  };
}
