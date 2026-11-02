import { describe, expect, it } from 'vitest';
import { meWithPermissions } from '@/test/fixtures';
import { canTerminateMember, REASON_MAX } from './terminate-rules';

const admin = meWithPermissions({ 'member.read': 'network', 'member.terminate_any': 'network' });

describe('canTerminateMember', () => {
  it('permite terminar a un miembro activo con member.terminate_any de red', () => {
    expect(canTerminateMember(admin, { status: 'active' })).toBe(true);
  });

  it.each(['suspended', 'terminated'] as const)('no ofrece terminar a uno %s', (status) => {
    expect(canTerminateMember(admin, { status })).toBe(false);
  });

  it('compliance (solo member.read) no puede terminar', () => {
    const compliance = meWithPermissions({ 'member.read': 'network' });
    expect(canTerminateMember(compliance, { status: 'active' })).toBe(false);
  });

  it('member.terminate de agencia (broker) no basta', () => {
    const broker = meWithPermissions({ 'member.terminate': 'agency' });
    expect(canTerminateMember(broker, { status: 'active' })).toBe(false);
  });

  it('el motivo admite hasta 1000 caracteres', () => {
    expect(REASON_MAX).toBe(1000);
  });
});
