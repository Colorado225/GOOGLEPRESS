import { describe, expect, it } from 'vitest';
import {
  calculateLineSubtotal,
  calculateOrderTotals,
  calculateSubtotal,
  normalizeDiscountPercent,
  resolveOrderPickupOption,
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

    // Express 24h = le double du service normal : 3 500 × 2, plus la course,
    // moins la remise fidélité (calculée sur les prestations).
    expect(totals).toMatchObject({
      subtotal: 3500,
      expressFee: 3500,
      collectionFee: 500,
      deliveryFee: 0,
      discountAmount: 350,
      total: 7150,
      deposit: 7150,
      remaining: 0,
    });
  });

  it('ne majore que les lignes Express dans une commande mixte', () => {
    const totals = calculateOrderTotals(
      [
        { subtotal: 1000, isExpress: false },
        { subtotal: 2500, isExpress: true },
      ],
      { pickupOption: 'standard', loyaltyDiscountPercent: 10 }
    );

    expect(totals).toMatchObject({
      subtotal: 3500,
      expressFee: 2500,
      discountAmount: 350,
      total: 5650,
    });
  });

  it('respecte une ligne explicitement normale même si le retrait global est Express', () => {
    const totals = calculateOrderTotals(
      [
        { subtotal: 1000, isExpress: false },
        { subtotal: 2500 },
      ],
      { pickupOption: 'express' }
    );

    expect(totals.expressFee).toBe(2500);
    expect(totals.total).toBe(6000);
  });

  it('dérive la priorité Express des lignes sans convertir les lignes Normal', () => {
    const lines = [
      { subtotal: 1000, isExpress: false },
      { subtotal: 2500, isExpress: true },
    ];

    expect(resolveOrderPickupOption(lines, 'standard')).toBe('express');
    expect(resolveOrderPickupOption(lines, 'delayed')).toBe('express');
    expect(lines).toEqual([
      { subtotal: 1000, isExpress: false },
      { subtotal: 2500, isExpress: true },
    ]);
    expect(calculateOrderTotals(lines, { pickupOption: 'delayed' }).expressFee).toBe(2500);
  });

  it('retombe en Standard quand un ancien brouillon Express ne contient plus que du Normal', () => {
    expect(resolveOrderPickupOption([{ isExpress: false }], 'express')).toBe('standard');
    expect(resolveOrderPickupOption([], 'express')).toBe('standard');
    expect(resolveOrderPickupOption([{ isExpress: true }], 'standard')).toBe('express');
    expect(resolveOrderPickupOption([{}], 'express')).toBe('express');
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

  it('borne la remise fidélité entre 0 et 100 % et ne produit jamais un total négatif', () => {
    expect(normalizeDiscountPercent(-10)).toBe(0);
    expect(normalizeDiscountPercent(150)).toBe(100);
    expect(normalizeDiscountPercent(Number.NaN)).toBe(0);

    const totals = calculateOrderTotals([{ subtotal: 2000 }], {
      pickupOption: 'standard',
      loyaltyDiscountPercent: 150,
      depositAmount: Number.POSITIVE_INFINITY,
    });

    expect(totals.discountPercent).toBe(100);
    expect(totals.discountAmount).toBe(2000);
    expect(totals.total).toBe(0);
    expect(totals.deposit).toBe(0);
    expect(totals.remaining).toBe(0);
  });

  it('neutralise les lignes négatives ou non finies au lieu de propager un montant invalide', () => {
    expect(calculateLineSubtotal(-500, 2)).toBe(0);
    expect(calculateLineSubtotal(500, Number.NaN)).toBe(0);
    expect(
      calculateSubtotal([
        { subtotal: 1000.6 },
        { subtotal: -200 },
        { subtotal: Number.POSITIVE_INFINITY },
      ])
    ).toBe(1001);
  });
});
