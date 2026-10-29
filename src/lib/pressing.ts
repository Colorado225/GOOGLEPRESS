import type {
  ClothingItem,
  PressingPricingMode,
  PressingServiceType,
  PressingSettings,
  PricingType,
} from '../types';

/**
 * Prestations du pressing : traitement, modèle de facturation et tarifs.
 * « Express 24h » reste un délai ligne par ligne, jamais une prestation.
 */

export const MAX_PRESSING_SERVICES = 8;
export const MAX_PRESSING_PRICE_XOF = 1_000_000;
export const MAX_PRESSING_WEIGHT_KG = 1_000;

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

/** Clé du prix d'un article pour une prestation à la pièce. */
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

const toWeight = (value: unknown): number | null => {
  const numeric =
    typeof value === 'string' ? Number(value.replace(',', '.').replace(/[\s\u00a0]/g, '')) : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric * 100) / 100;
  if (rounded <= 0 || rounded > MAX_PRESSING_WEIGHT_KG) return null;
  return rounded;
};

const isPrice = (value: unknown): value is number => toPrice(value) !== null;
const isWeight = (value: unknown): value is number => toWeight(value) !== null;

const toText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

export const getPressingPricingMode = (
  service: Pick<PressingServiceType, 'pricingMode'> | undefined
): PressingPricingMode => service?.pricingMode ?? 'unit';

/**
 * Nettoie les prestations lues depuis la sauvegarde locale. L'absence de
 * `pricingMode` conserve exactement l'ancienne facturation à la pièce.
 */
