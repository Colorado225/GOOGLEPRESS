import type { OrderLine, PickupOption } from '../types';

/**
 * Calculs tarifaires — PressingPro CI.
 *
 * Point d'entrée UNIQUE pour tous les montants d'une commande.
 * Avant ce module, la même formule (sous-total, express +50 %, remise
 * fidélité, total, reste à payer) était recopiée dans AppContext,
 * OrderCartTicket et Step3SummaryAndConfirm, avec un risque de divergence
 * entre le montant affiché à l'écran et celui enregistré sur la commande.
 * Tous les montants sont en FCFA entiers (pas de centimes).
 */

/** Majoration appliquée aux commandes express (+50 % du sous-total). */
export const EXPRESS_SURCHARGE_RATE = 0.5;

/** Sous-total d'une ligne : prix unitaire × quantité (ou poids en kg). */
export function calculateLineSubtotal(unitPrice: number, quantity: number): number {
  return Math.round(unitPrice * quantity);
}

/** Somme des sous-totaux de lignes. */
export function calculateSubtotal(lines: Pick<OrderLine, 'subtotal'>[]): number {
  return lines.reduce((acc, line) => acc + line.subtotal, 0);
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

const sanitizeFee = (fee: number | undefined): number =>
  Number.isFinite(fee) ? Math.max(0, Math.round(fee as number)) : 0;

export function calculateOrderTotals(
  lines: Pick<OrderLine, 'subtotal'>[],
  {
    pickupOption,
    loyaltyDiscountPercent = 0,
    depositAmount = 0,
    collectionFee = 0,
    deliveryFee = 0,
  }: OrderTotalsInput
): OrderTotals {
  const subtotal = calculateSubtotal(lines);
  const expressFee =
    pickupOption === 'express' ? Math.round(subtotal * EXPRESS_SURCHARGE_RATE) : 0;
  const safeCollectionFee = sanitizeFee(collectionFee);
  const safeDeliveryFee = sanitizeFee(deliveryFee);
  const discountPercent = loyaltyDiscountPercent || 0;
  // La remise fidélité ne porte que sur les prestations, jamais sur le transport.
  const discountAmount = Math.round(subtotal * (discountPercent / 100));
  const total = subtotal + expressFee + safeCollectionFee + safeDeliveryFee - discountAmount;
  const deposit = Math.min(Math.max(0, depositAmount), total);
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
