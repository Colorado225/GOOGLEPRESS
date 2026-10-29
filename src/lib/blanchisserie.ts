import type {
  BlanchisserieServiceId,
  BlanchisserieSettings,
  BlanchisserieTier,
  ClothingItem,
} from '../types';

/**
 * Modèle de prestation de la blanchisserie.
 *
 * Trois prestations, définies une fois pour toutes dans les Paramètres :
 *
 * - **Lavage simple** et **Lavage + repassage** se vendent au forfait, par
 *   NOMBRE DE VÊTEMENTS (20 vêtements = 3 000 FCFA par exemple) ;
 * - **Repassage** seul se facture au vêtement.
 *
 * Le kilo et le catalogue de pièces de blanchisserie ont disparu : le prix ne
 * dépend plus du type de linge mais du palier atteint. Au-delà du plus grand
 * palier utilisable, les vêtements restants sont facturés au prix du vêtement
 * supplémentaire, lui aussi réglé dans les Paramètres.
 */

export interface BlanchisserieServiceDefinition {
  id: BlanchisserieServiceId;
  label: string;
  emoji: string;
  description: string;
}

export const BLANCHISSERIE_SERVICES: readonly BlanchisserieServiceDefinition[] = [
  {
    id: 'wash_only',
    label: 'Lavage simple',
    emoji: '🫧',
    description: 'Lavage, séchage et pliage — facturé au forfait.',
  },
  {
    id: 'wash_iron',
    label: 'Lavage + repassage',
    emoji: '🧺',
    description: 'Lavage, séchage et repassage — facturé au forfait.',
  },
  {
    id: 'iron_only',
    label: 'Repassage',
    emoji: '♨️',
    description: 'Repassage seul — facturé au vêtement.',
  },
] as const;

export const BLANCHISSERIE_SERVICE_IDS: readonly BlanchisserieServiceId[] =
  BLANCHISSERIE_SERVICES.map((service) => service.id);

/** Bornes de saisie de la grille. */
export const MIN_TIER_GARMENTS = 2;
export const MAX_TIER_GARMENTS = 500;
export const MAX_TIERS = 12;
export const MAX_PRICE_XOF = 1_000_000;

const PRICE_KEYS: readonly BlanchisserieServiceId[] = BLANCHISSERIE_SERVICE_IDS;

export const getBlanchisserieService = (
  id: BlanchisserieServiceId
): BlanchisserieServiceDefinition =>
  BLANCHISSERIE_SERVICES.find((service) => service.id === id) ??
  BLANCHISSERIE_SERVICES[0];

export const getBlanchisserieServiceLabel = (id: BlanchisserieServiceId): string =>
  getBlanchisserieService(id).label;

/** Nombre de vêtements au format lisible : « 1 vêtement », « 20 vêtements ». */
export const formatGarments = (count: number): string =>
  `${count} vêtement${Math.abs(count) > 1 ? 's' : ''}`;

const emptyPrices = (): Record<BlanchisserieServiceId, number> => ({
  wash_only: 0,
  wash_iron: 0,
  iron_only: 0,
});

/** Grille vide : rien n'est inventé, la blanchisserie reste à configurer. */
export const EMPTY_BLANCHISSERIE_SETTINGS: BlanchisserieSettings = {
  tiers: [],
  unitPrices: emptyPrices(),
  perGarment: { wash_only: false, wash_iron: false, iron_only: true },
};

/**
 * Grille de démonstration (espace local uniquement) : elle illustre le modèle
 * sans jamais servir de tarif à un pressing réel.
 */
export const DEMO_BLANCHISSERIE_SETTINGS: BlanchisserieSettings = {
  tiers: [
    { id: 'tier-10', garments: 10, prices: { wash_only: 2000, wash_iron: 3000, iron_only: 0 } },
    { id: 'tier-20', garments: 20, prices: { wash_only: 3500, wash_iron: 5000, iron_only: 0 } },
    { id: 'tier-30', garments: 30, prices: { wash_only: 4500, wash_iron: 6500, iron_only: 0 } },
  ],
  unitPrices: { wash_only: 300, wash_iron: 500, iron_only: 250 },
  perGarment: { wash_only: false, wash_iron: false, iron_only: true },
};

const toInteger = (value: unknown, min: number, max: number): number | null => {
  const numeric =
    typeof value === 'string' ? Number(value.replace(/[\s\u00a0]/g, '')) : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < min || rounded > max) return null;
  return rounded;
};

const sanitizePrices = (value: unknown): Record<BlanchisserieServiceId, number> => {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const prices = emptyPrices();
  for (const key of PRICE_KEYS) {
    prices[key] = toInteger(source[key], 0, MAX_PRICE_XOF) ?? 0;
  }
  return prices;
};

