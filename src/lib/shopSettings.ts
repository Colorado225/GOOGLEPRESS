import type { ShopSettings } from '../types';
import type { WorkspaceScope } from './workspaceScope';
import {
  DEMO_BLANCHISSERIE_SETTINGS,
  EMPTY_BLANCHISSERIE_SETTINGS,
  normalizeBlanchisserieSettings,
} from './blanchisserie';
import { EMPTY_PRESSING_SETTINGS, normalizePressingSettings } from './pressing';
import {
  DEFAULT_DELIVERY_PROOF_SETTINGS,
  normalizeDeliveryProofSettings,
} from './deliveryProof';
import { DEFAULT_DELIVERY_GPS_SETTINGS, normalizeDeliveryGpsSettings } from './geo';
import { normalizeCatalogOverrides, normalizeCustomGarments } from './garmentCatalog';
import { normalizeLogisticsFee } from './logistics';
import { sanitizePackageCount } from './storage';
import { isValidLogoDataUrl } from './shopIdentity';

/** Clé localStorage des paramètres de la boutique (écran Paramètres). */
export const SHOP_SETTINGS_STORAGE_KEY = 'pressingpro_shop_settings';

/**
 * Valeurs par défaut = identité historique de la boutique fictive de
 * démonstration. Tant que rien n'est enregistré dans les Paramètres,
 * l'application se comporte exactement comme avant.
 */
export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  name: 'Pressing Pro CI',
  logoDataUrl: null,
  tagline: 'Pressing & Blanchisserie — Haute qualité',
  address: 'Rue des Jardins, Cocody, Abidjan',
  phone: '+225 07 08 09 10 11',
  currency: 'FCFA',
  enableSms: true,
  enableThermalPrinter: true,
  // Proposition commerciale de démarrage, modifiable dans Paramètres.
  pickupFee: 1000,
  deliveryFee: 1000,
  // Aucune preuve exigée au départ : le pressing l'active dans Paramètres.
  deliveryProof: DEFAULT_DELIVERY_PROOF_SETTINGS,
  // Carte disponible, mais le partage de position reste au choix du coursier.
  deliveryGps: DEFAULT_DELIVERY_GPS_SETTINGS,
  // Rangement : souple au démarrage (file « À ranger » et dépassement
  // signalé mais autorisé), durcissable par le propriétaire.
  storageAssignmentRequired: false,
  storageAllowCapacityOverflow: true,
  storageSuggestionsEnabled: true,
  storageDefaultCapacityPackages: 20,
  // Grille d'exemple : le modèle est celui des forfaits au nombre de
  // vêtements, pas des kilos.
  blanchisserie: DEMO_BLANCHISSERIE_SETTINGS,
  // Prestations pressing et prix par vêtement : liste de départ, tarifs
  // laissés au catalogue tant que le propriétaire ne saisit rien.
  pressing: EMPTY_PRESSING_SETTINGS,
  // Aucun vêtement créé ni retouché au départ : le catalogue fourni suffit.
  customGarments: [],
  catalogOverrides: {},
};

/**
 * Identité de départ selon la portée.
 *
 * - **Espace réel** : le nom vient du pressing effectivement créé (agence, puis
 *   organisation côté Supabase). Aucune coordonnée n'est inventée : adresse,
 *   téléphone et slogan restent vides jusqu'à saisie. Le nom d'application
 *   n'est jamais repris.
 * - **Démonstration** : l'identité d'exemple historique, inchangée.
 *
 * Les règles de configuration (frais, rangement) restent identiques : ce sont
 * des valeurs par défaut de paramétrage, pas des données d'un autre pressing.
 */
export const resolveDefaultShopSettings = (
  workspace: WorkspaceScope
): ShopSettings => {
  if (workspace.mode !== 'live') return DEFAULT_SHOP_SETTINGS;
  const name =
    workspace.shopName?.trim() || workspace.organizationName?.trim() || '';
  return {
    ...DEFAULT_SHOP_SETTINGS,
    name,
    logoDataUrl: null,
    tagline: '',
    address: '',
    phone: '',
    // Aucun tarif inventé : le pressing définit sa grille dans Paramètres →
    // Prestations avant la première commande de blanchisserie.
    blanchisserie: EMPTY_BLANCHISSERIE_SETTINGS,
    pressing: EMPTY_PRESSING_SETTINGS,
    customGarments: [],
    catalogOverrides: {},
  };
};

const readString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

/**
 * Fusionne un enregistrement de paramètres (localStorage ou base de données)
 * avec une base complète.
 *
 * Une valeur absente ne doit jamais écraser un réglage : c'est ce qui permet
 * d'ouvrir une sauvegarde d'ancienne version, ou une ligne serveur encore
 * partielle, sans perdre les réglages ni inventer de valeurs métier.
 */
export const mergeShopSettings = (
  base: ShopSettings,
  raw: Partial<ShopSettings> | null | undefined
): ShopSettings => {
  const persisted = raw ?? {};
  const merged: ShopSettings = {
    ...base,
    ...persisted,
    name: persisted.name?.trim() ? persisted.name : base.name,
    tagline: readString(persisted.tagline, base.tagline),
    address: readString(persisted.address, base.address),
    phone: readString(persisted.phone, base.phone),
    currency: readString(persisted.currency, base.currency),
    enableSms:
      typeof persisted.enableSms === 'boolean' ? persisted.enableSms : base.enableSms,
    enableThermalPrinter:
      typeof persisted.enableThermalPrinter === 'boolean'
        ? persisted.enableThermalPrinter
        : base.enableThermalPrinter,
    logoDataUrl: isValidLogoDataUrl(persisted.logoDataUrl) ? persisted.logoDataUrl : null,
    pickupFee:
      persisted.pickupFee === undefined
        ? base.pickupFee
        : normalizeLogisticsFee(persisted.pickupFee),
    deliveryFee:
      persisted.deliveryFee === undefined
        ? base.deliveryFee
        : normalizeLogisticsFee(persisted.deliveryFee),
    // Une sauvegarde absente ne doit pas écraser la grille de départ :
    // seule une valeur réellement enregistrée est nettoyée.
    blanchisserie:
      persisted.blanchisserie === undefined
        ? base.blanchisserie
        : normalizeBlanchisserieSettings(persisted.blanchisserie),
    pressing:
      persisted.pressing === undefined
        ? base.pressing
        : normalizePressingSettings(persisted.pressing),
    customGarments:
      persisted.customGarments === undefined
        ? base.customGarments
        : normalizeCustomGarments(persisted.customGarments),
    catalogOverrides:
      persisted.catalogOverrides === undefined
        ? base.catalogOverrides
        : normalizeCatalogOverrides(persisted.catalogOverrides),
    deliveryProof:
      persisted.deliveryProof === undefined
        ? base.deliveryProof
        : normalizeDeliveryProofSettings(persisted.deliveryProof),
    deliveryGps:
      persisted.deliveryGps === undefined
        ? base.deliveryGps
        : normalizeDeliveryGpsSettings(persisted.deliveryGps),
  };

  return {
    ...merged,
    storageAssignmentRequired: merged.storageAssignmentRequired === true,
    storageAllowCapacityOverflow: merged.storageAllowCapacityOverflow !== false,
    storageSuggestionsEnabled: merged.storageSuggestionsEnabled !== false,
    storageDefaultCapacityPackages:
      sanitizePackageCount(merged.storageDefaultCapacityPackages) ??
      DEFAULT_SHOP_SETTINGS.storageDefaultCapacityPackages,
  };
};
