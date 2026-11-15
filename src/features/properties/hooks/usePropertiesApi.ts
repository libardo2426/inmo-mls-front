import { useMemo } from 'react';
import { useHttpClient } from '@/app/app-context';
import { createPropertiesApi, type PropertiesApi } from '../api/properties-api';

export function usePropertiesApi(): PropertiesApi {
  const http = useHttpClient();
  return useMemo(() => createPropertiesApi(http), [http]);
}