/**
 * Nettoie une grille lue depuis la sauvegarde locale : paliers hors bornes,
 * doublons de nombre de vêtements et prix absurdes sont écartés, jamais
 * « corrigés » silencieusement en un tarif différent.
 */
export const normalizeBlanchisserieSettings = (
  value: unknown
): BlanchisserieSettings => {
  const source = (value && typeof value === 'object' ? value : {}) as Partial<BlanchisserieSettings>;
  const rawTiers = Array.isArray(source.tiers) ? source.tiers : [];
  const seen = new Set<number>();
  const tiers: BlanchisserieTier[] = [];

  for (const rawTier of rawTiers) {
    if (!rawTier || typeof rawTier !== 'object') continue;
    const candidate = rawTier as Partial<BlanchisserieTier>;
    const garments = toInteger(candidate.garments, MIN_TIER_GARMENTS, MAX_TIER_GARMENTS);
    if (garments === null || seen.has(garments)) continue;
    const prices = sanitizePrices(candidate.prices);
    if (prices.wash_only === 0 && prices.wash_iron === 0 && prices.iron_only === 0) continue;
    seen.add(garments);
    const id =
      typeof candidate.id === 'string' && candidate.id.trim().length > 0
        ? candidate.id.trim()
        : `tier-${garments}`;
    tiers.push({ id, garments, prices });
    if (tiers.length >= MAX_TIERS) break;
  }

  tiers.sort((a, b) => a.garments - b.garments);

  const perGarmentSource = (
    source.perGarment && typeof source.perGarment === 'object' ? source.perGarment : {}
  ) as Record<string, unknown>;

  return {
    tiers,
    unitPrices: sanitizePrices(source.unitPrices),
    perGarment: {
      wash_only: perGarmentSource.wash_only === true,
      wash_iron: perGarmentSource.wash_iron === true,
      iron_only: perGarmentSource.iron_only !== false,
    },
  };
};

/** Mode de facturation d'une prestation. */
export const getBlanchisserieMode = (
  settings: BlanchisserieSettings,
  serviceId: BlanchisserieServiceId
): 'forfait' | 'per_garment' =>
  settings.perGarment[serviceId] === true ? 'per_garment' : 'forfait';

/** Paliers réellement tarifés pour une prestation au forfait. */
export const getServiceTiers = (
  settings: BlanchisserieSettings,
  serviceId: BlanchisserieServiceId
): BlanchisserieTier[] =>
  settings.tiers
    .filter((tier) => tier.prices[serviceId] > 0)
    .sort((a, b) => a.garments - b.garments);

/** Grille utilisable : au moins une prestation a un tarif. */
export const isBlanchisserieConfigured = (
  settings: BlanchisserieSettings
): boolean =>
  BLANCHISSERIE_SERVICE_IDS.some((serviceId) =>
    getBlanchisserieMode(settings, serviceId) === 'per_garment'
      ? settings.unitPrices[serviceId] > 0
      : getServiceTiers(settings, serviceId).length > 0
  );

/** Message d'erreur de la grille, ou `null` si elle est enregistrable. */
export const validateBlanchisserieSettings = (
  settings: BlanchisserieSettings
): string | null => {
  if (settings.tiers.length > MAX_TIERS) {
    return `La grille ne peut pas dépasser ${MAX_TIERS} forfaits.`;
  }
  const seen = new Set<number>();
  for (const tier of settings.tiers) {
    if (!Number.isInteger(tier.garments) || tier.garments < MIN_TIER_GARMENTS) {
      return `Chaque forfait doit couvrir au moins ${MIN_TIER_GARMENTS} vêtements.`;
    }
    if (tier.garments > MAX_TIER_GARMENTS) {
      return `Un forfait ne peut pas dépasser ${MAX_TIER_GARMENTS} vêtements.`;
    }
    if (seen.has(tier.garments)) {
      return `Deux forfaits ne peuvent pas couvrir le même nombre de vêtements (${tier.garments}).`;
    }
    seen.add(tier.garments);
    for (const serviceId of PRICE_KEYS) {
      const price = tier.prices[serviceId];
      if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE_XOF) {
        return `Prix de forfait invalide pour ${getBlanchisserieServiceLabel(serviceId)}.`;
      }
    }
  }
  for (const serviceId of PRICE_KEYS) {
    const price = settings.unitPrices[serviceId];
    if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE_XOF) {
      return `Prix à l'unité invalide pour ${getBlanchisserieServiceLabel(serviceId)}.`;
    }
  }
  if (!isBlanchisserieConfigured(settings)) {
    return 'Définissez au moins un forfait ou un prix à l’unité avant d’enregistrer.';
  }
  for (const serviceId of PRICE_KEYS) {
    if (
      getBlanchisserieMode(settings, serviceId) === 'forfait' &&
      getServiceTiers(settings, serviceId).length === 0
    ) {
      return `Ajoutez un forfait pour ${getBlanchisserieServiceLabel(serviceId)}, ou basculez cette prestation en facturation au vêtement.`;
    }
  }
  return null;
};

