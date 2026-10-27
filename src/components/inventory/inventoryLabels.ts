import type { StockMovementType, StockStatus } from '../../types';

export const STOCK_STATUS_BADGE: Record<StockStatus, string> = {
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  low: 'bg-amber-50 text-amber-700 border-amber-200',
  out: 'bg-red-50 text-red-700 border-red-200',
};

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  in: 'Entrée',
  out: 'Sortie',
  adjustment: 'Ajustement',
};

export const MOVEMENT_TYPE_BADGE: Record<StockMovementType, string> = {
  in: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  out: 'bg-orange-50 text-orange-700 border-orange-200',
  adjustment: 'bg-blue-50 text-blue-700 border-blue-200',
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
