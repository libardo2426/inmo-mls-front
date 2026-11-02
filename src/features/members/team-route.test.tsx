import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { MeResponse } from '@/lib/api/schemas';
import { es } from '@/lib/i18n/es';
import {
  agentMeFixture,
  BROKER_AGENCY_ID,
  brokerMeFixture,
  invitationFixture,
  memberFixture,
  meWithPermissions,
} from '@/test/fixtures';
import { mountApp } from '@/test/mount';
import { server } from '@/test/server';

function backend(me: MeResponse) {
  const seen = { members: 0, invitations: 0 };
  server.use(
    http.get('*/v1/me', () => HttpResponse.json(me)),
    http.get(`*/v1/agencies/${BROKER_AGENCY_ID}/members`, () => {
      seen.members += 1;
      return HttpResponse.json([memberFixture()]);
    }),
    http.get(`*/v1/agencies/${BROKER_AGENCY_ID}/invitations`, () => {
      seen.invitations += 1;
      return HttpResponse.json({ items: [invitationFixture()], nextCursor: null });
    }),
  );
  return seen;
}

describe('ruta /equipo', () => {
  it('el broker ve las dos pestañas y la tabla de miembros con detalle', async () => {
    backend(brokerMeFixture());
    mountApp('/equipo');
    expect(await screen.findByRole('tab', { name: es.team.tabs.members })).toBeVisible();
    expect(screen.getByRole('tab', { name: es.team.tabs.invitations })).toBeVisible();
    expect(
      await screen.findByRole('button', { name: es.members.detail.open('Luis Demo') }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: es.nav.team })).toBeInTheDocument();
  });

  it('?tab=invitaciones abre la pestaña de invitaciones', async () => {
    backend(brokerMeFixture());
    mountApp('/equipo?tab=invitaciones');
    const panel = await screen.findByRole('tabpanel', { name: es.team.tabs.invitations });
    expect(await within(panel).findByText('nuevo@demo.test')).toBeInTheDocument();
  });

  it('cambiar de pestaña muestra las invitaciones', async () => {
    backend(brokerMeFixture());
    mountApp('/equipo');
    await userEvent.click(await screen.findByRole('tab', { name: es.team.tabs.invitations }));
    expect(await screen.findByText('nuevo@demo.test')).toBeInTheDocument();
  });

  it('un agent no ve «Equipo» y, si entra por la URL, ve «sin permiso» sin pedir miembros', async () => {
    const seen = backend(agentMeFixture());
    mountApp('/equipo');
    expect(await screen.findByText(es.states.forbiddenTitle)).toBeVisible();
    expect(screen.queryByRole('link', { name: es.nav.team })).not.toBeInTheDocument();
    expect(seen.members).toBe(0);
    expect(seen.invitations).toBe(0);
  });

  it('el personal del MLS (member.read de red, sin member.invite) tampoco entra', async () => {
    const seen = backend(meWithPermissions({ 'member.read': 'network', 'agency.list': 'network' }));
    mountApp('/equipo');
    expect(await screen.findByText(es.states.forbiddenTitle)).toBeVisible();
    await waitFor(() => expect(seen.members).toBe(0));
  });
});