export interface BlanchisserieQuoteBlock {
  key: string;
  kind: 'forfait' | 'per_garment';
  serviceId: BlanchisserieServiceId;
  serviceLabel: string;
  tierId?: string;
  /** Vêtements couverts par une unité facturée (forfait) ou 1. */
  garmentsPerUnit: number;
  /** Unités facturées : nombre de forfaits, ou nombre de vêtements. */
  quantity: number;
  unitPrice: number;
  subtotal: number;
  /** Vêtements couverts par ce bloc. */
  garments: number;
  name: string;
  unitLabel: string;
  itemId: string;
}

export interface BlanchisserieQuote {
  serviceId: BlanchisserieServiceId;
  serviceLabel: string;
  garments: number;
  blocks: BlanchisserieQuoteBlock[];
  subtotal: number;
  /** Coût moyen arrondi au vêtement (indicateur d'affichage uniquement). */
  averagePerGarment: number;
}

const itemIdFor = (serviceId: BlanchisserieServiceId, suffix: string): string =>
  `bf:${serviceId}:${suffix}`;

/**
 * Meilleur prix pour `garments` vêtements d'une prestation.
 *
 * Deux leviers, tels que réglés dans les Paramètres : les forfaits (N
 * vêtements pour un prix fixe, cumulables) et le prix du vêtement
 * supplémentaire. Le calcul retient la combinaison la moins chère — par
 * exemple 18 vêtements peuvent être couverts par « 10 + 8 à l'unité » ou par
 * le forfait de 20 vêtements s'il revient moins cher.
 *
 * Retourne `null` si la grille ne permet pas de tarifer exactement ce nombre
 * de vêtements (aucun forfait utilisable et aucun prix à l'unité).
 */
export const calculateBlanchisserieQuote = (
  settings: BlanchisserieSettings,
  serviceId: BlanchisserieServiceId,
  garments: number
): BlanchisserieQuote | null => {
  const count = Math.round(garments);
  if (!Number.isFinite(count) || count <= 0) return null;

  const serviceLabel = getBlanchisserieServiceLabel(serviceId);
  const mode = getBlanchisserieMode(settings, serviceId);

  if (mode === 'per_garment') {
    const unitPrice = settings.unitPrices[serviceId];
    if (unitPrice <= 0) return null;
    const block: BlanchisserieQuoteBlock = {
      key: `${serviceId}-unit`,
      kind: 'per_garment',
      serviceId,
      serviceLabel,
      garmentsPerUnit: 1,
      quantity: count,
      unitPrice,
      subtotal: unitPrice * count,
      garments: count,
      name: `${serviceLabel} — à l’unité`,
      unitLabel: 'vêtement',
      itemId: itemIdFor(serviceId, 'unit'),
    };
    return {
      serviceId,
      serviceLabel,
      garments: count,
      blocks: [block],
      subtotal: block.subtotal,
      averagePerGarment: unitPrice,
    };
  }

  const tiers = getServiceTiers(settings, serviceId);
  const unitPrice = settings.unitPrices[serviceId];
  if (tiers.length === 0 && unitPrice <= 0) return null;

  // Décomposition prévisible : on prend le plus gros forfait possible, puis on
  // recommence sur le reste. Les vêtements qui ne remplissent plus aucun
  // palier sont facturés à l'unité (prix du vêtement supplémentaire).
  const sortedTiers = [...tiers].sort((a, b) => b.garments - a.garments);
  const tierCounts = new Map<string, number>();
  let unitCount = 0;
  let remaining = count;

  while (remaining > 0) {
    const tier = sortedTiers.find((candidate) => candidate.garments <= remaining);
    if (tier) {
      tierCounts.set(tier.id, (tierCounts.get(tier.id) ?? 0) + 1);
      remaining -= tier.garments;
      continue;
    }
    if (unitPrice <= 0) return null;
    unitCount = remaining;
    remaining = 0;
  }

  const blocks: BlanchisserieQuoteBlock[] = [];
  for (const tier of [...tiers].sort((a, b) => b.garments - a.garments)) {
    const quantity = tierCounts.get(tier.id) ?? 0;
    if (quantity === 0) continue;
    const price = tier.prices[serviceId];
    blocks.push({
      key: `${serviceId}-${tier.id}`,
      kind: 'forfait',
      serviceId,
      serviceLabel,
      tierId: tier.id,
      garmentsPerUnit: tier.garments,
      quantity,
      unitPrice: price,
      subtotal: price * quantity,
      garments: tier.garments * quantity,
      name: `Forfait ${formatGarments(tier.garments)} — ${serviceLabel}`,
      unitLabel: 'forfait',
      itemId: itemIdFor(serviceId, String(tier.garments)),
    });
  }

  if (unitCount > 0) {
    const hasForfait = blocks.length > 0;
    blocks.push({
      key: `${serviceId}-unit`,
      kind: 'per_garment',
      serviceId,
      serviceLabel,
      garmentsPerUnit: 1,
      quantity: unitCount,
      unitPrice,
      subtotal: unitPrice * unitCount,
      garments: unitCount,
      name: hasForfait
        ? `Vêtements supplémentaires — ${serviceLabel}`
        : `${serviceLabel} — à l’unité`,
      unitLabel: 'vêtement',
      itemId: itemIdFor(serviceId, 'unit'),
    });
  }

  const subtotal = blocks.reduce((total, block) => total + block.subtotal, 0);
  return {
    serviceId,
    serviceLabel,
    garments: count,
    blocks,
    subtotal,
    averagePerGarment: Math.round(subtotal / count),
  };
};

