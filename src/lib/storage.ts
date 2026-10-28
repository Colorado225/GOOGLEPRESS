/**
 * Utilitaires purs du rangement atelier des commandes terminées.
 *
 * Organisation recommandée pour un pressing :
 * - A : portants — pièces livrées sur cintre/housse (pressing) ;
 * - B : étagères — linge plié en sacs pour retrait comptoir ;
 * - C : bac départ — commandes prêtes à partir en livraison ;
 * - D : volumineux — couettes, rideaux, lots professionnels ;
 * - E : attente — contrôle, écart de paquets ou client à rappeler.
 *
 * Les codes et capacités initiaux sont des propositions modifiables : ils
 * doivent être reportés tels quels sur les étiquettes physiques du local.
 */
import type { LaundryOrder, LogisticsTask, StorageLocation, StorageZone } from '../types';
import { normalizeText } from './utils';

export const STORAGE_LOCATIONS_STORAGE_KEY = 'pressingpro_storage_locations';

export const STORAGE_ZONE_LABELS: Record<StorageZone, string> = {
  hanging: 'Portant / cintres',
  folded: 'Étagère / plié',
  delivery: 'Départ livraison',
  bulky: 'Volumineux / pro',
  hold: 'Attente / contrôle',
  other: 'Autre rangement',
};

export const STORAGE_ZONE_DESCRIPTIONS: Record<StorageZone, string> = {
  hanging: 'Chemises, costumes, robes et pièces remises sur cintre ou sous housse.',
  folded: 'Linge plié, sacs client et commandes à retirer au comptoir.',
  delivery: 'Paquets regroupés avant départ du livreur.',
  bulky: 'Couettes, rideaux, gros volumes et lots professionnels.',
  hold: 'Commande à vérifier, paquet incomplet ou client à rappeler.',
  other: 'Emplacement défini librement selon le local.',
};

const BULKY_ITEM_IDS = new Set(['b7', 'b8']);
const BULKY_KEYWORDS = ['couette', 'edredon', 'rideau', 'voilage', 'linge pro', 'hotel'];
const HANGING_ITEM_IDS = new Set([
  'c1', // chemise
  'c2', // pantalon
  'c3', // robe
  'c4', // costume
  'c5', // boubou
  'c6', // veste & manteau
  'c8', // jupe
  'c11', // gilet
  'c16', // tailleur
  'c17', // combinaison & salopette
  'c19', // veste en cuir
  'c20', // doudoune
]);
const HANGING_KEYWORDS = [
  'chemise',
  'pantalon',
  'robe',
  'costume',
  'boubou',
  'manteau',
  'veste',
  'jupe',
  'gilet',
  'tailleur',
  'combinaison',
  'salopette',
  'doudoune',
  'blouse',
];

/** Code physique saisissable au clavier : lettres/chiffres séparés par tirets. */
export function normalizeStorageCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '-');
}

export function isValidStorageCode(value: string): boolean {
  const code = normalizeStorageCode(value);
  return code.length >= 2 && code.length <= 16 && /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code);
}

export function sanitizePackageCount(value: unknown): number | undefined {
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= 999 ? count : undefined;
}

const STORAGE_ZONES_SET = new Set<StorageZone>([
  'hanging',
  'folded',
  'delivery',
  'bulky',
  'hold',
  'other',
]);

/**
 * Nettoie un plan d'emplacements relu depuis le stockage local. Les entrées
 * illisibles ou en double sont écartées plutôt que de bloquer l'ouverture de
 * l'application ; un tableau vide explicitement enregistré est respecté.
 */
export function normalizeStorageLocations(
  value: unknown,
  fallback: StorageLocation[]
): StorageLocation[] {
  if (!Array.isArray(value)) return fallback;

  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();
  const normalized: StorageLocation[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Partial<StorageLocation>;
    const code = typeof raw.code === 'string' ? normalizeStorageCode(raw.code) : '';
    const label = typeof raw.label === 'string' ? raw.label.trim() : '';
    if (!isValidStorageCode(code) || !label || seenCodes.has(code)) continue;

    const id =
      typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `storage-${code}`;
    if (seenIds.has(id)) continue;

    seenIds.add(id);
    seenCodes.add(code);
    normalized.push({
      id,
      code,
      label,
      zone:
        typeof raw.zone === 'string' && STORAGE_ZONES_SET.has(raw.zone as StorageZone)
          ? (raw.zone as StorageZone)
          : 'other',
      capacityPackages: sanitizePackageCount(raw.capacityPackages) ?? 20,
      description:
        typeof raw.description === 'string' && raw.description.trim()
          ? raw.description.trim()
          : undefined,
      isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    });
  }

  return normalized;
}

