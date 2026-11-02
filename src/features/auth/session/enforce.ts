import { redirect } from '@tanstack/react-router';
import type { RouterContext } from '@/app/router-context';
import { guardTarget, type GuardRule } from './guard';
import { resolveSession } from './me';

type EnforceArgs = { context: RouterContext; location: { href: string } };

/** Guarda de ruta (`beforeLoad`): resuelve la sesión y redirige según la regla de la ruta. */
export async function enforce(rule: GuardRule, { context, location }: EnforceArgs): Promise<void> {
  const state = await resolveSession(context.queryClient, context.http);
  const target = guardTarget(rule, state, location.href);
  if (target) throw redirect(target as Parameters<typeof redirect>[0]);
}
