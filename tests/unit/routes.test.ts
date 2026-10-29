import { describe, expect, it } from 'vitest';
import {
  ERP_ROUTES,
  erpPathForScreen,
  getErpScreenTitle,
  getStaffLoginRedirectPath,
  parseErpRoute,
  resolveAppRoute,
  resolveStaffReturnPath,
} from '../../src/lib/routes';

describe('parseErpRoute', () => {
  it('reconnaît les dix écrans ERP par leur chemin français', () => {
    expect(parseErpRoute('/')).toBe('dashboard');
    expect(parseErpRoute('/reception')).toBe('pos');
    expect(parseErpRoute('/atelier')).toBe('workshop');
    expect(parseErpRoute('/commandes')).toBe('orders');
    expect(parseErpRoute('/clients')).toBe('clients');
    expect(parseErpRoute('/personnel')).toBe('employees');
    expect(parseErpRoute('/stocks')).toBe('inventory');
    expect(parseErpRoute('/depenses')).toBe('expenses');
    expect(parseErpRoute('/rapports')).toBe('reports');
    expect(parseErpRoute('/parametres')).toBe('settings');
  });

  it('accepte l’alias du tableau de bord et les slashs finaux', () => {
    expect(parseErpRoute('/tableau-de-bord')).toBe('dashboard');
    expect(parseErpRoute('/atelier/')).toBe('workshop');
    expect(parseErpRoute('')).toBe('dashboard');
  });

  it('ouvre l’écran coursier par son URL et son alias', () => {
    expect(parseErpRoute('/tournee')).toBe('courier');
    expect(parseErpRoute('/ma-tournee')).toBe('courier');
    expect(parseErpRoute('/tournee/')).toBe('courier');
    expect(erpPathForScreen('courier')).toBe('/tournee');
  });

  it('rejette les chemins hors ERP et les sous-vues internes', () => {
    expect(parseErpRoute('/connexion')).toBeNull();
    expect(parseErpRoute('/administration')).toBeNull();
    expect(parseErpRoute('/client/connexion')).toBeNull();
    // Les onglets de l’atelier sont des vues internes, pas des routes.
    expect(parseErpRoute('/atelier/rangement')).toBeNull();
    expect(parseErpRoute('/ecran-qui-nexiste-pas')).toBeNull();
  });
});

describe('erpPathForScreen', () => {
  it('fournit un chemin canonique unique et réversible par écran', () => {
    expect(ERP_ROUTES).toHaveLength(11);
    const paths = new Set<string>();
    for (const route of ERP_ROUTES) {
      const canonical = erpPathForScreen(route.screen);
      expect(canonical).toBe(route.path);
      expect(parseErpRoute(canonical)).toBe(route.screen);
      paths.add(canonical);
    }
    expect(paths.size).toBe(ERP_ROUTES.length);
  });

  it('intitule les écrans avec leur libellé métier', () => {
    // Sans nom de pressing connu, le nom du produit sert de repli.
    expect(getErpScreenTitle('pos')).toBe('Réception (POS) — PressingPro CI');
    // Sur un espace réel, le titre porte le nom du pressing.
    expect(getErpScreenTitle('pos', 'Pressing Éclat')).toBe('Réception (POS) — Pressing Éclat');
    expect(getErpScreenTitle('pos', '   ')).toBe('Réception (POS) — PressingPro CI');
    expect(getErpScreenTitle('workshop')).toBe('Production & Remise — PressingPro CI');
    expect(getErpScreenTitle('courier')).toBe('Ma tournée — PressingPro CI');
    expect(getErpScreenTitle('courier', 'Pressing Éclat')).toBe('Ma tournée — Pressing Éclat');
  });
});

describe('resolveAppRoute', () => {
  it('résout chaque contexte dans l’ordre de précédence', () => {
    expect(resolveAppRoute('/client')).toEqual({
      context: 'customer',
      route: { kind: 'account' },
    });
    expect(resolveAppRoute('/client/connexion')).toEqual({
      context: 'customer',
      route: { kind: 'login' },
    });
    expect(resolveAppRoute('/espace-client/inscription')).toEqual({
      context: 'customer',
      route: { kind: 'register' },
    });
    expect(resolveAppRoute('/conditions')).toEqual({
      context: 'legal',
      route: 'terms',
    });
    expect(resolveAppRoute('/confidentialite')).toEqual({
      context: 'legal',
      route: 'privacy',
    });
    expect(resolveAppRoute('/connexion')).toEqual({
      context: 'staff',
      route: 'login',
    });
    expect(resolveAppRoute('/bienvenue')).toEqual({
      context: 'staff',
      route: 'onboarding',
    });
    expect(resolveAppRoute('/administration')).toEqual({ context: 'platform-admin' });
    expect(resolveAppRoute('/administration/')).toEqual({ context: 'platform-admin' });
    expect(resolveAppRoute('/atelier')).toEqual({ context: 'erp' });
    expect(resolveAppRoute('/chemin-inconnu')).toEqual({ context: 'erp' });
  });
});

describe('resolveStaffReturnPath', () => {
  it('accepte uniquement les écrans ERP et renvoie leur chemin canonique', () => {
    expect(resolveStaffReturnPath('?retour=%2Fatelier')).toBe('/atelier');
    expect(resolveStaffReturnPath('?retour=/rapports')).toBe('/rapports');
    // L’alias est accepté mais canonicalisé vers la page d’accueil ERP.
    expect(resolveStaffReturnPath('?retour=%2Ftableau-de-bord')).toBe('/');
    expect(resolveStaffReturnPath('')).toBeNull();
    expect(resolveStaffReturnPath('?autre=1')).toBeNull();
  });

  it('refuse toute redirection ouverte ou hors ERP', () => {
    expect(resolveStaffReturnPath('?retour=https://evil.example')).toBeNull();
    expect(resolveStaffReturnPath('?retour=//evil.example')).toBeNull();
    expect(resolveStaffReturnPath('?retour=%2F%2Fevil.example')).toBeNull();
    expect(resolveStaffReturnPath('?retour=javascript:alert(1)')).toBeNull();
    expect(resolveStaffReturnPath('?retour=/connexion')).toBeNull();
    // La route admin n'est jamais choisie par un simple paramètre : la
    // connexion vérifie platform_admins avant d'y rediriger.
    expect(resolveStaffReturnPath('?retour=/administration')).toBeNull();
    expect(resolveStaffReturnPath('?retour=/client/connexion')).toBeNull();
    expect(resolveStaffReturnPath('?retour=/atelier?onglet=caisse')).toBeNull();
    expect(resolveStaffReturnPath('?retour=\\atelier')).toBeNull();
  });
});

describe('getStaffLoginRedirectPath', () => {
  it('conserve la destination métier hors page d’accueil', () => {
    expect(getStaffLoginRedirectPath('/atelier')).toBe(
      '/connexion?retour=%2Fatelier'
    );
    expect(getStaffLoginRedirectPath('/stocks/')).toBe(
      '/connexion?retour=%2Fstocks'
    );
  });

  it('reste simple pour l’accueil et les chemins inconnus', () => {
    expect(getStaffLoginRedirectPath('/')).toBe('/connexion');
    expect(getStaffLoginRedirectPath('/tableau-de-bord')).toBe('/connexion');
    expect(getStaffLoginRedirectPath('/chemin-inconnu')).toBe('/connexion');
  });
});
