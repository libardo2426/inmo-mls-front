import { createContext, useContext } from 'react';
import type { Theme } from './theme-storage';

export type ThemeContextValue = {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return value;
}
