import { useMemo } from 'react';
import { useHttpClient } from '@/app/app-context';
import { createAuthApi, type AuthApi } from '../api/auth-api';

export function useAuthApi(): AuthApi {
  const http = useHttpClient();
  return useMemo(() => createAuthApi(http), [http]);
}
