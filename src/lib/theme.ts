/**
 * Thème d'interface (clair / sombre) — PressingPro CI.
 *
 * Le thème est appliqué via la classe `dark` sur <html> (variante Tailwind
 * `dark:` définie dans index.css, volontairement désactivée à l'impression :
 * ticket thermique et rapports restent toujours en clair sur papier).
 * Le choix est mémorisé dans ce navigateur (`pressingpro_theme`) ; au premier
 * lancement, la préférence système (prefers-color-scheme) est suivie.
 * Un script anti-clignotement dans index.html pose la classe avant le premier
 * affichage — `getInitialTheme()` lit cette classe pour rester cohérent.
 */
export type AppTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'pressingpro_theme';

/** Règle de résolution pure : choix mémorisé s'il est valide, sinon système. */
export function resolveTheme(stored: string | null, prefersDark: boolean): AppTheme {
  if (stored === 'dark' || stored === 'light') return stored;
  return prefersDark ? 'dark' : 'light';
}

export function getInitialTheme(): AppTheme {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark';
  }
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    stored = null;
  }
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return resolveTheme(stored, prefersDark);
}

export function persistTheme(theme: AppTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* stockage indisponible : le thème restera valable pour la session */
  }
}

/** Applique le thème au document : classe `dark`, color-scheme natif, barre du navigateur. */
export function applyTheme(theme: AppTheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#09090b' : '#f4f4f5');
}
