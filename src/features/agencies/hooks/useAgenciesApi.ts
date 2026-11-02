import { useMemo } from 'react';
import { useHttpClient } from '@/app/app-context';
import { createAgenciesApi, type AgenciesApi } from '../api/agencies-api';

export function useAgenciesApi(): AgenciesApi {
  const http = useHttpClient();
  return useMemo(() => createAgenciesApi(http), [http]);
}
