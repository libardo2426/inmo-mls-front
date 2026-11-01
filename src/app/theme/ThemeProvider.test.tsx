import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/app/theme/ThemeProvider';
import { ThemeToggle } from '@/app/theme/ThemeToggle';
import { useTheme } from '@/app/theme/useTheme';
import { es } from '@/lib/i18n/es';

function mockSystemPrefersDark(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: dark && query.includes('dark'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function Probe() {
  const { theme, resolved, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setTheme('light')}>claro</button>
      <button onClick={() => setTheme('dark')}>oscuro</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ThemeProvider', () => {
  it('sin valor guardado sigue la preferencia del sistema (oscuro)', () => {
    mockSystemPrefersDark(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('setTheme("light") quita la clase dark y guarda innmo-theme', async () => {
    mockSystemPrefersDark(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'claro' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('innmo-theme')).toBe('light');
  });

  it('con localStorage que lanza no rompe: usa system y cambia en memoria', async () => {
    mockSystemPrefersDark(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    await userEvent.click(screen.getByRole('button', { name: 'oscuro' }));
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
  });
});

describe('ThemeToggle', () => {
  it('tiene nombre accesible y alterna entre claro y oscuro', async () => {
    mockSystemPrefersDark(false);
    render(
      <ThemeProvider>
        <ThemeToggle />
        <Probe />
      </ThemeProvider>,
    );
    const toggle = screen.getByRole('button', { name: es.theme.toggle });
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    await userEvent.click(toggle);
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    await userEvent.click(toggle);
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
  });
});
