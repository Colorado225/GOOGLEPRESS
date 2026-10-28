/**
 * Petite frontière de persistance locale.
 *
 * Ces helpers vivaient dans AppContext. Les extraire ne remplace pas encore
 * les repositories Supabase, mais cela isole l'accès au localStorage, le rend
 * testable et prépare une décomposition du contexte par domaine.
 */

export const TICKET_COUNTER_STORAGE_KEY = 'pressingpro_next_ticket_number';

export interface JsonStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getBrowserStorage(storage?: JsonStorage): JsonStorage | null {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
}

/** Extrait le numéro d'un libellé de ticket ("#TK-2854" → 2854), 0 si illisible. */
export function parseTicketNumber(ticketNumber: string): number {
  const match = ticketNumber.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Chargement JSON avec repli explicite si la clé est absente ou illisible. */
export function loadPersistedState<T>(
  key: string,
  fallback: T,
  storage?: JsonStorage
): T {
  const target = getBrowserStorage(storage);
  if (!target) return fallback;

  try {
    const saved = target.getItem(key);
    if (saved) return JSON.parse(saved) as T;
  } catch (error) {
    console.warn('LocalStorage load error', error);
  }
  return fallback;
}

/** Écriture JSON best-effort. Retourne false si le navigateur refuse l'écriture. */
export function persistState(
  key: string,
  value: unknown,
  storage?: JsonStorage
): boolean {
  const target = getBrowserStorage(storage);
  if (!target) return false;

  try {
    target.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('LocalStorage save error', error);
    return false;
  }
}

/** Identifiant local lisible, suffisant pour les données mono-navigateur actuelles. */
export function createLocalId(
  prefix: string,
  now = Date.now(),
  random = Math.random()
): string {
  return `${prefix}-${now}-${random.toString(36).slice(2, 6)}`;
}
