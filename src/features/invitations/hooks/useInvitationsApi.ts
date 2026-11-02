import { useMemo } from 'react';
import { useHttpClient } from '@/app/app-context';
import { createInvitationsApi, type InvitationsApi } from '../api/invitations-api';

export function useInvitationsApi(): InvitationsApi {
  const http = useHttpClient();
  return useMemo(() => createInvitationsApi(http), [http]);
}
