import type { ShopSettings } from '../types';

/** Clé localStorage des paramètres de la boutique (écran Paramètres). */
export const SHOP_SETTINGS_STORAGE_KEY = 'pressingpro_shop_settings';

/**
 * Valeurs par défaut = identité historique de la boutique fictive de
 * démonstration. Tant que rien n'est enregistré dans les Paramètres,
 * l'application se comporte exactement comme avant.
 */
export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  name: 'Pressing Pro CI',
  tagline: 'Pressing & Blanchisserie — Haute qualité',
  address: 'Rue des Jardins, Cocody, Abidjan',
  phone: '+225 07 08 09 10 11',
  currency: 'FCFA',
  enableSms: true,
  enableThermalPrinter: true,
  // Proposition commerciale de démarrage, modifiable dans Paramètres.
  pickupFee: 1000,
  deliveryFee: 1000,
};
