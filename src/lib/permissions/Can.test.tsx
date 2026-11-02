import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { MeResponse } from '@/lib/api/schemas';
import { meFixture } from '@/test/fixtures';
import { Can } from './Can';
import { PermissionsProvider } from './PermissionsProvider';
import { useCan } from './useCan';

function meWith(permissions: Record<string, 'own' | 'agency' | 'network'>): MeResponse {
  const me = meFixture();
  if (!me.membership) throw new Error('la fixture debe traer membresía');
  return { ...me, membership: { ...me.membership, permissions } };
}

function wrap(me: MeResponse, children: ReactNode) {
  return <PermissionsProvider me={me}>{children}</PermissionsProvider>;
}

describe('<Can>', () => {
  it('renderiza los hijos si el permiso existe', () => {
    render(wrap(meWith({ 'agency.list': 'network' }), <Can permission="agency.list">visible</Can>));
    expect(screen.getByText('visible')).toBeInTheDocument();
  });

  it('renderiza el fallback si el permiso falta, o nada sin fallback', () => {
    const me = meWith({});
    const { rerender } = render(
      wrap(
        me,
        <Can permission="agency.list" fallback={<span>sin permiso</span>}>
          visible
        </Can>,
      ),
    );
    expect(screen.getByText('sin permiso')).toBeInTheDocument();
    expect(screen.queryByText('visible')).not.toBeInTheDocument();
    rerender(wrap(me, <Can permission="agency.list">visible</Can>));
    expect(screen.queryByText('visible')).not.toBeInTheDocument();
  });

  it('respeta minScope', () => {
    render(
      wrap(
        meWith({ 'agency.read': 'agency' }),
        <>
          <Can permission="agency.read" minScope="agency">
            alcance-agencia
          </Can>
          <Can permission="agency.read" minScope="network">
            alcance-red
          </Can>
        </>,
      ),
    );
    expect(screen.getByText('alcance-agencia')).toBeInTheDocument();
    expect(screen.queryByText('alcance-red')).not.toBeInTheDocument();
  });

  it('reacciona cuando cambia el me del proveedor', () => {
    const ui = (me: MeResponse) => wrap(me, <Can permission="agency.list">visible</Can>);
    const { rerender } = render(ui(meWith({})));
    expect(screen.queryByText('visible')).not.toBeInTheDocument();
    rerender(ui(meWith({ 'agency.list': 'network' })));
    expect(screen.getByText('visible')).toBeInTheDocument();
  });
});

describe('useCan', () => {
  function Probe() {
    const can = useCan();
    return <p>{can('agency.list') ? 'si' : 'no'}</p>;
  }

  it('lanza fuera del proveedor', () => {
    const spy = console.error;
    console.error = () => undefined;
    try {
      expect(() => render(<Probe />)).toThrow('Falta <PermissionsProvider>');
    } finally {
      console.error = spy;
    }
  });

  it('responde según el me del proveedor', () => {
    render(wrap(meWith({ 'agency.list': 'network' }), <Probe />));
    expect(screen.getByText('si')).toBeInTheDocument();
  });
});
