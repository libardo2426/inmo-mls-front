import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InvitationsSection } from '@/features/invitations/components/InvitationsSection';
import { MembersSection } from '@/features/members/components/MembersSection';
import { es } from '@/lib/i18n/es';
import { assertCan, PermissionDeniedError, useMe } from '@/lib/permissions';

const searchSchema = z.object({
  tab: z.enum(['miembros', 'invitaciones']).catch('miembros'),
});

export const Route = createFileRoute('/_protegido/equipo')({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: ({ context }) => {
    assertCan(context.me, 'member.invite', 'agency');
    // El equipo es el de la propia inmobiliaria: sin ella no hay nada que mostrar.
    if (!context.me.membership?.agencyId) throw new PermissionDeniedError();
  },
  component: TeamRoute,
});

function TeamRoute() {
  const me = useMe();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  // `beforeLoad` garantiza que la sesión tiene inmobiliaria; nunca se toma de la URL.
  const agencyId = me.membership?.agencyId ?? '';

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader title={es.team.title} />
      <Tabs
        value={tab}
        onValueChange={(next) =>
          void navigate({ search: { tab: next === 'invitaciones' ? 'invitaciones' : 'miembros' } })
        }
      >
        <TabsList>
          <TabsTrigger value="miembros">{es.team.tabs.members}</TabsTrigger>
          <TabsTrigger value="invitaciones">{es.team.tabs.invitations}</TabsTrigger>
        </TabsList>
        <TabsContent value="miembros">
          <MembersSection agencyId={agencyId} detail />
        </TabsContent>
        <TabsContent value="invitaciones">
          <InvitationsSection agencyId={agencyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
