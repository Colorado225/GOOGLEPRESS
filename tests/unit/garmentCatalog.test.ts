import { describe, expect, it } from 'vitest';
import { INITIAL_CLOTHING_ITEMS } from '../../src/data/demoData';
import {
  MAX_CUSTOM_GARMENTS,
  MAX_GARMENT_NAME_LENGTH,
  buildGarmentId,
  customGarmentToClothingItem,
  getGarmentCatalog,
  normalizeCustomGarments,
  slugifyGarmentName,
  validateCustomGarment,
} from '../../src/lib/garmentCatalog';
import type { CustomGarment } from '../../src/types';

const IMAGE =
  'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAfQ//73v/+BiOh/AAA=';

const garment = (overrides: Partial<CustomGarment> = {}): CustomGarment => ({
  id: 'cg:chemise-lin',
  name: 'Chemise en lin',
  category: 'men',
  unitPrice: 2500,
  unitLabel: 'pièce',
  emoji: '👕',
  imageDataUrl: IMAGE,
  ...overrides,
});

describe('normalizeCustomGarments', () => {
  it('conserve un vêtement complet', () => {
    const [normalized] = normalizeCustomGarments([garment()]);
    expect(normalized).toMatchObject({
      id: 'cg:chemise-lin',
      name: 'Chemise en lin',
      category: 'men',
      unitPrice: 2500,
      imageDataUrl: IMAGE,
    });
  });

  it('écarte les noms vides et les prix invalides', () => {
    const normalized = normalizeCustomGarments([
      garment({ id: 'a', name: '   ' }),
      garment({ id: 'b', unitPrice: -100 }),
      garment({ id: 'c', unitPrice: Number.NaN }),
      garment({ id: 'd', name: 'Blouse' }),
    ]);
    expect(normalized.map((item) => item.id)).toEqual(['d']);
  });

  it('ignore une photo corrompue mais garde le vêtement', () => {
    const [normalized] = normalizeCustomGarments([
      garment({ imageDataUrl: 'https://exemple.test/chemise.jpg' }),
    ]);
    expect(normalized.imageDataUrl).toBeNull();
    expect(normalized.name).toBe('Chemise en lin');
  });

  it('normalise la catégorie inconnue et le libellé manquant', () => {
    const [normalized] = normalizeCustomGarments([
      { ...garment(), category: 'inconnue', unitLabel: '' } as unknown as CustomGarment,
    ]);
    expect(normalized.category).toBe('all');
    expect(normalized.unitLabel).toBe('pièce');
  });

  it('dédoublonne les identifiants et borne le nombre de vêtements', () => {
    const normalized = normalizeCustomGarments([
      garment({ id: 'doublon', name: 'Chemise' }),
      garment({ id: 'doublon', name: 'Pantalon' }),
    ]);
    expect(normalized).toHaveLength(2);
    expect(new Set(normalized.map((item) => item.id)).size).toBe(2);

    const many = Array.from({ length: MAX_CUSTOM_GARMENTS + 5 }, (_, index) =>
      garment({ id: `g-${index}`, name: `Vêtement ${index}` })
    );
    expect(normalizeCustomGarments(many)).toHaveLength(MAX_CUSTOM_GARMENTS);
  });

  it('ne casse pas sur une valeur absente ou corrompue', () => {
    expect(normalizeCustomGarments(undefined)).toEqual([]);
    expect(normalizeCustomGarments('texte')).toEqual([]);
    expect(normalizeCustomGarments([null, 42, {}])).toEqual([]);
  });
});

describe('identifiants', () => {
  it('déduit un identifiant lisible du nom', () => {
    expect(slugifyGarmentName('Chemise en lin')).toBe('chemise-en-lin');
    expect(slugifyGarmentName('Écharpe & Foulard')).toBe('echarpe-foulard');
  });

  it('préfixe et rend unique l’identifiant', () => {
    expect(buildGarmentId('Chemise en lin', [])).toBe('cg:chemise-en-lin');
    expect(
      buildGarmentId('Chemise en lin', [
        garment({ id: 'cg:chemise-en-lin' }),
        garment({ id: 'cg:chemise-en-lin-2' }),
      ])
    ).toBe('cg:chemise-en-lin-3');
  });
});

describe('validateCustomGarment', () => {
  it('accepte un vêtement correct', () => {
    expect(
      validateCustomGarment({ name: 'Chemise en lin', unitPrice: 2500, category: 'men' })
    ).toBeNull();
  });

  it('refuse un nom trop court, un prix nul ou une catégorie inconnue', () => {
    expect(validateCustomGarment({ name: 'C', unitPrice: 2500, category: 'men' })).toMatch(
      /au moins 2 caractères/
    );
    expect(
      validateCustomGarment({ name: 'Chemise', unitPrice: Number.NaN, category: 'men' })
    ).toMatch(/montant valide/);
    expect(
      validateCustomGarment({ name: 'Chemise', unitPrice: 1000, category: 'inconnue' })
    ).toMatch(/catégorie/);
    expect(
      validateCustomGarment({
        name: 'x'.repeat(MAX_GARMENT_NAME_LENGTH + 1),
        unitPrice: 1000,
        category: 'men',
      })
    ).toMatch(/dépasser/);
  });
});

describe('catalogue', () => {
  it('convertit un vêtement créé en ligne vendable', () => {
    const item = customGarmentToClothingItem(garment());
    expect(item).toMatchObject({
      id: 'cg:chemise-lin',
      name: 'Chemise en lin',
      serviceCategory: 'pressing',
      pricingType: 'unit',
      unitPrice: 2500,
      image: IMAGE,
    });
  });

  it('place les vêtements créés devant le catalogue fourni', () => {
    const catalog = getGarmentCatalog({ customGarments: [garment()] });
    expect(catalog).toHaveLength(INITIAL_CLOTHING_ITEMS.length + 1);
    expect(catalog[0].id).toBe('cg:chemise-lin');
    expect(catalog[0].image).toBe(IMAGE);
  });

  it('sans vêtement créé, le catalogue fourni reste intact', () => {
    expect(getGarmentCatalog({ customGarments: [] })).toHaveLength(INITIAL_CLOTHING_ITEMS.length);
  });
});
