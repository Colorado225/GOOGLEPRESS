/**
 * Ordre personnalisable des entrées de la barre latérale.
 *
 * Les fonctions sont pures : elles ne touchent ni au DOM ni au localStorage,
 * ce qui permet de les tester et de les réutiliser tel quel plus tard si
 * l'ordre devient une préférence stockée côté serveur.
 */

export const SIDEBAR_ORDER_STORAGE_KEY = 'pressingpro_sidebar_order';

/** Identifiants stables des entrées, indépendants de leur position. */
export const DEFAULT_SIDEBAR_ORDER = [
  'dashboard',
  'pos',
  'workshop',
  'clients',
  'employees',
  'inventory',
  'expenses',
  'reports',
  'settings',
] as const;

/**
 * Anciennes clés de premier niveau, devenues des sous-onglets de l'atelier.
 *
 * Une sauvegarde d'ordre antérieure contient encore `workshop:storage` ou
 * `closing` : elles sont ramenées vers le groupe `workshop` sans perdre la
 * position choisie par l'utilisateur.
 */
export const LEGACY_SIDEBAR_KEYS: Readonly<Record<string, string>> = {
  'workshop:production': 'workshop',
  'workshop:storage': 'workshop',
  'workshop:logistics': 'workshop',
  closing: 'workshop',
};

/**
 * Fusionne un ordre enregistré avec les entrées réellement disponibles.
 *
 * - les identifiants inconnus (entrée supprimée depuis) sont ignorés ;
 * - les entrées nouvelles, absentes de l'ordre enregistré, sont ajoutées à la
 *   fin dans leur ordre par défaut ;
 * - les doublons sont écartés.
 *
 * Une sauvegarde corrompue ne doit jamais vider la navigation : en cas de
 * valeur inexploitable, l'ordre par défaut est renvoyé.
 */
export const mergeSidebarOrder = (
  saved: unknown,
  available: readonly string[],
  aliases: Readonly<Record<string, string>> = LEGACY_SIDEBAR_KEYS
): string[] => {
  const availableSet = new Set(available);
  if (!Array.isArray(saved)) return [...available];

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of saved) {
    if (typeof value !== 'string') continue;
    const canonical = aliases[value] ?? value;
    if (!availableSet.has(canonical) || seen.has(canonical)) continue;
    seen.add(canonical);
    ordered.push(canonical);
  }
  for (const id of available) {
    if (!seen.has(id)) ordered.push(id);
  }
  return ordered;
};

/** Lit une sauvegarde JSON sans jamais lever d'exception. */
export const parseSidebarOrder = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Déplace une entrée de `delta` positions (négatif = vers le haut).
 * Les bornes sont respectées : aucun élément ne sort de la liste.
 */
export const moveSidebarItem = (
  order: readonly string[],
  id: string,
  delta: number
): string[] => {
  const index = order.indexOf(id);
  if (index === -1 || delta === 0) return [...order];
  const target = Math.min(order.length - 1, Math.max(0, index + delta));
  if (target === index) return [...order];
  const next = [...order];
  next.splice(index, 1);
  next.splice(target, 0, id);
  return next;
};

/**
 * Place `draggedId` à la position de `targetId` (avant ou après selon le sens
 * du déplacement). Utilisé par le glisser-déposer.
 */
export const reorderSidebarItems = (
  order: readonly string[],
  draggedId: string,
  targetId: string
): string[] => {
  if (draggedId === targetId) return [...order];
  const from = order.indexOf(draggedId);
  const to = order.indexOf(targetId);
  if (from === -1 || to === -1) return [...order];
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, draggedId);
  return next;
};

/** Vrai si l'ordre courant diffère de l'ordre par défaut fourni. */
export const isCustomSidebarOrder = (
  order: readonly string[],
  defaultOrder: readonly string[]
): boolean =>
  order.length !== defaultOrder.length ||
  order.some((id, index) => id !== defaultOrder[index]);
