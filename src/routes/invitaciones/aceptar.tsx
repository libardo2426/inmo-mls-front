import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { InvitationAuthPanel } from '@/features/auth/components/InvitationAuthPanel';
import { enforce } from '@/features/auth/session/enforce';
import { ME_QUERY_KEY } from '@/features/auth/session/me';
import { AcceptInvitationScreen } from '@/features/invitations/screens/AcceptInvitationScreen';

export const Route = createFileRoute('/invitaciones/aceptar')({
  beforeLoad: async ({ context, location }) => {
    const state = await enforce('invitation', { context, location });
    return { sessionStatus: state.status };
  },
  component: AcceptInvitationRoute,
});

function AcceptInvitationRoute() {
  const { sessionStatus } = Route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  // `enforce('invitation')` solo deja pasar estas tres; las demás redirigen antes.
  const session =
    sessionStatus === 'authenticated' || sessionStatus === 'no-membership'
      ? sessionStatus
      : 'anonymous';

  return (
    <AcceptInvitationScreen
      session={session}
      renderAuth={(invitation, signedIn) => (
        <InvitationAuthPanel
          email={invitation.email}
          fullName={invitation.fullName}
          signedIn={signedIn}
          onChanged={() => void router.invalidate()}
        />
      )}
      onAccepted={() => {
        // Ahora hay membresía: se descarta `/me` y se entra al panel.
        queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
        void router.navigate({ to: '/' });
      }}
    />
  );
}