/** Résumé lisible : « 1 forfait de 20 vêtements + 5 vêtements à l'unité ». */
export const describeBlanchisserieQuote = (quote: BlanchisserieQuote): string =>
  quote.blocks
    .map((block) =>
      block.kind === 'forfait'
        ? `${block.quantity} forfait${block.quantity > 1 ? 's' : ''} de ${formatGarments(block.garmentsPerUnit)}`
        : `${formatGarments(block.quantity)} à l’unité`
    )
    .join(' + ');

/** Article de panier correspondant à un bloc de devis. */
export const buildBlanchisserieItem = (block: BlanchisserieQuoteBlock): ClothingItem => ({
  id: block.itemId,
  name: block.name,
  category: 'all',
  serviceCategory: 'blanchisserie',
  unitPrice: block.unitPrice,
  pricingType: 'unit',
  unitLabel: block.unitLabel,
  emoji: block.kind === 'forfait' ? '🧺' : '👕',
  description: block.serviceLabel,
});

/**
 * Lignes de catalogue à refléter côté Supabase pour que la RPC `create_order`
 * sache tarifer la blanchisserie.
 *
 * Chaque forfait devient un article `unit` dont le prix est celui du forfait
 * (la quantité du panier est le nombre de forfaits), et chaque prestation à
 * l'unité un article au vêtement. La clé `legacyKey` est stable : régénérer la
 * grille met à jour les mêmes lignes au lieu d'en créer de nouvelles.
 */
export interface BlanchisserieCatalogEntry {
  legacyKey: string;
  name: string;
  unitPrice: number;
  unitLabel: string;
  serviceCategory: 'blanchisserie';
  audienceCategory: 'all';
  pricingType: 'unit';
  sortOrder: number;
  description: string;
}

export const buildBlanchisserieCatalogEntries = (
  settings: BlanchisserieSettings
): BlanchisserieCatalogEntry[] => {
  const entries: BlanchisserieCatalogEntry[] = [];
  let sortOrder = 500;

  for (const service of BLANCHISSERIE_SERVICES) {
    if (getBlanchisserieMode(settings, service.id) === 'per_garment') {
      const unitPrice = settings.unitPrices[service.id];
      if (unitPrice <= 0) continue;
      entries.push({
        legacyKey: itemIdFor(service.id, 'unit'),
        name: `${service.label} — à l’unité`,
        unitPrice,
        unitLabel: 'vêtement',
        serviceCategory: 'blanchisserie',
        audienceCategory: 'all',
        pricingType: 'unit',
        sortOrder,
        description: service.description,
      });
      sortOrder += 10;
      continue;
    }

    for (const tier of getServiceTiers(settings, service.id)) {
      entries.push({
        legacyKey: itemIdFor(service.id, String(tier.garments)),
        name: `Forfait ${formatGarments(tier.garments)} — ${service.label}`,
        unitPrice: tier.prices[service.id],
        unitLabel: 'forfait',
        serviceCategory: 'blanchisserie',
        audienceCategory: 'all',
        pricingType: 'unit',
        sortOrder,
        description: service.description,
      });
      sortOrder += 10;
    }

    if (settings.unitPrices[service.id] > 0) {
      entries.push({
        legacyKey: itemIdFor(service.id, 'unit'),
        name: `Vêtements supplémentaires — ${service.label}`,
        unitPrice: settings.unitPrices[service.id],
        unitLabel: 'vêtement',
        serviceCategory: 'blanchisserie',
        audienceCategory: 'all',
        pricingType: 'unit',
        sortOrder,
        description: `Vêtements au-delà du forfait — ${service.label}`,
      });
      sortOrder += 10;
    }
  }

  return entries;
};
