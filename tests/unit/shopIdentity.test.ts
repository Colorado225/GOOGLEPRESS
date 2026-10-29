import { describe, expect, it } from 'vitest';
import {
  MAX_LOGO_DATA_URL_LENGTH,
  MAX_LOGO_FILE_BYTES,
  buildBrandedTitle,
  getBrandInitials,
  isValidLogoDataUrl,
  resolveShopDisplayName,
  validateLogoFile,
} from '../../src/lib/shopIdentity';
import type { WorkspaceScope } from '../../src/lib/workspaceScope';

const LOGO_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const liveScope = (overrides: Partial<WorkspaceScope> = {}): WorkspaceScope =>
  ({
    mode: 'live',
    shopName: 'Agence Yopougon',
    organizationName: 'Pressing Éclat',
    ...overrides,
  }) as WorkspaceScope;

const demoScope = (overrides: Partial<WorkspaceScope> = {}): WorkspaceScope =>
  ({ mode: 'demo', ...overrides }) as WorkspaceScope;

describe('validateLogoFile', () => {
  it('accepte un PNG, un JPEG et un WebP sous 2 Mo', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(validateLogoFile({ name: 'logo.png', type, size: 1024 })).toBeNull();
    }
  });

  it('refuse un fichier vide, trop lourd ou sans type', () => {
    expect(validateLogoFile({ name: 'a.png', type: 'image/png', size: 0 })).toMatch(/vide/i);
    expect(
      validateLogoFile({ name: 'a.png', type: 'image/png', size: MAX_LOGO_FILE_BYTES + 1 })
    ).toMatch(/2 Mo/);
    expect(validateLogoFile({ name: 'a.png', type: '', size: 10 })).toMatch(/format/i);
  });

  it('refuse le SVG et les formats non image', () => {
    expect(
      validateLogoFile({ name: 'logo.svg', type: 'image/svg+xml', size: 2048 })
    ).toMatch(/SVG/);
    expect(validateLogoFile({ name: 'doc.pdf', type: 'application/pdf', size: 2048 })).toMatch(
      /PNG, un JPEG ou un WebP/
    );
  });
});

describe('isValidLogoDataUrl', () => {
  it('accepte les data URL d’image raster', () => {
    expect(isValidLogoDataUrl(LOGO_PNG)).toBe(true);
    expect(isValidLogoDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true);
    expect(isValidLogoDataUrl('data:image/webp;base64,UklGRhIAAABXRUJQ')).toBe(true);
  });

  it('rejette les URL distantes, le SVG et les valeurs non textuelles', () => {
    expect(isValidLogoDataUrl('https://cdn.exemple.test/logo.png')).toBe(false);
    expect(isValidLogoDataUrl('blob:http://localhost/abc')).toBe(false);
    expect(isValidLogoDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isValidLogoDataUrl('javascript:alert(1)')).toBe(false);
    expect(isValidLogoDataUrl(null)).toBe(false);
    expect(isValidLogoDataUrl(42)).toBe(false);
  });

  it('rejette une data URL démesurée', () => {
    const huge = `data:image/png;base64,${'A'.repeat(MAX_LOGO_DATA_URL_LENGTH)}`;
    expect(isValidLogoDataUrl(huge)).toBe(false);
  });
});

describe('getBrandInitials', () => {
  it('prend les deux premières initiales des mots', () => {
    expect(getBrandInitials('Pressing Éclat')).toBe('PÉ');
    expect(getBrandInitials('  éclat   cocody ')).toBe('ÉC');
  });

  it('prend deux lettres pour un nom d’un seul mot', () => {
    expect(getBrandInitials('Pressing')).toBe('PR');
    expect(getBrandInitials('A')).toBe('A');
  });

  it('retombe sur « P » sans nom exploitable', () => {
    expect(getBrandInitials('')).toBe('P');
    expect(getBrandInitials('   ')).toBe('P');
  });
});

describe('resolveShopDisplayName', () => {
  it('privilégie le nom enregistré dans les Paramètres', () => {
    expect(
      resolveShopDisplayName({ name: 'Éclat Lavage' }, liveScope())
    ).toBe('Éclat Lavage');
  });

  it('utilise le nom de l’agence puis celui de l’organisation', () => {
    expect(resolveShopDisplayName({ name: '   ' }, liveScope())).toBe('Agence Yopougon');
    expect(
      resolveShopDisplayName({ name: '' }, liveScope({ shopName: undefined }))
    ).toBe('Pressing Éclat');
  });

  it('n’affiche jamais le nom du produit pour un pressing réel', () => {
    const name = resolveShopDisplayName(
      { name: '' },
      liveScope({ shopName: '', organizationName: '' })
    );
    expect(name).toBe('Mon pressing');
    expect(name).not.toContain('PressingPro');
  });

  it('garde le libellé de démonstration en mode local', () => {
    expect(resolveShopDisplayName({ name: '' }, demoScope())).toBe(
      'PressingPro CI (démonstration)'
    );
  });
});

describe('buildBrandedTitle', () => {
  it('assemble le libellé de page et le nom du pressing', () => {
    expect(buildBrandedTitle('Réception (POS)', 'Éclat Lavage')).toBe(
      'Réception (POS) — Éclat Lavage'
    );
  });

  it('ignore les segments vides', () => {
    expect(buildBrandedTitle('Rapports', '  ')).toBe('Rapports');
    expect(buildBrandedTitle('  ', 'Éclat')).toBe('Éclat');
    expect(buildBrandedTitle('', '')).toBe('');
  });
});
