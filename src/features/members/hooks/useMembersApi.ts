import { useMemo } from 'react';
import { useHttpClient } from '@/app/app-context';
import { createMembersApi, type MembersApi } from '../api/members-api';

export function useMembersApi(): MembersApi {
  const http = useHttpClient();
  return useMemo(() => createMembersApi(http), [http]);
}
