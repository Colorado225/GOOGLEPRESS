import type { ShopSettings } from '../types';
import type { WorkspaceScope } from './workspaceScope';
import {
  DEMO_BLANCHISSERIE_SETTINGS,
  EMPTY_BLANCHISSERIE_SETTINGS,
} from './blanchisserie';
import { EMPTY_PRESSING_SETTINGS } from './pressing';

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
  // Aucun vêtement créé au départ : le catalogue fourni suffit.
  customGarments: [],
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
  };
};
