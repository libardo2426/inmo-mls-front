export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'innmo-theme';

const THEMES: readonly string[] = ['light', 'dark', 'system'];

/** Lee el tema guardado; devuelve null si no hay valor o el almacenamiento falla. */
export function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value !== null && THEMES.includes(value) ? (value as Theme) : null;
  } catch {
    return null;
  }
}

/** Guarda el tema; si el almacenamiento está bloqueado, se ignora (queda en memoria). */
export function writeStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* almacenamiento no disponible */
  }
}
