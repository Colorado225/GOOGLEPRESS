import { describe, expect, it } from 'vitest';
import {
  WORKSHOP_DEFAULT_TAB,
  WORKSHOP_GROUP_KEY,
  WORKSHOP_GROUP_LABEL,
  WORKSHOP_SUBTABS,
  WORKSHOP_SUBTAB_KEYS,
  getWorkshopSubTab,
  getWorkshopTabLabel,
  isWorkshopSubTabActive,
} from '../../src/lib/workshopNav';

describe('workshopNav — structure des sous-onglets', () => {
  it('déclare les quatre sous-onglets de Production & Remise', () => {
    expect(WORKSHOP_SUBTABS.map((subTab) => subTab.label)).toEqual([
      'Production',
      'Rangement atelier',
      'Remises & Livraisons',
      'Caisse & Clôture',
    ]);
  });

  it('pointe chaque entrée vers un onglet d’atelier distinct', () => {
    const tabs = WORKSHOP_SUBTABS.map((subTab) => subTab.workshopTab);
    expect(new Set(tabs).size).toBe(tabs.length);
    expect(tabs).toEqual(['production', 'storage', 'logistics', 'cash']);
  });

  it('utilise des clés uniques et stables', () => {
    expect(new Set(WORKSHOP_SUBTAB_KEYS).size).toBe(WORKSHOP_SUBTAB_KEYS.length);
    expect(WORKSHOP_SUBTAB_KEYS).toEqual([
      'workshop:production',
      'workshop:storage',
      'workshop:logistics',
      'workshop:cash',
    ]);
  });

  it('garde la clé de groupe cohérente avec la navigation', () => {
    expect(WORKSHOP_GROUP_KEY).toBe('workshop');
    expect(WORKSHOP_GROUP_LABEL).toBe('Production & Remise');
  });

  it('ouvre l’atelier sur la production par défaut', () => {
    expect(WORKSHOP_DEFAULT_TAB).toBe('production');
  });

  it('donne des libellés non vides et une icône par entrée', () => {
    for (const subTab of WORKSHOP_SUBTABS) {
      expect(subTab.label.trim().length).toBeGreaterThan(2);
      expect(subTab.icon.trim().length).toBeGreaterThan(2);
    }
  });
});

describe('workshopNav — résolution', () => {
  it('retrouve un sous-onglet par sa clé', () => {
    expect(getWorkshopSubTab('workshop:cash')?.label).toBe('Caisse & Clôture');
    expect(getWorkshopSubTab('workshop:inconnu')).toBeUndefined();
  });

  it('détecte le sous-onglet actif, et un seul à la fois', () => {
    const actives = WORKSHOP_SUBTABS.filter((subTab) =>
      isWorkshopSubTabActive(subTab, 'storage')
    );
    expect(actives).toHaveLength(1);
    expect(actives[0].label).toBe('Rangement atelier');
  });

  it('fournit le libellé d’un onglet, avec repli sur le groupe', () => {
    expect(getWorkshopTabLabel('logistics')).toBe('Remises & Livraisons');
    expect(getWorkshopTabLabel('handover')).toBe(WORKSHOP_GROUP_LABEL);
  });

  it('n’expose aucun onglet de démonstration', () => {
    const labels = WORKSHOP_SUBTABS.map((subTab) => subTab.label).join(' ');
    expect(labels).not.toMatch(/démo/i);
    expect(labels).not.toMatch(/cocody/i);
  });
});
