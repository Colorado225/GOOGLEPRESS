import type { OrderLine, PickupOption } from '../types';

/**
 * Calculs tarifaires — PressingPro CI.
 *
 * Point d'entrée UNIQUE pour tous les montants d'une commande.
 * Avant ce module, la même formule (sous-total, express ×2, remise
 * fidélité, total, reste à payer) était recopiée dans AppContext,
 * OrderCartTicket et Step3SummaryAndConfirm, avec un risque de divergence
 * entre le montant affiché à l'écran et celui enregistré sur la commande.
 * Tous les montants sont en FCFA entiers (pas de centimes).
 */

/**
 * Le type de service « Express 24h » vaut le DOUBLE du service normal : la
 * majoration est donc égale à 100 % des prestations concernées. « Express »
 * n'est pas un traitement : chaque ligne peut être normale ou express dans
 * une même commande. Sans indication de ligne (données historiques), le
 * choix global de retrait conserve son comportement précédent.
 */
export const EXPRESS_SURCHARGE_RATE = 1;

/** Délai tarifaire effectif d'une ligne, avec repli historique sur la commande. */
export function isOrderLineExpress(
  line: Pick<OrderLine, 'isExpress'>,
  pickupOption: PickupOption
): boolean {
  return line.isExpress ?? pickupOption === 'express';
}

/**
 * Priorité atelier dérivée des lignes, jamais l'inverse : une seule ligne
 * Express rend la commande prioritaire, sans convertir ni surtaxer les autres.
 * Le repli standard corrige les anciens brouillons Express devenus 100 % Normal.
 */
export function resolveOrderPickupOption(
  lines: readonly Pick<OrderLine, 'isExpress'>[],
  pickupOption: PickupOption
): PickupOption {
  const hasExpressLine = lines.some((line) => isOrderLineExpress(line, pickupOption));
  if (hasExpressLine) return 'express';
  return pickupOption === 'express' ? 'standard' : pickupOption;
}

const sanitizeFiniteNumber = (value: number | undefined): number =>
  Number.isFinite(value) ? (value as number) : 0;

const sanitizeNonNegativeAmount = (value: number | undefined): number =>
  Math.max(0, Math.round(sanitizeFiniteNumber(value)));

/**
 * Borne une remise fidélité exprimée en pourcentage.
 *
 * Le frontend doit rester affichable même si une ancienne donnée locale est
 * corrompue : les valeurs non finies deviennent 0 et les valeurs hors
 * intervalle sont ramenées à [0, 100]. La RPC serveur, elle, rejette une
 * remise explicitement hors intervalle au lieu de la corriger silencieusement.
 */
export function normalizeDiscountPercent(value: number | undefined): number {
  return Math.min(100, Math.max(0, sanitizeFiniteNumber(value)));
}

/** Sous-total d'une ligne : prix unitaire × quantité (ou poids en kg). */
export function calculateLineSubtotal(unitPrice: number, quantity: number): number {
  const safeUnitPrice = Math.max(0, sanitizeFiniteNumber(unitPrice));
  const safeQuantity = Math.max(0, sanitizeFiniteNumber(quantity));
  return Math.round(safeUnitPrice * safeQuantity);
}

/** Somme des sous-totaux de lignes, en FCFA entiers et jamais négative. */
export function calculateSubtotal(lines: Pick<OrderLine, 'subtotal'>[]): number {
  return lines.reduce(
    (acc, line) => acc + sanitizeNonNegativeAmount(line.subtotal),
    0
  );
}

export interface OrderTotalsInput {
  pickupOption: PickupOption;
  loyaltyDiscountPercent?: number;
  depositAmount?: number;
  /** Frais forfaitaires de ramassage et/ou de livraison à domicile (FCFA). */
  collectionFee?: number;
  deliveryFee?: number;
}

export interface OrderTotals {
  subtotal: number;
  expressFee: number;
  /** Frais logistiques retenus (jamais négatifs, arrondis au FCFA). */
  collectionFee: number;
  deliveryFee: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  /** Acompte effectivement retenu (plafonné entre 0 et le total). */
  deposit: number;
  remaining: number;
}

const sanitizeFee = sanitizeNonNegativeAmount;

export function calculateOrderTotals(
  lines: Pick<OrderLine, 'subtotal' | 'isExpress'>[],
  {
    pickupOption,
    loyaltyDiscountPercent = 0,
    depositAmount = 0,
    collectionFee = 0,
    deliveryFee = 0,
  }: OrderTotalsInput
): OrderTotals {
  const subtotal = calculateSubtotal(lines);
  // Seules les lignes Express sont majorées : une commande mixte additionne
  // donc les prestations normales et le double des seules lignes urgentes.
  const expressSubtotal = lines.reduce(
    (total, line) =>
      total +
      (isOrderLineExpress(line, pickupOption)
        ? sanitizeNonNegativeAmount(line.subtotal)
        : 0),
    0
  );
  const expressFee = Math.round(expressSubtotal * EXPRESS_SURCHARGE_RATE);
  const safeCollectionFee = sanitizeFee(collectionFee);
  const safeDeliveryFee = sanitizeFee(deliveryFee);
  const discountPercent = normalizeDiscountPercent(loyaltyDiscountPercent);
  // La remise fidélité ne porte que sur les prestations, jamais sur le transport.
  const discountAmount = Math.min(
    subtotal,
    Math.round(subtotal * (discountPercent / 100))
  );
  const total = Math.max(
    0,
    subtotal + expressFee + safeCollectionFee + safeDeliveryFee - discountAmount
  );
  const deposit = Math.min(sanitizeNonNegativeAmount(depositAmount), total);
  const remaining = total - deposit;
  return {
    subtotal,
    expressFee,
    collectionFee: safeCollectionFee,
    deliveryFee: safeDeliveryFee,
    discountPercent,
    discountAmount,
    total,
    deposit,
    remaining,
  };
}
