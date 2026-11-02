import { describe, expect, it } from 'vitest';
import { agentMeFixture, brokerMeFixture, meFixture, meWithPermissions } from '@/test/fixtures';
import {
  canChangeRole,
  canLeaveAgency,
  canTerminateMember,
  isSelf,
  reasonRequiredFor,
  REASON_MAX,
} from './terminate-rules';

const admin = meWithPermissions({ 'member.read': 'network', 'member.terminate_any': 'network' });
const broker = brokerMeFixture();
const other = { userId: '0192a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a99' };

describe('canTerminateMember', () => {
  it('permite terminar a un miembro activo con member.terminate_any de red', () => {
    expect(canTerminateMember(admin, { status: 'active', ...other })).toBe(true);
  });

  it('un broker (member.terminate de agencia) puede terminar a otro miembro activo', () => {
    expect(canTerminateMember(broker, { status: 'active', ...other })).toBe(true);
  });

  it('un broker no puede terminar su propia fila', () => {
    expect(canTerminateMember(broker, { status: 'active', userId: broker.user.id })).toBe(false);
  });

  it.each(['suspended', 'terminated'] as const)('no ofrece terminar a uno %s', (status) => {
    expect(canTerminateMember(admin, { status, ...other })).toBe(false);
    expect(canTerminateMember(broker, { status, ...other })).toBe(false);
  });

  it('compliance (solo member.read) no puede terminar', () => {
    const compliance = meWithPermissions({ 'member.read': 'network' });
    expect(canTerminateMember(compliance, { status: 'active', ...other })).toBe(false);
  });

  it('un agent (member.terminate solo propio) no puede terminar a otros', () => {
    expect(canTerminateMember(agentMeFixture(), { status: 'active', ...other })).toBe(false);
  });

  it('el motivo admite hasta 1000 caracteres', () => {
    expect(REASON_MAX).toBe(1000);
  });
});

describe('canChangeRole', () => {
  it('un broker puede cambiar el rol de otro miembro activo', () => {
    expect(canChangeRole(broker, { status: 'active', ...other })).toBe(true);
  });

  it('no sobre sí mismo ni sobre miembros no activos', () => {
    expect(canChangeRole(broker, { status: 'active', userId: broker.user.id })).toBe(false);
    expect(canChangeRole(broker, { status: 'terminated', ...other })).toBe(false);
  });

  it('ni el admin del MLS, ni compliance, ni un agent', () => {
    expect(canChangeRole(admin, { status: 'active', ...other })).toBe(false);
    expect(canChangeRole(agentMeFixture(), { status: 'active', ...other })).toBe(false);
  });
});

describe('isSelf, reasonRequiredFor y canLeaveAgency', () => {
  it('isSelf compara el id de usuario, no el rol', () => {
    expect(isSelf(broker, { userId: broker.user.id })).toBe(true);
    expect(isSelf(broker, other)).toBe(false);
  });

  it('el motivo es obligatorio solo con member.terminate_any', () => {
    expect(reasonRequiredFor(admin)).toBe(true);
    expect(reasonRequiredFor(broker)).toBe(false);
  });

  it('cualquier miembro de una inmobiliaria puede irse; el personal del MLS no', () => {
    expect(canLeaveAgency(broker)).toBe(true);
    expect(canLeaveAgency(agentMeFixture())).toBe(true);
    expect(canLeaveAgency(meFixture())).toBe(false);
  });
});
