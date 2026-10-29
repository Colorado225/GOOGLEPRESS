import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRESSING_SERVICES,
  EMPTY_PRESSING_SETTINGS,
  buildPressingCatalogEntries,
  getPressingServiceLabel,
  hasPressingPrice,
  normalizePressingSettings,
  pressingPriceKey,
  resolvePressingPrice,
  validatePressingSettings,
} from '../../src/lib/pressing';
import type { ClothingItem, PressingSettings } from '../../src/types';

const item = (overrides: Partial<ClothingItem> = {}): ClothingItem => ({
  id: 'c1',
  name: 'Chemise',
  category: 'men',
  serviceCategory: 'pressing',
  unitPrice: 1500,
  pricingType: 'unit',
  unitLabel: 'pièce',
  emoji: '👔',
  ...overrides,
});

const settings = (overrides: Partial<PressingSettings> = {}): PressingSettings => ({
  services: DEFAULT_PRESSING_SERVICES.map((service) => ({ ...service })),
  prices: {},
  ...overrides,
});

describe('normalizePressingSettings', () => {
  it('retombe sur les prestations par défaut quand rien n’est enregistré', () => {
    const normalized = normalizePressingSettings(undefined);
    expect(normalized.services.map((service) => service.label)).toEqual([
      'Lavage + Repassage',
      'Nettoyage à sec',
      'Repassage seul',
      'Teinture',
    ]);
    expect(normalized.prices).toEqual({});
  });

  it('écarte les libellés vides et les doublons d’identifiant', () => {
    const normalized = normalizePressingSettings({
      services: [
        { id: 'a', label: '  Nettoyage à sec  ' },
        { id: 'a', label: 'Doublon' },
        { id: 'b', label: '   ' },
        { id: 'c', label: 'Teinture' },
      ],
    });
    expect(normalized.services).toEqual([
      { id: 'a', label: 'Nettoyage à sec' },
      { id: 'c', label: 'Teinture' },
    ]);
  });

  it('ignore les prix hors bornes ou mal formés', () => {
    const normalized = normalizePressingSettings({
      prices: {
        'c1:wash_iron': 2500,
        'c2:dry_clean': -10,
        'c3:dye': 'beaucoup',
        'clé-sans-deux-points': 1000,
        'c4:iron_only': 2000,
      },
    });
    expect(normalized.prices).toEqual({ 'c1:wash_iron': 2500, 'c4:iron_only': 2000 });
  });

  it('ne casse pas sur une sauvegarde corrompue', () => {
    expect(normalizePressingSettings('n’importe quoi').services).toHaveLength(4);
    expect(normalizePressingSettings({ services: 42, prices: 'non' }).prices).toEqual({});
  });
});

describe('validatePressingSettings', () => {
  it('accepte les réglages par défaut', () => {
    expect(validatePressingSettings(settings())).toBeNull();
  });

  it('refuse une liste vide, un nom vide et un doublon', () => {
    expect(validatePressingSettings(settings({ services: [] }))).toMatch(/au moins un/);
    expect(
      validatePressingSettings(settings({ services: [{ id: 'a', label: '  ' }] }))
    ).toMatch(/nom/);
    expect(
      validatePressingSettings(
        settings({
          services: [
            { id: 'a', label: 'Teinture' },
            { id: 'b', label: 'teinture' },
          ],
        })
      )
    ).toMatch(/existe déjà/);
  });

  it('refuse un prix négatif', () => {
    expect(validatePressingSettings(settings({ prices: { 'c1:dye': -5 } }))).toMatch(/invalide/);
  });
});

describe('resolvePressingPrice', () => {
  it('utilise le prix réglé pour la prestation', () => {
    const priced = settings({ prices: { [pressingPriceKey('c1', 'dry_clean')]: 2500 } });
    expect(resolvePressingPrice(item(), priced, 'dry_clean')).toBe(2500);
    expect(hasPressingPrice(priced, 'c1', 'dry_clean')).toBe(true);
  });

  it('retombe sur le prix de base du catalogue', () => {
    expect(resolvePressingPrice(item(), settings(), 'dry_clean')).toBe(1500);
    expect(hasPressingPrice(settings(), 'c1', 'dry_clean')).toBe(false);
  });

  it('expose le libellé d’une prestation', () => {
    expect(getPressingServiceLabel(settings(), 'dry_clean')).toBe('Nettoyage à sec');
    expect(getPressingServiceLabel(settings(), 'inconnue')).toBe('');
  });
});

describe('buildPressingCatalogEntries', () => {
  it('génère un article par vêtement et par prestation, à clé stable', () => {
    const items = [item(), item({ id: 'c2', name: 'Pantalon', unitPrice: 1500 })];
    const entries = buildPressingCatalogEntries(items, settings());
    expect(entries).toHaveLength(8);
    expect(entries[0]).toMatchObject({
      legacyKey: 'pressing:wash_iron:c1',
      name: 'Chemise — Lavage + Repassage',
      unitPrice: 1500,
      serviceType: 'Lavage + Repassage',
    });
  });

  it('applique les prix réglés et ignore les articles blanchisserie', () => {
    const items = [item(), item({ id: 'b1', serviceCategory: 'blanchisserie' })];
    const entries = buildPressingCatalogEntries(
      items,
      settings({ prices: { [pressingPriceKey('c1', 'dry_clean')]: 3000 } })
    );
    expect(entries).toHaveLength(4);
    expect(entries.every((entry) => entry.legacyKey.includes(':c1'))).toBe(true);
    const dryClean = entries.find((entry) => entry.legacyKey === 'pressing:dry_clean:c1')!;
    expect(dryClean.unitPrice).toBe(3000);
  });

  it('ne produit rien sans prestation', () => {
    expect(buildPressingCatalogEntries([item()], settings({ services: [] }))).toEqual([]);
  });
});

describe('réglages par défaut', () => {
  it('ne contient aucun tarif inventé', () => {
    expect(EMPTY_PRESSING_SETTINGS.prices).toEqual({});
  });

  it('propose les quatre traitements demandés, sans Express 24h', () => {
    const labels = EMPTY_PRESSING_SETTINGS.services.map((service) => service.label);
    expect(labels).toEqual([
      'Lavage + Repassage',
      'Nettoyage à sec',
      'Repassage seul',
      'Teinture',
    ]);
    expect(labels.some((label) => /express/i.test(label))).toBe(false);
  });
});
