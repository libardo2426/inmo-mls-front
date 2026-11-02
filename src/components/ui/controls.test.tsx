import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { NativeSelect } from './native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

describe('NativeSelect', () => {
  it('cambia de valor con la selección del usuario y respeta su etiqueta', async () => {
    render(
      <>
        <label htmlFor="rol">Rol</label>
        <NativeSelect id="rol" defaultValue="agent">
          <option value="agent">Agente</option>
          <option value="broker">Broker</option>
        </NativeSelect>
      </>,
    );
    const select = screen.getByRole('combobox', { name: 'Rol' });
    expect(select).toHaveValue('agent');
    await userEvent.selectOptions(select, 'broker');
    expect(select).toHaveValue('broker');
  });
});

describe('Tabs', () => {
  it('muestra solo el panel activo y cambia al pulsar otra pestaña', async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Uno</TabsTrigger>
          <TabsTrigger value="b">Dos</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel uno</TabsContent>
        <TabsContent value="b">Panel dos</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText('Panel uno')).toBeVisible();
    expect(screen.queryByText('Panel dos')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Dos' }));
    expect(screen.getByText('Panel dos')).toBeVisible();
    expect(screen.queryByText('Panel uno')).not.toBeInTheDocument();
  });
});
