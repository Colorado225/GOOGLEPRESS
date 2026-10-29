import type { ClothingItem, PressingServiceType, PressingSettings } from '../types';

/**
 * Prestations du pressing.
 *
 * Un **type de prestation** est un traitement appliqué au vêtement :
 * « Lavage + Repassage », « Nettoyage à sec », « Repassage seul », « Teinture »…
 * La liste est réglée dans les Paramètres, avec le prix de chaque vêtement pour
 * chaque prestation.
 *
 * « Express 24h » n'est PAS un traitement : c'est un **type de service**
 * (normal ou express) qui s'applique à la commande entière et double le
 * montant des prestations (voir `EXPRESS_SURCHARGE_RATE` dans `pricing.ts`).
 */

export const MAX_PRESSING_SERVICES = 8;
export const MAX_PRESSING_PRICE_XOF = 1_000_000;

/** Prestations proposées au départ ; libellés modifiables dans les Paramètres. */
export const DEFAULT_PRESSING_SERVICES: readonly PressingServiceType[] = [
  { id: 'wash_iron', label: 'Lavage + Repassage' },
  { id: 'dry_clean', label: 'Nettoyage à sec' },
  { id: 'iron_only', label: 'Repassage seul' },
  { id: 'dye', label: 'Teinture' },
] as const;

export const EMPTY_PRESSING_SETTINGS: PressingSettings = {
  services: DEFAULT_PRESSING_SERVICES.map((service) => ({ ...service })),
  prices: {},
};

/** Clé du prix d'un article pour une prestation. */
export const pressingPriceKey = (itemId: string, serviceId: string): string =>
  `${itemId}:${serviceId}`;

const toPrice = (value: unknown): number | null => {
  const numeric =
    typeof value === 'string' ? Number(value.replace(/[\s\u00a0]/g, '')) : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 0 || rounded > MAX_PRESSING_PRICE_XOF) return null;
  return rounded;
};

const toText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

/**
 * Nettoie les prestations lues depuis la sauvegarde locale : libellés vides
 * écartés, doublons supprimés, prix hors bornes ignorés. Si plus aucune
 * prestation ne subsiste, la liste par défaut revient — sans quoi le comptoir
 * n'aurait plus rien à proposer.
 */
export const normalizePressingSettings = (value: unknown): PressingSettings => {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<PressingSettings>;
  const rawServices = Array.isArray(source.services) ? source.services : [];
  const seenIds = new Set<string>();
  const services: PressingServiceType[] = [];

  for (const rawService of rawServices) {
    if (!rawService || typeof rawService !== 'object') continue;
    const label = toText((rawService as PressingServiceType).label);
    if (!label) continue;
    const id = toText((rawService as PressingServiceType).id) || `svc-${services.length + 1}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    services.push({ id, label });
    if (services.length >= MAX_PRESSING_SERVICES) break;
  }

  const rawPrices = (source.prices && typeof source.prices === 'object' ? source.prices : {}) as Record<
    string,
    unknown
  >;
  const prices: Record<string, number> = {};
  for (const [key, rawPrice] of Object.entries(rawPrices)) {
    const separator = key.lastIndexOf(':');
    if (separator <= 0 || separator === key.length - 1) continue;
    const price = toPrice(rawPrice);
    if (price === null) continue;
    prices[key] = price;
  }

  return {
    services: services.length > 0 ? services : DEFAULT_PRESSING_SERVICES.map((service) => ({ ...service })),
    prices,
  };
};

/** Message d'erreur des réglages, ou `null` s'ils sont enregistrables. */
export const validatePressingSettings = (settings: PressingSettings): string | null => {
  if (settings.services.length === 0) {
    return 'Ajoutez au moins un type de prestation.';
  }
  if (settings.services.length > MAX_PRESSING_SERVICES) {
    return `Vous ne pouvez pas dépasser ${MAX_PRESSING_SERVICES} types de prestation.`;
  }
  const labels = new Set<string>();
  const ids = new Set<string>();
  for (const service of settings.services) {
    const label = service.label.trim();
    if (!label) return 'Chaque type de prestation doit avoir un nom.';
    const normalizedLabel = label.toLowerCase();
    if (labels.has(normalizedLabel)) {
      return `La prestation « ${label} » existe déjà.`;
    }
    labels.add(normalizedLabel);
    if (!service.id.trim()) return 'Identifiant de prestation manquant.';
    if (ids.has(service.id)) return `La prestation « ${label} » est en double.`;
    ids.add(service.id);
  }
  for (const [key, price] of Object.entries(settings.prices)) {
    if (!Number.isInteger(price) || price < 0 || price > MAX_PRESSING_PRICE_XOF) {
      return `Prix invalide pour ${key}.`;
    }
  }
  return null;
};

/** Libellé d'une prestation à partir de son identifiant. */
export const getPressingServiceLabel = (
  settings: PressingSettings,
  serviceId: string
): string =>
  settings.services.find((service) => service.id === serviceId)?.label ?? '';

/**
 * Prix d'un vêtement pour une prestation.
 *
 * Le prix réglé dans les Paramètres prime ; à défaut, le prix de base du
 * catalogue s'applique (aucun tarif n'est inventé).
 */
export const resolvePressingPrice = (
  item: Pick<ClothingItem, 'id' | 'unitPrice'>,
  settings: PressingSettings,
  serviceId: string
): number => {
  const configured = settings.prices[pressingPriceKey(item.id, serviceId)];
  return Number.isInteger(configured) && configured >= 0 ? configured : item.unitPrice;
};

/** `true` si le propriétaire a fixé un prix spécifique pour ce couple. */
export const hasPressingPrice = (
  settings: PressingSettings,
  itemId: string,
  serviceId: string
): boolean => Number.isInteger(settings.prices[pressingPriceKey(itemId, serviceId)]);

export interface PressingCatalogEntry {
  legacyKey: string;
  name: string;
  unitPrice: number;
  unitLabel: string;
  serviceType: string;
  sortOrder: number;
}

/**
 * Lignes de catalogue à refléter côté Supabase : un article par vêtement et
 * par prestation, à clé stable (`pressing:<prestation>:<article>`), pour que
 * la RPC serveur tarife la bonne prestation.
 */
export const buildPressingCatalogEntries = (
  items: readonly ClothingItem[],
  settings: PressingSettings
): PressingCatalogEntry[] => {
  const entries: PressingCatalogEntry[] = [];
  let sortOrder = 10;

  for (const service of settings.services) {
    for (const item of items) {
      if (item.serviceCategory !== 'pressing' && item.serviceCategory !== 'both') continue;
      entries.push({
        legacyKey: `pressing:${service.id}:${item.id}`,
        name: `${item.name} — ${service.label}`,
        unitPrice: resolvePressingPrice(item, settings, service.id),
        unitLabel: item.unitLabel || 'pièce',
        serviceType: service.label,
        sortOrder,
      });
      sortOrder += 10;
    }
  }

  return entries;
};
