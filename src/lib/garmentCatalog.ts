import { INITIAL_CLOTHING_ITEMS } from '../data/demoData';
import type {
  ClothingItem,
  CustomGarment,
  GarmentOverride,
  ShopSettings,
} from '../types';
import { isValidImageDataUrl } from './shopIdentity';

/**
 * Catalogue de vêtements du comptoir.
 *
 * Deux sources, dans cet ordre :
 *
 * 1. les vêtements **créés par le pressing** dans Paramètres → Prestations
 *    (nom, catégorie, prix de base et photo) ;
 * 2. le catalogue fourni au départ, qui sert de base tant que le propriétaire
 *    n'ajoute rien.
 *
 * Un vêtement créé apparaît immédiatement au comptoir, avec sa vignette, et
 * ses prix par prestation se règlent dans la grille habituelle. Les vêtements
 * fournis peuvent être **renommés, retarifés, rephotographiés ou masqués**
 * sans être supprimés : leurs retouches sont conservées à part, ce qui permet
 * de tout rétablir et de ne jamais casser une commande déjà enregistrée.
 */

export const MAX_CUSTOM_GARMENTS = 60;
export const MAX_GARMENT_PRICE_XOF = 1_000_000;
export const MAX_GARMENT_NAME_LENGTH = 60;

export const GARMENT_CATEGORIES: readonly {
  id: CustomGarment['category'];
  label: string;
}[] = [
  { id: 'all', label: 'Tous' },
  { id: 'men', label: 'Hommes' },
  { id: 'women', label: 'Femmes' },
  { id: 'home', label: 'Linge maison' },
  { id: 'pro', label: 'B2B / Pro' },
] as const;

const toText = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

const isCategory = (value: unknown): value is CustomGarment['category'] =>
  GARMENT_CATEGORIES.some((category) => category.id === value);

const toPrice = (value: unknown): number | null => {
  const numeric =
    typeof value === 'string' ? Number(value.replace(/[\s\u00a0]/g, '')) : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 0 || rounded > MAX_GARMENT_PRICE_XOF) return null;
  return rounded;
};

/**
 * Nettoie les vêtements enregistrés.
 *
 * Une photo illisible (URL distante bloquée par la CSP, base64 tronqué) est
 * ignorée — le vêtement reste au catalogue avec son emoji — plutôt que de
 * faire disparaître une ligne de tarif.
 */
export const normalizeCustomGarments = (value: unknown): CustomGarment[] => {
  if (!Array.isArray(value)) return [];
  const garments: CustomGarment[] = [];
  const seenIds = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Partial<CustomGarment>;
    const name = toText(candidate.name).slice(0, MAX_GARMENT_NAME_LENGTH);
    if (!name) continue;
    const price = toPrice(candidate.unitPrice);
    if (price === null) continue;

    let id = toText(candidate.id);
    if (!id || seenIds.has(id)) {
      const base = slugifyGarmentName(name) || 'vetement';
      let suffix = 1;
      id = base;
      while (seenIds.has(id)) {
        suffix += 1;
        id = `${base}-${suffix}`;
      }
    }
    seenIds.add(id);

    garments.push({
      id,
      name,
      category: isCategory(candidate.category) ? candidate.category : 'all',
      unitPrice: price,
      unitLabel: toText(candidate.unitLabel) || 'pièce',
      emoji: toText(candidate.emoji) || '👕',
      imageDataUrl: isValidImageDataUrl(candidate.imageDataUrl) ? candidate.imageDataUrl : null,
      description: toText(candidate.description) || undefined,
    });

    if (garments.length >= MAX_CUSTOM_GARMENTS) break;
  }

  return garments;
};

/** Identifiant lisible déduit du nom : « Chemise lin » → « chemise-lin ». */
export const slugifyGarmentName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/**
 * Identifiant stable et unique pour un nouveau vêtement.
 *
 * Le préfixe `cg:` le distingue des identifiants fournis (`c1`, `b1`…) afin
 * qu'un vêtement créé ne puisse jamais écraser une ligne existante.
 */
