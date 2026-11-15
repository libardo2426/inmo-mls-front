import { propertyDetailResponseSchema, type PropertyDetailResponse } from '@/lib/api/schemas';
import type { HttpClient } from '@/lib/http';
import type { PropertyFilters } from '../model';
import { propertyPageSchema, type PropertyPage } from './property-list-schema';

export type PropertyListInput = PropertyFilters & {
  limit?: number;
  cursor?: string;
  signal?: AbortSignal;
};

export type PropertiesApi = {
  list(input?: PropertyListInput): Promise<PropertyPage>;
  get(id: string, signal?: AbortSignal): Promise<PropertyDetailResponse>;
};

/** Cliente de `/v1/properties*` (solo lectura) sobre el cliente HTTP único. */
export function createPropertiesApi(http: HttpClient): PropertiesApi {
  return {
    list: ({ type, status, territory, agency, limit, cursor, signal } = {}) =>
      http.request({
        host: 'country',
        path: '/properties',
        query: {
          propertyType: type,
          status,
          territorialUnitCode: territory,
          agencyId: agency,
          limit,
          cursor,
        },
        schema: propertyPageSchema,
        ...(signal ? { signal } : {}),
      }),
    get: (id, signal) =>
      http.request({
        host: 'country',
        path: `/properties/${encodeURIComponent(id)}`,
        schema: propertyDetailResponseSchema,
        ...(signal ? { signal } : {}),
      }),
  };
}
