import { describe, expect, it } from 'vitest';
import {
  BLANCHISSERIE_SERVICES,
  DEMO_BLANCHISSERIE_SETTINGS,
  EMPTY_BLANCHISSERIE_SETTINGS,
  MAX_TIER_GARMENTS,
  buildBlanchisserieCatalogEntries,
  buildBlanchisserieItem,
  calculateBlanchisserieQuote,
  calculateIroningQuote,
  countPricedIronGarments,
  describeBlanchisserieQuote,
  formatGarments,
  getBlanchisserieMode,
  isBlanchisserieConfigured,
  normalizeBlanchisserieSettings,
  validateBlanchisserieSettings,
} from '../../src/lib/blanchisserie';
import type { BlanchisserieSettings, ClothingItem } from '../../src/types';

const grid = (): BlanchisserieSettings => ({
  tiers: [
    { id: 'tier-10', garments: 10, prices: { wash_only: 2000, wash_iron: 3000, iron_only: 0 } },
    { id: 'tier-20', garments: 20, prices: { wash_only: 3500, wash_iron: 5000, iron_only: 0 } },
    { id: 'tier-30', garments: 30, prices: { wash_only: 4500, wash_iron: 6500, iron_only: 0 } },
  ],
  unitPrices: { wash_only: 300, wash_iron: 500, iron_only: 250 },
  perGarment: { wash_only: false, wash_iron: false, iron_only: true },
  ironPrices: { c1: 500, c2: 600 },
});

const garment = (id: string, name: string, emoji = '👕'): ClothingItem => ({
  id,
  name,
  category: 'all',
  serviceCategory: 'pressing',
  unitPrice: 1500,
  pricingType: 'unit',
  unitLabel: 'pièce',
  emoji,
});

describe('normalizeBlanchisserieSettings', () => {
  it('trie les paliers et écarte les doublons de nombre de vêtements', () => {
    const normalized = normalizeBlanchisserieSettings({
      tiers: [
        { id: 'b', garments: 30, prices: { wash_only: 4500 } },
        { id: 'a', garments: 10, prices: { wash_only: 2000 } },
        { id: 'c', garments: 30, prices: { wash_only: 9999 } },
      ],
      unitPrices: { wash_only: 300 },
    });
    expect(normalized.tiers.map((tier) => tier.garments)).toEqual([10, 30]);
    expect(normalized.tiers[1].prices.wash_only).toBe(4500);
  });

  it('écarte les paliers invalides ou sans aucun prix', () => {
    const normalized = normalizeBlanchisserieSettings({
      tiers: [
        { garments: 1, prices: { wash_only: 1000 } },
        { garments: MAX_TIER_GARMENTS + 1, prices: { wash_only: 1000 } },
        { garments: 20, prices: { wash_only: 0 } },
        { garments: 25, prices: { wash_only: 3000 } },
      ],
    });
    expect(normalized.tiers.map((tier) => tier.garments)).toEqual([25]);
  });

  it('applique les modes par défaut : repassage au vêtement', () => {
    const normalized = normalizeBlanchisserieSettings({});
    expect(normalized.perGarment).toEqual({
      wash_only: false,
      wash_iron: false,
      iron_only: true,
    });
    expect(normalized.tiers).toEqual([]);
    expect(normalized.unitPrices).toEqual({ wash_only: 0, wash_iron: 0, iron_only: 0 });
    expect(normalized.ironPrices).toEqual({});
  });

  it('nettoie les prix de repassage et élague les vêtements inconnus', () => {
    const normalized = normalizeBlanchisserieSettings(
      {
        ironPrices: {
          c1: 500,
          '  ': 300,
          c2: 'six cents',
          c3: -50,
          c9: 250,
        },
      },
      ['c1', 'c2', 'c3']
    );
    expect(normalized.ironPrices).toEqual({ c1: 500 });
  });

  it('conserve les lignes de repassage sans catalogue connu', () => {
    const normalized = normalizeBlanchisserieSettings({ ironPrices: { 'cg:robe-lin': 800 } });
    expect(normalized.ironPrices).toEqual({ 'cg:robe-lin': 800 });
  });

  it('ne casse pas sur une sauvegarde corrompue', () => {
    expect(normalizeBlanchisserieSettings(null).tiers).toEqual([]);
    expect(normalizeBlanchisserieSettings('n’importe quoi').tiers).toEqual([]);
    expect(
      normalizeBlanchisserieSettings({ tiers: 'pas un tableau', unitPrices: 42 }).tiers
    ).toEqual([]);
  });
});

