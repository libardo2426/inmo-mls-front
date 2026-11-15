import type { HttpClient } from '@/lib/http';
import type { PropertyFilters } from '../model';
import { propertyDetailSchema, type PropertyDetail } from './property-detail-schema';
import { propertyPageSchema, type PropertyPage } from './property-list-schema';

export type PropertyListInput = PropertyFilters & {
  limit?: number;
  cursor?: string;
  signal?: AbortSignal;
};

export type PropertiesApi = {
  list(input?: PropertyListInput): Promise<PropertyPage>;
  get(id: string, signal?: AbortSignal): Promise<PropertyDetail>;
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
        schema: propertyDetailSchema,
        ...(signal ? { signal } : {}),
      }),
  };
}