export const buildGarmentId = (
  name: string,
  existing: readonly CustomGarment[]
): string => {
  const base = `cg:${slugifyGarmentName(name) || 'vetement'}`;
  const used = new Set(existing.map((garment) => garment.id));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

/** Message d'erreur d'un nouveau vêtement, ou `null` s'il est valide. */
export const validateCustomGarment = (input: {
  name: string;
  unitPrice: number;
  category: string;
}): string | null => {
  const name = input.name.trim();
  if (name.length < 2) return 'Le nom du vêtement doit contenir au moins 2 caractères.';
  if (name.length > MAX_GARMENT_NAME_LENGTH) {
    return `Le nom du vêtement ne peut pas dépasser ${MAX_GARMENT_NAME_LENGTH} caractères.`;
  }
  if (!Number.isInteger(input.unitPrice) || input.unitPrice < 0) {
    return 'Le prix de base doit être un montant valide en FCFA.';
  }
  if (input.unitPrice > MAX_GARMENT_PRICE_XOF) {
    return 'Le prix de base est trop élevé.';
  }
  if (!GARMENT_CATEGORIES.some((category) => category.id === input.category)) {
    return 'Choisissez une catégorie pour ce vêtement.';
  }
  return null;
};

/** Conversion d'un vêtement créé vers une ligne de catalogue vendable. */
export const customGarmentToClothingItem = (garment: CustomGarment): ClothingItem => ({
  id: garment.id,
  name: garment.name,
  category: garment.category,
  serviceCategory: 'pressing',
  unitPrice: garment.unitPrice,
  pricingType: 'unit',
  unitLabel: garment.unitLabel,
  emoji: garment.emoji,
  image: garment.imageDataUrl ?? undefined,
  description: garment.description,
});

/** Identifiants des vêtements fournis (`c1`…), jamais masquables par erreur. */
export const BASE_GARMENT_IDS: readonly string[] = INITIAL_CLOTHING_ITEMS.map((item) => item.id);

export const isBaseGarmentId = (id: string): boolean => BASE_GARMENT_IDS.includes(id);

/** Vêtement fourni, avant application d'une éventuelle retouche. */
export const getBaseGarment = (id: string): ClothingItem | undefined =>
  INITIAL_CLOTHING_ITEMS.find((item) => item.id === id);

/**
 * Nettoie les retouches enregistrées : seules les valeurs exploitables sont
 * conservées. Une retouche devenue vide est simplement oubliée, ce qui remet
 * le vêtement fourni dans son état d'origine.
 */
export const normalizeCatalogOverrides = (
  value: unknown
): Record<string, GarmentOverride> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const overrides: Record<string, GarmentOverride> = {};

  for (const [rawId, rawOverride] of Object.entries(value as Record<string, unknown>)) {
    const id = rawId.trim();
    if (!id || !rawOverride || typeof rawOverride !== 'object') continue;
    const candidate = rawOverride as GarmentOverride;
    const override: GarmentOverride = {};

    const name = toText(candidate.name).slice(0, MAX_GARMENT_NAME_LENGTH);
    if (name) override.name = name;

    if (isCategory(candidate.category)) override.category = candidate.category;

    const price = toPrice(candidate.unitPrice);
    if (price !== null) override.unitPrice = price;

    const unitLabel = toText(candidate.unitLabel);
    if (unitLabel) override.unitLabel = unitLabel;

    const description = toText(candidate.description);
    if (description) override.description = description;

    // `null` = photo retirée ; une data URL valide = photo remplacée.
    if (candidate.imageDataUrl === null) override.imageDataUrl = null;
    else if (isValidImageDataUrl(candidate.imageDataUrl)) {
      override.imageDataUrl = candidate.imageDataUrl;
    }

    if (candidate.hidden === true) override.hidden = true;

    if (Object.keys(override).length > 0) overrides[id] = override;
  }

  return overrides;
};

/** Applique une retouche à un vêtement fourni. */
export const applyGarmentOverride = (
  item: ClothingItem,
  override?: GarmentOverride
): ClothingItem => {
  if (!override) return item;
  const merged: ClothingItem = {
    ...item,
    name: override.name ?? item.name,
    category: override.category ?? item.category,
    unitPrice: override.unitPrice ?? item.unitPrice,
    unitLabel: override.unitLabel ?? item.unitLabel,
    description: override.description ?? item.description,
  };
  if (override.imageDataUrl === null) merged.image = undefined;
  else if (typeof override.imageDataUrl === 'string') merged.image = override.imageDataUrl;
  return merged;
};

/**
 * Catalogue affiché au comptoir : vêtements créés d'abord (les plus récents
 * ajouts visibles sans défiler), puis le catalogue fourni retouché, sans les
 * vêtements masqués.
 */
export const getGarmentCatalog = (
  shopSettings: Pick<ShopSettings, 'customGarments' | 'catalogOverrides'>
): ClothingItem[] => {
  const overrides = shopSettings.catalogOverrides ?? {};
  return [
    ...shopSettings.customGarments.map(customGarmentToClothingItem),
    ...INITIAL_CLOTHING_ITEMS.filter((item) => overrides[item.id]?.hidden !== true).map(
      (item) => applyGarmentOverride(item, overrides[item.id])
    ),
  ];
};
