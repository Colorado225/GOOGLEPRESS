import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIDEBAR_ORDER,
  isCustomSidebarOrder,
  mergeSidebarOrder,
  moveSidebarItem,
  parseSidebarOrder,
  reorderSidebarItems,
} from '../../src/lib/sidebarLayout';

const DEFAULTS = [...DEFAULT_SIDEBAR_ORDER];

describe('sidebarLayout — fusion de l’ordre', () => {
  it('renvoie l’ordre par défaut si rien n’est enregistré', () => {
    expect(mergeSidebarOrder(null, DEFAULTS)).toEqual(DEFAULTS);
    expect(mergeSidebarOrder(undefined, DEFAULTS)).toEqual(DEFAULTS);
    expect(mergeSidebarOrder({ ordre: 'x' }, DEFAULTS)).toEqual(DEFAULTS);
  });

  it('respecte un ordre enregistré valide', () => {
    const saved = ['settings', 'dashboard', 'pos'];
    const merged = mergeSidebarOrder(saved, DEFAULTS);
    expect(merged.slice(0, 3)).toEqual(saved);
    expect(merged).toHaveLength(DEFAULTS.length);
  });

  it('ajoute en fin les entrées nouvelles absentes de la sauvegarde', () => {
    const saved = ['settings', 'dashboard'];
    const merged = mergeSidebarOrder(saved, ['dashboard', 'pos', 'settings', 'clients']);
    expect(merged).toEqual(['settings', 'dashboard', 'pos', 'clients']);
  });

  it('ignore les identifiants inconnus et les doublons', () => {
    const merged = mergeSidebarOrder(
      ['settings', 'disparu', 'settings', 42, 'pos'],
      ['pos', 'settings', 'clients']
    );
    expect(merged).toEqual(['settings', 'pos', 'clients']);
  });

  it('ne perd aucune entrée disponible, même si la sauvegarde est partielle', () => {
    const merged = mergeSidebarOrder(['reports'], DEFAULTS);
    expect(new Set(merged)).toEqual(new Set(DEFAULTS));
    expect(merged).toHaveLength(DEFAULTS.length);
  });
});

describe('sidebarLayout — groupes et migration', () => {
  it('regroupe les anciens onglets d’atelier sous une seule entrée', () => {
    expect(DEFAULT_SIDEBAR_ORDER).toContain('workshop');
    expect(DEFAULT_SIDEBAR_ORDER).not.toContain('workshop:storage');
    expect(DEFAULT_SIDEBAR_ORDER).not.toContain('closing');
  });

  it('ramène une sauvegarde héritée vers le groupe, sans perdre sa position', () => {
    // Ordre enregistré avant le passage en sous-onglets : le groupe doit
    // reprendre la place du premier ancien onglet rencontré.
    const legacy = [
      'dashboard',
      'pos',
      'workshop:storage',
      'workshop:logistics',
      'closing',
      'clients',
      'employees',
      'inventory',
      'expenses',
      'reports',
      'settings',
    ];
    const merged = mergeSidebarOrder(legacy, DEFAULTS);
    expect(merged).toEqual([
      'dashboard',
      'pos',
      'workshop',
      'clients',
      'employees',
      'inventory',
      'expenses',
      'reports',
      'settings',
    ]);
  });

  it('place le groupe en fin de liste si sa clé n’était pas connue', () => {
    const merged = mergeSidebarOrder(['dashboard'], DEFAULTS);
    expect(merged[0]).toBe('dashboard');
    expect(merged).toContain('workshop');
    expect(merged).toHaveLength(DEFAULTS.length);
  });

  it('accepte une table d’alias personnalisée', () => {
    const merged = mergeSidebarOrder(['ancien'], ['nouveau', 'autre'], { ancien: 'nouveau' });
    expect(merged).toEqual(['nouveau', 'autre']);
  });
});

describe('sidebarLayout — lecture défensive', () => {
  it('retourne null sur une valeur absente ou illisible', () => {
    expect(parseSidebarOrder(null)).toBeNull();
    expect(parseSidebarOrder('')).toBeNull();
    expect(parseSidebarOrder('{invalide')).toBeNull();
  });

  it('relit un tableau enregistré', () => {
    expect(parseSidebarOrder('["pos","dashboard"]')).toEqual(['pos', 'dashboard']);
  });
});

describe('sidebarLayout — déplacements', () => {
  it('déplace une entrée vers le haut et vers le bas', () => {
    const order = ['a', 'b', 'c'];
    expect(moveSidebarItem(order, 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveSidebarItem(order, 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('respecte les bornes de la liste', () => {
    const order = ['a', 'b', 'c'];
    expect(moveSidebarItem(order, 'a', -1)).toEqual(['a', 'b', 'c']);
    expect(moveSidebarItem(order, 'c', 1)).toEqual(['a', 'b', 'c']);
  });

  it('ignore un identifiant inconnu sans rien casser', () => {
    expect(moveSidebarItem(['a', 'b'], 'zzz', 1)).toEqual(['a', 'b']);
    expect(moveSidebarItem(['a', 'b'], 'a', 0)).toEqual(['a', 'b']);
  });

  it('ne modifie jamais le tableau d’origine', () => {
    const order = ['a', 'b', 'c'];
    moveSidebarItem(order, 'a', 2);
    reorderSidebarItems(order, 'a', 'c');
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('place l’élément glissé à la position de la cible', () => {
    expect(reorderSidebarItems(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual([
      'a',
      'd',
      'b',
      'c',
    ]);
    expect(reorderSidebarItems(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual([
      'b',
      'c',
      'a',
      'd',
    ]);
  });

  it('ignore un glisser-déposer sur soi-même ou avec une cible inconnue', () => {
    expect(reorderSidebarItems(['a', 'b'], 'a', 'a')).toEqual(['a', 'b']);
    expect(reorderSidebarItems(['a', 'b'], 'a', 'inconnu')).toEqual(['a', 'b']);
  });
});

describe('sidebarLayout — détection de personnalisation', () => {
  it('reconnaît l’ordre par défaut', () => {
    expect(isCustomSidebarOrder(DEFAULTS, DEFAULTS)).toBe(false);
  });

  it('détecte un ordre différent ou incomplet', () => {
    expect(isCustomSidebarOrder(['pos', 'dashboard'], DEFAULTS)).toBe(true);
    expect(isCustomSidebarOrder(DEFAULTS.slice(1), DEFAULTS)).toBe(true);
  });
});