describe('isBlanchisserieConfigured / validateBlanchisserieSettings', () => {
  it('une grille vide n’est pas configurée', () => {
    expect(isBlanchisserieConfigured(EMPTY_BLANCHISSERIE_SETTINGS)).toBe(false);
    expect(validateBlanchisserieSettings(EMPTY_BLANCHISSERIE_SETTINGS)).toMatch(
      /au moins un forfait/
    );
  });

  it('la grille de démonstration est valide', () => {
    expect(isBlanchisserieConfigured(DEMO_BLANCHISSERIE_SETTINGS)).toBe(true);
    expect(validateBlanchisserieSettings(DEMO_BLANCHISSERIE_SETTINGS)).toBeNull();
  });

  it('un seul vêtement tarifé en repassage suffit à configurer', () => {
    // Boutique « repassage seul » : les lavages sont basculés au vêtement (à
    // zéro, donc inutilisés) pour ne pas exiger de paliers de forfait.
    const settings: BlanchisserieSettings = {
      tiers: [],
      unitPrices: { wash_only: 0, wash_iron: 0, iron_only: 0 },
      perGarment: { wash_only: true, wash_iron: true, iron_only: true },
      ironPrices: { c3: 800 },
    };
    expect(countPricedIronGarments(settings)).toBe(1);
    expect(isBlanchisserieConfigured(settings)).toBe(true);
    expect(validateBlanchisserieSettings(settings)).toBeNull();
  });

  it('une ligne de repassage à zéro ne configure pas', () => {
    const settings: BlanchisserieSettings = {
      tiers: [],
      unitPrices: { wash_only: 0, wash_iron: 0, iron_only: 0 },
      perGarment: { wash_only: false, wash_iron: false, iron_only: true },
      ironPrices: { c3: 0 },
    };
    expect(isBlanchisserieConfigured(settings)).toBe(false);
    expect(validateBlanchisserieSettings(settings)).toMatch(/prix de repassage/);
  });

  it('signale une prestation au forfait sans palier', () => {
    const settings = grid();
    // Seul le lavage simple garde des paliers : le lavage + repassage reste au
    // forfait sans aucun tarif.
    settings.tiers = settings.tiers.map((tier) => ({
      ...tier,
      prices: { ...tier.prices, wash_iron: 0 },
    }));
    expect(validateBlanchisserieSettings(settings)).toMatch(/Lavage \+ repassage/);
  });

  it('signale les doublons de nombre de vêtements', () => {
    const settings = grid();
    settings.tiers.push({
      id: 'doublon',
      garments: 20,
      prices: { wash_only: 4000, wash_iron: 5000, iron_only: 0 },
    });
    expect(validateBlanchisserieSettings(settings)).toMatch(/même nombre de vêtements/);
  });
});

describe('calculateBlanchisserieQuote — forfaits au nombre de vêtements', () => {
  it('facture un palier exact au prix du forfait', () => {
    const quote = calculateBlanchisserieQuote(grid(), 'wash_iron', 20)!;
    expect(quote.subtotal).toBe(5000);
    expect(quote.blocks).toHaveLength(1);
    expect(quote.blocks[0]).toMatchObject({
      kind: 'forfait',
      garmentsPerUnit: 20,
      quantity: 1,
      unitPrice: 5000,
    });
    expect(quote.blocks[0].name).toBe('Forfait 20 vêtements — Lavage + repassage');
  });

  it('complète au prix du vêtement au-delà du palier', () => {
    const quote = calculateBlanchisserieQuote(grid(), 'wash_iron', 25)!;
    expect(quote.subtotal).toBe(7500);
    expect(quote.blocks.map((block) => [block.kind, block.quantity])).toEqual([
      ['forfait', 1],
      ['per_garment', 5],
    ]);
    expect(describeBlanchisserieQuote(quote)).toBe(
      '1 forfait de 20 vêtements + 5 vêtements à l’unité'
    );
  });

  it('enchaîne les paliers quand le reste en contient un autre', () => {
    // 40 vêtements = 30 (4 500) + 10 (2 000), et non 30 + 10 000 à l'unité.
    const quote = calculateBlanchisserieQuote(grid(), 'wash_only', 40)!;
    expect(quote.subtotal).toBe(6500);
    expect(quote.blocks.map((block) => [block.kind, block.garmentsPerUnit, block.quantity])).toEqual([
      ['forfait', 30, 1],
      ['forfait', 10, 1],
    ]);
  });

  it('prend le plus gros forfait d’abord, même quand un cumul de petits paliers serait moins cher', () => {
    // 18 vêtements : 10 (3 000) + 8 × 500 = 7 000 — décomposition prévisible.
    const quote = calculateBlanchisserieQuote(grid(), 'wash_iron', 18)!;
    expect(quote.subtotal).toBe(7000);
    expect(quote.blocks.map((block) => block.kind)).toEqual(['forfait', 'per_garment']);
    expect(quote.blocks[0].garmentsPerUnit).toBe(10);
  });

  it('retourne null si le nombre de vêtements n’est pas couvrable', () => {
    const settings = grid();
    settings.unitPrices.wash_only = 0;
    expect(calculateBlanchisserieQuote(settings, 'wash_only', 25)).toBeNull();
    expect(calculateBlanchisserieQuote(settings, 'wash_only', 30)).not.toBeNull();
  });

  it('refuse une quantité nulle ou négative', () => {
    expect(calculateBlanchisserieQuote(grid(), 'wash_iron', 0)).toBeNull();
    expect(calculateBlanchisserieQuote(grid(), 'wash_iron', -4)).toBeNull();
  });
});

