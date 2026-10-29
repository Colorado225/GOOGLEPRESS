import { useEffect, useState } from 'react';
import { applyTheme, getInitialTheme, persistTheme, type AppTheme } from '../../lib/theme';

export interface ThemeStore {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

/**
 * Thème d'interface clair/sombre (lib/theme.ts) : classe `dark` sur <html>,
 * mémorisé dans ce navigateur (pressingpro_theme), défaut = préférence système.
 */
export const useTheme = (): ThemeStore => {
  const [theme, setThemeState] = useState<AppTheme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (next: AppTheme) => {
    persistTheme(next);
    setThemeState(next);
  };
  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      persistTheme(next);
      return next;
    });
  };

  return { theme, setTheme, toggleTheme };
};
