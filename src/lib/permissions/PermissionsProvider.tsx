import type { ReactNode } from 'react';
import type { MeResponse } from '@/lib/api/schemas';
import { MeContext } from './context';

/** Pone la sesión (`/me`) a disposición de `useCan`, `<Can>` y el menú. */
export function PermissionsProvider({ me, children }: { me: MeResponse; children: ReactNode }) {
  return <MeContext value={me}>{children}</MeContext>;
}
