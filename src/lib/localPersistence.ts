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

/** Indique si une clé existe, sans interpréter son contenu. */
export function hasPersistedValue(key: string, storage?: JsonStorage): boolean {
  const target = getBrowserStorage(storage);
  if (!target) return false;

  try {
    return target.getItem(key) !== null;
  } catch (error) {
    console.warn('LocalStorage load error', error);
    return false;
  }
}

/** Lit une valeur textuelle simple (par exemple un compteur), sans JSON. */
export function loadPersistedString(
  key: string,
  storage?: JsonStorage
): string | null {
  const target = getBrowserStorage(storage);
  if (!target) return null;

  try {
    return target.getItem(key);
  } catch (error) {
    console.warn('LocalStorage load error', error);
    return null;
  }
}

/** Écrit une valeur textuelle simple. Retourne false en cas de refus. */
export function persistString(
  key: string,
  value: string,
  storage?: JsonStorage
): boolean {
  const target = getBrowserStorage(storage);
  if (!target) return false;

  try {
    target.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('LocalStorage save error', error);
    return false;
  }
}

let localIdFallbackCounter = 0;

function createRandomIdSuffix(): string {
  const cryptoObject = globalThis.crypto;
  if (typeof cryptoObject?.randomUUID === 'function') {
    return cryptoObject.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  if (typeof cryptoObject?.getRandomValues === 'function') {
    const bytes = new Uint8Array(new ArrayBuffer(6));
    cryptoObject.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // Repli pour les environnements de test très anciens : l'horodatage passé
  // à createLocalId et ce compteur monotone évitent les collisions dans la
  // même session sans recourir à Math.random.
  localIdFallbackCounter += 1;
  return `fallback${localIdFallbackCounter.toString(36)}`;
}

/**
 * Identifiant temporaire local. Les entités persistées côté serveur doivent
 * utiliser les UUID PostgreSQL ; cet identifiant ne constitue jamais une
 * preuve d'autorisation. Le troisième paramètre reste injectable uniquement
 * pour les tests déterministes historiques.
 */
export function createLocalId(
  prefix: string,
  now = Date.now(),
  random?: number
): string {
  const suffix =
    random === undefined
      ? createRandomIdSuffix()
      : random.toString(36).slice(2, 6);
  return `${prefix}-${now}-${suffix}`;
}
