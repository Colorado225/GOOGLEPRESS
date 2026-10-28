import { describe, expect, it } from 'vitest';
import {
  calculateLineSubtotal,
  calculateOrderTotals,
  calculateSubtotal,
} from '../../src/lib/pricing';

describe('pricing', () => {
  it('arrondit les lignes au FCFA entier, y compris au kilo', () => {
    expect(calculateLineSubtotal(1500, 1.5)).toBe(2250);
    expect(calculateLineSubtotal(333, 0.5)).toBe(167);
    expect(calculateSubtotal([{ subtotal: 1000 }, { subtotal: 2500 }])).toBe(3500);
  });

  it('applique express et la remise uniquement aux prestations', () => {
    const totals = calculateOrderTotals([{ subtotal: 1000 }, { subtotal: 2500 }], {
      pickupOption: 'express',
      loyaltyDiscountPercent: 10,
      collectionFee: 500.4,
      deliveryFee: -200,
      depositAmount: 10_000,
    });

    expect(totals).toMatchObject({
      subtotal: 3500,
      expressFee: 1750,
      collectionFee: 500,
      deliveryFee: 0,
      discountAmount: 350,
      total: 5400,
      deposit: 5400,
      remaining: 0,
    });
  });

  it('ne majore pas une commande standard et plafonne l’acompte négatif', () => {
    const totals = calculateOrderTotals([{ subtotal: 4000 }], {
      pickupOption: 'standard',
      depositAmount: -500,
    });

    expect(totals.expressFee).toBe(0);
    expect(totals.total).toBe(4000);
    expect(totals.deposit).toBe(0);
    expect(totals.remaining).toBe(4000);
  });

  it('ignore les frais logistiques non finis', () => {
    const totals = calculateOrderTotals([{ subtotal: 2000 }], {
      pickupOption: 'delayed',
      collectionFee: Number.NaN,
      deliveryFee: Number.POSITIVE_INFINITY,
    });

    expect(totals.collectionFee).toBe(0);
    expect(totals.deliveryFee).toBe(0);
    expect(totals.total).toBe(2000);
  });
});
