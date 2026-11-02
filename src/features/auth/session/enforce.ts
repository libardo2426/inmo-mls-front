import { redirect } from '@tanstack/react-router';
import type { RouterContext } from '@/app/router-context';
import { guardTarget, type GuardRule } from './guard';
import { resolveSession, type SessionState } from './me';

type EnforceArgs = { context: RouterContext; location: { href: string } };

/**
 * Guarda de ruta (`beforeLoad`): resuelve la sesión y redirige según la regla de la ruta.
 * Devuelve el estado resuelto para que la ruta pueda ponerlo en su contexto.
 */
export async function enforce(
  rule: GuardRule,
  { context, location }: EnforceArgs,
): Promise<SessionState> {
  const state = await resolveSession(context.queryClient, context.http);
  const target = guardTarget(rule, state, location.href);
  if (target) throw redirect(target as Parameters<typeof redirect>[0]);
  return state;
}