describe('calculateIroningQuote — repassage au prix de chaque vêtement', () => {
  it('facture chaque vêtement à son prix réglé', () => {
    const quote = calculateIroningQuote(grid(), [
      { item: garment('c1', 'Chemise', '👔'), quantity: 2 },
      { item: garment('c2', 'Pantalon', '👖'), quantity: 1 },
    ])!;
    expect(getBlanchisserieMode(grid(), 'iron_only')).toBe('per_garment');
    expect(quote.subtotal).toBe(1600);
    expect(quote.garments).toBe(3);
    expect(quote.blocks).toHaveLength(2);
    expect(quote.blocks[0]).toMatchObject({
      kind: 'per_garment',
      quantity: 2,
      unitPrice: 500,
      subtotal: 1000,
      unitLabel: 'pièce',
      itemId: 'bf:iron_only:c1',
      emoji: '👔',
    });
    expect(quote.blocks[0].name).toBe('Repassage — Chemise');
    expect(quote.blocks[1].name).toBe('Repassage — Pantalon');
    expect(quote.averagePerGarment).toBe(533);
    expect(describeBlanchisserieQuote(quote)).toBe(
      '2 × Repassage — Chemise + 1 × Repassage — Pantalon'
    );
  });

  it('bloque dès qu’un vêtement n’a pas de prix', () => {
    expect(
      calculateIroningQuote(grid(), [
        { item: garment('c1', 'Chemise'), quantity: 1 },
        { item: garment('c3', 'Robe'), quantity: 1 },
      ])
    ).toBeNull();
  });

  it('bloque un dépôt vide ou une quantité invalide', () => {
    expect(calculateIroningQuote(grid(), [])).toBeNull();
    expect(
      calculateIroningQuote(grid(), [{ item: garment('c1', 'Chemise'), quantity: 0 }])
    ).toBeNull();
  });

  it('le devis au simple nombre ne tarife plus le repassage', () => {
    expect(calculateBlanchisserieQuote(grid(), 'iron_only', 7)).toBeNull();
  });

  it('l’article de panier garde la vignette du vêtement', () => {
    const quote = calculateIroningQuote(grid(), [
      { item: { ...garment('c1', 'Chemise', '👔'), image: 'data:image/png,chemise' }, quantity: 1 },
    ])!;
    expect(buildBlanchisserieItem(quote.blocks[0])).toMatchObject({
      id: 'bf:iron_only:c1',
      name: 'Repassage — Chemise',
      serviceCategory: 'blanchisserie',
      unitPrice: 500,
      emoji: '👔',
      image: 'data:image/png,chemise',
    });
  });
});

describe('catalogue Supabase de la blanchisserie', () => {
  it('génère un article par forfait, par lavage à l’unité et par vêtement repassé', () => {
    const entries = buildBlanchisserieCatalogEntries(grid(), (garmentId) => ({
      name: garmentId === 'c1' ? 'Chemise' : 'Pantalon',
      unitLabel: 'pièce',
    }));
    expect(entries.map((entry) => entry.legacyKey)).toEqual([
      'bf:wash_only:10',
      'bf:wash_only:20',
      'bf:wash_only:30',
      'bf:wash_only:unit',
      'bf:wash_iron:10',
      'bf:wash_iron:20',
      'bf:wash_iron:30',
      'bf:wash_iron:unit',
      'bf:iron_only:c1',
      'bf:iron_only:c2',
    ]);
    const forfait = entries.find((entry) => entry.legacyKey === 'bf:wash_iron:20')!;
    expect(forfait).toMatchObject({
      name: 'Forfait 20 vêtements — Lavage + repassage',
      unitPrice: 5000,
      unitLabel: 'forfait',
      pricingType: 'unit',
      serviceCategory: 'blanchisserie',
    });
    const chemise = entries.find((entry) => entry.legacyKey === 'bf:iron_only:c1')!;
    expect(chemise).toMatchObject({
      name: 'Repassage — Chemise',
      unitPrice: 500,
      unitLabel: 'pièce',
      pricingType: 'unit',
      serviceCategory: 'blanchisserie',
    });
    expect(entries.every((entry) => entry.unitPrice > 0)).toBe(true);
  });

  it('aucun article quand la grille est vide', () => {
    expect(buildBlanchisserieCatalogEntries(EMPTY_BLANCHISSERIE_SETTINGS)).toEqual([]);
  });
});

describe('libellés', () => {
  it('accorde le nombre de vêtements', () => {
    expect(formatGarments(1)).toBe('1 vêtement');
    expect(formatGarments(20)).toBe('20 vêtements');
  });

  it('expose les trois prestations demandées', () => {
    expect(BLANCHISSERIE_SERVICES.map((service) => service.label)).toEqual([
      'Lavage simple',
      'Lavage + repassage',
      'Repassage',
    ]);
  });
});
