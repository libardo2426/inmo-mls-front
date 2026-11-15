import { useQuery } from '@tanstack/react-query';
import { propertyKeys } from '../api/keys';
import { usePropertiesApi } from './usePropertiesApi';

/** Ficha de un inmueble (`GET /v1/properties/{id}`). */
export function useProperty(id: string) {
  const api = usePropertiesApi();
  return useQuery({
    queryKey: propertyKeys.detail(id),
    queryFn: ({ signal }) => api.get(id, signal),
  });
}