export const normalizePressingSettings = (value: unknown): PressingSettings => {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<PressingSettings>;
  const rawServices = Array.isArray(source.services) ? source.services : [];
  const seenIds = new Set<string>();
  const services: PressingServiceType[] = [];

  for (const rawService of rawServices) {
    if (!rawService || typeof rawService !== 'object') continue;
    const candidate = rawService as PressingServiceType;
    const label = toText(candidate.label);
    if (!label) continue;
    const id = toText(candidate.id) || `svc-${services.length + 1}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const mode = getPressingPricingMode(candidate);
    if (mode === 'kilo') {
      const kiloPrice = toPrice(candidate.kiloPrice);
      services.push({
        id,
        label,
        pricingMode: 'kilo',
        ...(kiloPrice !== null ? { kiloPrice } : {}),
      });
    } else if (mode === 'forfait') {
      const packageWeightKg = toWeight(candidate.packageWeightKg);
      const packagePrice = toPrice(candidate.packagePrice);
      const extraKiloPrice = toPrice(candidate.extraKiloPrice);
      services.push({
        id,
        label,
        pricingMode: 'forfait',
        ...(packageWeightKg !== null ? { packageWeightKg } : {}),
        ...(packagePrice !== null ? { packagePrice } : {}),
        ...(extraKiloPrice !== null ? { extraKiloPrice } : {}),
      });
    } else {
      services.push({ id, label });
    }
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

    const mode = getPressingPricingMode(service);
    if (mode === 'kilo' && !isPrice(service.kiloPrice)) {
      return `Définissez un prix au kilo valide pour « ${label} ».`;
    }
    if (mode === 'forfait') {
      if (!isWeight(service.packageWeightKg)) {
        return `Définissez le poids couvert par le forfait « ${label} ».`;
      }
      if (!isPrice(service.packagePrice)) {
        return `Définissez un prix de forfait valide pour « ${label} ».`;
      }
      if (service.extraKiloPrice !== undefined && !isPrice(service.extraKiloPrice)) {
        return `Le prix du kilo supplémentaire est invalide pour « ${label} ».`;
      }
    }
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

/** Prix d'un vêtement pour une prestation à la pièce. */
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

export const formatPressingWeight = (weightKg: number): string =>
  String(Math.round(weightKg * 100) / 100).replace('.', ',');

const weightedItem = (
  service: PressingServiceType,
  kind: 'kilo' | 'forfait' | 'extra'
): ClothingItem => {
  const packageWeight = service.packageWeightKg ?? 0;
  const config = {
    kilo: {
      suffix: 'kilo',
      name: `Linge au kilo — ${service.label}`,
      unitPrice: service.kiloPrice ?? 0,
      pricingType: 'kilo' as const,
      unitLabel: 'kg',
      emoji: '⚖️',
    },
    forfait: {
      suffix: 'forfait',
      name: `Forfait ${formatPressingWeight(packageWeight)} kg — ${service.label}`,
      unitPrice: service.packagePrice ?? 0,
      pricingType: 'unit' as const,
      unitLabel: 'forfait',
      emoji: '🧺',
    },
    extra: {
      suffix: 'forfait-extra',
      name: `Kilos supplémentaires — ${service.label}`,
      unitPrice: service.extraKiloPrice ?? 0,
      pricingType: 'kilo' as const,
      unitLabel: 'kg',
      emoji: '⚖️',
    },
  }[kind];
  return {
    id: `pressing:${service.id}:${config.suffix}`,
    name: config.name,
    category: 'all',
    serviceCategory: 'pressing',
    unitPrice: config.unitPrice,
    pricingType: config.pricingType,
    unitLabel: config.unitLabel,
    emoji: config.emoji,
    description: service.label,
  };
};

/** Articles de catalogue nécessaires à une prestation au poids ou au forfait. */
const buildWeightedCatalogItems = (service: PressingServiceType): ClothingItem[] => {
  const mode = getPressingPricingMode(service);
  if (mode === 'kilo') {
    return isPrice(service.kiloPrice) ? [weightedItem(service, 'kilo')] : [];
  }
  if (mode === 'forfait' && isWeight(service.packageWeightKg) && isPrice(service.packagePrice)) {
    return [
      weightedItem(service, 'forfait'),
      ...(isPrice(service.extraKiloPrice) ? [weightedItem(service, 'extra')] : []),
    ];
  }
  return [];
};

export interface PressingCatalogEntry {
  legacyKey: string;
  name: string;
  unitPrice: number;
  unitLabel: string;
  pricingType: PricingType;
  serviceType: string;
  sortOrder: number;
}

/**
 * Lignes de catalogue à refléter côté Supabase. Un forfait est un article
 * `unit` ; ses kilos supplémentaires ont leur propre article `kilo`.
 */
export const buildPressingCatalogEntries = (
  items: readonly ClothingItem[],
  settings: PressingSettings
): PressingCatalogEntry[] => {
  const entries: PressingCatalogEntry[] = [];
  let sortOrder = 10;

  for (const service of settings.services) {
    if (getPressingPricingMode(service) !== 'unit') {
      for (const weighted of buildWeightedCatalogItems(service)) {
        entries.push({
          legacyKey: weighted.id,
          name: weighted.name,
          unitPrice: weighted.unitPrice,
          unitLabel: weighted.unitLabel ?? (weighted.pricingType === 'kilo' ? 'kg' : 'forfait'),
          pricingType: weighted.pricingType,
          serviceType: service.label,
          sortOrder,
        });
        sortOrder += 10;
      }
      continue;
    }

    for (const item of items) {
      if (item.serviceCategory !== 'pressing' && item.serviceCategory !== 'both') continue;
      entries.push({
        legacyKey: `pressing:${service.id}:${item.id}`,
        name: `${item.name} — ${service.label}`,
        unitPrice: resolvePressingPrice(item, settings, service.id),
        unitLabel: item.unitLabel || 'pièce',
        pricingType: 'unit',
        serviceType: service.label,
        sortOrder,
      });
      sortOrder += 10;
    }
  }

  return entries;
};

export interface PressingWeightQuoteBlock {
  kind: 'kilo' | 'forfait' | 'extra';
  item: ClothingItem;
  quantity: number;
  weightKg: number;
  subtotal: number;
}

export interface PressingWeightQuote {
  weightKg: number;
  blocks: PressingWeightQuoteBlock[];
  total: number;
}

/**
 * Devis d'une prestation au kilo ou au forfait. Le poids du bloc forfait est
 * limité au poids couvert ; le reste devient une ligne `extra`, ce qui évite
 * de compter deux fois les kilos dans le récapitulatif.
 */
export const quotePressingWeightService = (
  service: PressingServiceType,
  rawWeightKg: number
): { quote: PressingWeightQuote | null; error: string | null } => {
  const weightKg = toWeight(rawWeightKg);
  if (weightKg === null) {
    return { quote: null, error: `Indiquez un poids entre 0,01 et ${MAX_PRESSING_WEIGHT_KG} kg.` };
  }

  const mode = getPressingPricingMode(service);
  if (mode === 'kilo') {
    if (!isPrice(service.kiloPrice)) {
      return { quote: null, error: `Définissez d’abord le prix au kilo de « ${service.label} ».` };
    }
    const item = weightedItem(service, 'kilo');
    const block = {
      kind: 'kilo' as const,
      item,
      quantity: 1,
      weightKg,
      subtotal: Math.round(item.unitPrice * weightKg),
    };
    return { quote: { weightKg, blocks: [block], total: block.subtotal }, error: null };
  }

  if (mode !== 'forfait') {
    return { quote: null, error: 'Cette prestation est facturée à la pièce.' };
  }
  if (!isWeight(service.packageWeightKg) || !isPrice(service.packagePrice)) {
    return { quote: null, error: `Complétez d’abord le forfait « ${service.label} » dans les Paramètres.` };
  }

  const includedWeight = service.packageWeightKg;
  const baseWeight = Math.min(weightKg, includedWeight);
  const item = weightedItem(service, 'forfait');
  const blocks: PressingWeightQuoteBlock[] = [
    {
      kind: 'forfait',
      item,
      quantity: 1,
      weightKg: baseWeight,
      subtotal: item.unitPrice,
    },
  ];
  const extraWeight = Math.round((weightKg - includedWeight) * 100) / 100;
  if (extraWeight > 0) {
    if (!isPrice(service.extraKiloPrice)) {
      return {
        quote: null,
        error: `Ce forfait est limité à ${formatPressingWeight(includedWeight)} kg. Définissez le prix du kilo supplémentaire dans les Paramètres.`,
      };
    }
    const extraItem = weightedItem(service, 'extra');
    blocks.push({
      kind: 'extra',
      item: extraItem,
      quantity: 1,
      weightKg: extraWeight,
      subtotal: Math.round(extraItem.unitPrice * extraWeight),
    });
  }

  return {
    quote: {
      weightKg,
      blocks,
      total: blocks.reduce((total, block) => total + block.subtotal, 0),
    },
    error: null,
  };
};