/** Emplacements actifs d'abord, puis ordre de code identique au plan physique. */
export function compareStorageLocations(a: StorageLocation, b: StorageLocation): number {
  if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
  return a.code.localeCompare(b.code, 'fr-FR', { numeric: true, sensitivity: 'base' });
}

export function sortStorageLocations(locations: StorageLocation[]): StorageLocation[] {
  return [...locations].sort(compareStorageLocations);
}

export function formatStorageLocation(location: Pick<StorageLocation, 'code' | 'label'>): string {
  return `${location.code} · ${location.label}`;
}

/** Une affectation reliée à la liste des emplacements configurés. */
export function hasStructuredStorage(order: LaundryOrder): boolean {
  return Boolean(order.storageLocationId?.trim() || order.storageLocationCode?.trim());
}

/** Anciennes commandes avec un texte libre « Étagère B-04 », sans emplacement géré. */
export function hasLegacyStorage(order: LaundryOrder): boolean {
  return !hasStructuredStorage(order) && Boolean(order.rackLocation?.trim());
}

/** Toute indication physique connue, structurée ou ancienne. */
export function hasStorageLocation(order: LaundryOrder): boolean {
  return hasStructuredStorage(order) || hasLegacyStorage(order);
}

export function getOrderStorageCode(order: LaundryOrder): string | undefined {
  return order.storageLocationCode?.trim() || order.rackLocation?.trim() || undefined;
}

export function getOrderStorageLabel(order: LaundryOrder): string | undefined {
  const code = order.storageLocationCode?.trim();
  const label = order.storageLocationLabel?.trim();
  if (code && label) return `${code} · ${label}`;
  return code || order.rackLocation?.trim() || undefined;
}

/** Texte indexable d'un emplacement, y compris le code sans tiret (« A01 »). */
export function getOrderStorageSearchText(order: LaundryOrder): string {
  const label = getOrderStorageLabel(order) ?? '';
  const code = getOrderStorageCode(order) ?? '';
  const compactCode = code.replace(/[^a-z0-9]/gi, '');
  return [label, code, compactCode].filter(Boolean).join(' ');
}

export function getOrderPackageCount(order: LaundryOrder): number | undefined {
  return sanitizePackageCount(order.storagePackageCount);
}

export function formatPackageCount(order: LaundryOrder): string {
  const count = getOrderPackageCount(order);
  if (!count) return 'nombre de paquets non renseigné';
  return `${count} paquet${count > 1 ? 's' : ''}`;
}

/** IDs des commandes parties avec un livreur : elles n'occupent plus les rayons. */
export function getOrdersOutForDeliveryIds(tasks: LogisticsTask[]): Set<string> {
  return new Set(
    tasks
      .filter((task) => task.kind === 'delivery' && task.status === 'en_route' && task.orderId)
      .map((task) => task.orderId as string)
  );
}

/** Commandes prêtes, rangées dans un emplacement géré et encore dans le local. */
export function getCurrentlyStoredOrders(
  orders: LaundryOrder[],
  tasks: LogisticsTask[]
): LaundryOrder[] {
  const outForDelivery = getOrdersOutForDeliveryIds(tasks);
  return orders.filter(
    (order) =>
      order.status === 'ready' &&
      hasStructuredStorage(order) &&
      !outForDelivery.has(order.id)
  );
}

export interface StorageOccupancy {
  orderCount: number;
  /** Somme des paquets connus ; les anciennes affectations inconnues restent suivies. */
  packageCount: number;
  unknownPackageOrders: number;
}

export function calculateStorageOccupancy(
  orders: LaundryOrder[],
  tasks: LogisticsTask[]
): Map<string, StorageOccupancy> {
  const occupancy = new Map<string, StorageOccupancy>();
  for (const order of getCurrentlyStoredOrders(orders, tasks)) {
    const locationId = order.storageLocationId?.trim();
    if (!locationId) continue;
    const current = occupancy.get(locationId) ?? {
      orderCount: 0,
      packageCount: 0,
      unknownPackageOrders: 0,
    };
    current.orderCount += 1;
    const packages = getOrderPackageCount(order);
    if (packages) current.packageCount += packages;
    else current.unknownPackageOrders += 1;
    occupancy.set(locationId, current);
  }
  return occupancy;
}

export function getOccupancyPercent(
  location: StorageLocation,
  occupancy: StorageOccupancy | undefined
): number {
  if (!occupancy || location.capacityPackages <= 0) return 0;
  return Math.round((occupancy.packageCount / location.capacityPackages) * 100);
}

