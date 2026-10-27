import type { InventoryProduct, StockMovementType, StockStatus } from '../types';

/**
 * Règles de stock centralisées — utilisées par le catalogue, la vue
 * d'ensemble, les alertes, les mouvements et le rapport de stock afin
 * qu'aucun écran ne recalcule un état différemment des autres.
 *
 * Rupture : quantité ≤ 0 · Faible : 0 < quantité ≤ seuil · Normal : quantité > seuil.
 * Un stock négatif est interdit : toute sortie excessive est refusée.
 */

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  normal: 'Normal',
  low: 'Faible',
  out: 'Rupture',
};

export function getStockStatus(quantity: number, alertThreshold: number): StockStatus {
  if (quantity <= 0) return 'out';
  if (quantity <= alertThreshold) return 'low';
  return 'normal';
}

/** Arrondi à 3 décimales pour éviter les artefacts de virgule flottante (L, kg). */
export function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** "2,5 L", "12 unités" — format français, sans décimales superflues. */
export function formatQuantity(quantity: number, unit: string): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 3,
  }).format(quantity);
  return unit ? `${formatted} ${unit}` : formatted;
}

export interface MovementComputation {
  quantityBefore: number;
  quantityAfter: number;
  error: string | null;
}

/**
 * Calcule le stock après mouvement et valide les règles métier.
 * - entrée / sortie : `quantity` est une variation strictement positive ;
 * - ajustement : `quantity` est la quantité cible constatée (≥ 0) ;
 * - une sortie ne peut pas faire passer le stock sous zéro.
 */
export function computeMovement(
  currentQuantity: number,
  type: StockMovementType,
  quantity: number
): MovementComputation {
  const before = roundQuantity(currentQuantity);
  if (isNaN(quantity)) {
    return { quantityBefore: before, quantityAfter: before, error: 'La quantité doit être un nombre.' };
  }
  if (type === 'adjustment') {
    if (quantity < 0) {
      return { quantityBefore: before, quantityAfter: before, error: 'La quantité constatée ne peut pas être négative.' };
    }
    return { quantityBefore: before, quantityAfter: roundQuantity(quantity), error: null };
  }
  if (quantity <= 0) {
    return { quantityBefore: before, quantityAfter: before, error: 'La quantité doit être strictement supérieure à zéro.' };
  }
  const after = roundQuantity(type === 'in' ? before + quantity : before - quantity);
  if (after < 0) {
    return {
      quantityBefore: before,
      quantityAfter: before,
      error: `Stock insuffisant : il ne reste que ${before} en stock.`,
    };
  }
  return { quantityBefore: before, quantityAfter: after, error: null };
}

export interface StockValueEstimate {
  /** Estimation = Σ quantité × dernier coût, uniquement pour les produits avec coût renseigné. */
  valueXof: number;
  productsWithCost: number;
  activeProducts: number;
}

export function estimateStockValue(products: InventoryProduct[]): StockValueEstimate {
  let valueXof = 0;
  let productsWithCost = 0;
  let activeProducts = 0;
  for (const p of products) {
    if (!p.isActive) continue;
    activeProducts += 1;
    if (typeof p.unitCostXof === 'number') {
      productsWithCost += 1;
      valueXof += p.currentQuantity * p.unitCostXof;
    }
  }
  return { valueXof: Math.round(valueXof), productsWithCost, activeProducts };
}

/** Produits actifs en alerte (faible ou rupture), ruptures d'abord. */
export function getAlertProducts(products: InventoryProduct[]): InventoryProduct[] {
  return products
    .filter((p) => p.isActive && getStockStatus(p.currentQuantity, p.alertThreshold) !== 'normal')
    .sort((a, b) => {
      const sa = getStockStatus(a.currentQuantity, a.alertThreshold);
      const sb = getStockStatus(b.currentQuantity, b.alertThreshold);
      if (sa !== sb) return sa === 'out' ? -1 : 1;
      return a.name.localeCompare(b.name, 'fr');
    });
}
