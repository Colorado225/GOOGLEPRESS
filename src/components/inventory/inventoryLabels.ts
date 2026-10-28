import type { StockMovementType, StockStatus } from '../../types';

export const STOCK_STATUS_BADGE: Record<StockStatus, string> = {
  normal: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  low: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  out: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
};

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  in: 'Entrée',
  out: 'Sortie',
  adjustment: 'Ajustement',
};

export const MOVEMENT_TYPE_BADGE: Record<StockMovementType, string> = {
  in: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  out: 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  adjustment: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
};

/** Motifs suggérés (saisie libre possible, le motif reste un texte filtrable). */
export const MOVEMENT_REASONS = [
  'Achat fournisseur',
  'Consommation atelier',
  'Consommation comptoir',
  'Inventaire',
  'Casse / perte',
  'Retour fournisseur',
  'Stock initial',
] as const;

/** Lit un nombre saisi en français ("2,5" → 2.5). NaN si non numérique. */
export function parseQuantityInput(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (normalized === '') return NaN;
  return Number(normalized);
}

/** Génère une référence produit lisible à partir du nom ("Lessive liquide" → "LES-LIQ"). */
export function suggestReference(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) return '';
  return words.slice(0, 2).map((w) => w.slice(0, 3)).join('-');
}