export function isStorageLocationSaturated(
  location: StorageLocation,
  occupancy: StorageOccupancy | undefined
): boolean {
  return Boolean(occupancy && occupancy.packageCount >= location.capacityPackages);
}

function isBulkyOrder(order: LaundryOrder): boolean {
  const totalQuantity = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  if (totalQuantity >= 25) return true;
  return order.lines.some((line) => {
    if (BULKY_ITEM_IDS.has(line.clothingItemId)) return true;
    const name = normalizeText(line.name);
    return BULKY_KEYWORDS.some((keyword) => name.includes(keyword));
  });
}

function hasHangingGarments(order: LaundryOrder): boolean {
  return order.lines.some((line) => {
    if (HANGING_ITEM_IDS.has(line.clothingItemId)) return true;
    const name = normalizeText(line.name);
    return HANGING_KEYWORDS.some((keyword) => name.includes(keyword));
  });
}

/**
 * Zone proposée selon le mode de remise et la nature des articles. Ce n'est
 * qu'une aide : l'employé choisit toujours l'emplacement exact au moment où
 * il range physiquement les paquets. Tous les paquets d'un même ticket
 * doivent normalement rester ensemble ; une seule pièce à suspendre suffit
 * donc à proposer le portant.
 */
export function getSuggestedStorageZone(order: LaundryOrder): StorageZone {
  if (isBulkyOrder(order)) return 'bulky';
  if ((order.fulfillmentMethod ?? 'counter_pickup') === 'home_delivery') return 'delivery';
  if (hasHangingGarments(order)) return 'hanging';
  return 'folded';
}

/** Pertinence d'un emplacement précis pour une commande (zone + mots des articles). */
export function scoreStorageLocationForOrder(
  order: LaundryOrder,
  location: StorageLocation
): number {
  let score = 0;
  const suggestedZone = getSuggestedStorageZone(order);
  if (location.zone === suggestedZone) score += 20;
  if (isBulkyOrder(order) && location.zone === 'bulky') score += 5;
  if (hasHangingGarments(order) && location.zone === 'hanging') score += 5;
  if (
    (order.fulfillmentMethod ?? 'counter_pickup') === 'home_delivery' &&
    location.zone === 'delivery'
  ) {
    score += 5;
  }

  const locationText = normalizeText(`${location.label} ${location.description ?? ''}`);
  const genericTerms = new Set([
    'linge',
    'piece',
    'pieces',
    'ensemble',
    'pressing',
    'commande',
    'paquet',
    'paquets',
  ]);
  const articleTerms = new Set(
    order.lines.flatMap((line) =>
      normalizeText(line.name)
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length >= 4 && !genericTerms.has(term))
    )
  );
  for (const term of articleTerms) {
    if (locationText.includes(term)) score += 4;
  }
  return score;
}

/**
 * Emplacement proposé par défaut : meilleur score métier, puis emplacement
 * le moins rempli. Un emplacement saturé n'est choisi que s'il n'y a aucune
 * alternative dans la zone adaptée.
 */
export function getSuggestedStorageLocation(
  order: LaundryOrder,
  locations: StorageLocation[],
  occupancyByLocation: ReadonlyMap<string, StorageOccupancy> = new Map()
): StorageLocation | undefined {
  const activeLocations = sortStorageLocations(locations).filter(
    (location) => location.isActive
  );
  if (activeLocations.length === 0) return undefined;

  const suggestedZone = getSuggestedStorageZone(order);
  const inSuggestedZone = activeLocations.filter(
    (location) => location.zone === suggestedZone
  );
  const candidates = inSuggestedZone.length > 0 ? inSuggestedZone : activeLocations;

  return [...candidates].sort((a, b) => {
    const aOccupancy = occupancyByLocation.get(a.id);
    const bOccupancy = occupancyByLocation.get(b.id);
    const aSaturated = isStorageLocationSaturated(a, aOccupancy) ? 1 : 0;
    const bSaturated = isStorageLocationSaturated(b, bOccupancy) ? 1 : 0;
    if (aSaturated !== bSaturated) return aSaturated - bSaturated;

    const scoreDiff =
      scoreStorageLocationForOrder(order, b) - scoreStorageLocationForOrder(order, a);
    if (scoreDiff !== 0) return scoreDiff;

    const occupancyDiff =
      getOccupancyPercent(a, aOccupancy) - getOccupancyPercent(b, bOccupancy);
    if (occupancyDiff !== 0) return occupancyDiff;
    return compareStorageLocations(a, b);
  })[0];
}
