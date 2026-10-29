/** Convertit une valeur numérique historique sans jamais propager NaN. */
export const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
};

/** Montant ou quantité conservé(e) dans le domaine non négatif. */
export const toNonNegativeNumber = (value: unknown, fallback = 0): number =>
  Math.max(0, toFiniteNumber(value, fallback));
