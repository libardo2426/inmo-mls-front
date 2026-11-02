import { createContext, useContext } from 'react';
import type { MeResponse } from '@/lib/api/schemas';

export const MeContext = createContext<MeResponse | null>(null);

/** La sesión (`/me`) que provee el shell; lanza si se usa fuera de él. */
export function useMe(): MeResponse {
  const me = useContext(MeContext);
  if (!me) throw new Error('Falta <PermissionsProvider> en el árbol de React');
  return me;
}
