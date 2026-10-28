import { describe, expect, it } from 'vitest';
import {
  STAFF_ONBOARDING_PATH,
  getPasswordStrength,
  mapStaffAuthError,
  parseFeeInput,
  parseLegalRoute,
  parseStaffRoute,
  resolveStaffPostAuthPath,
  validateOnboardingInput,
  validateStaffRegistration,
  type OnboardingFormInput,
} from '../../src/lib/staffAuth';
import type { RemoteMembership } from '../../src/lib/supabaseOrders';

const membership = (
  overrides: Partial<RemoteMembership> = {}
): RemoteMembership => ({
  id: 'membership-1',
  organization_id: 'org-1',
  shop_id: 'shop-1',
  role: 'cashier',
  status: 'active',
  ...overrides,
});

const validOnboarding: OnboardingFormInput = {
  organizationName: 'Pressing Éclat',
  shopName: 'Éclat Cocody',
  city: 'Abidjan',
  address: 'Cocody, rue fictive',
  phoneDisplay: '07 00 00 00 00',
  shopEmail: '',
  tagline: '',
  pickupFeeXof: '1000',
  deliveryFeeXof: '1 500',
};

describe('staffAuth routes', () => {
  it('reconnaît les trois pages publiques du personnel', () => {
    expect(parseStaffRoute('/connexion')).toBe('login');
    expect(parseStaffRoute('/inscription')).toBe('register');
    expect(parseStaffRoute('/bienvenue')).toBe('onboarding');
  });

  it('tolère le slash final et ignore les autres chemins', () => {
    expect(parseStaffRoute('/bienvenue/')).toBe('onboarding');
    expect(parseStaffRoute('/')).toBeNull();
    expect(parseStaffRoute('/client/connexion')).toBeNull();
    expect(parseStaffRoute('/connexion/extra')).toBeNull();
  });
});

describe('resolveStaffPostAuthPath', () => {
  it('ouvre l’ERP avec un membership actif', () => {
    expect(resolveStaffPostAuthPath([membership()])).toBe('/');
  });

  it('dirige vers l’onboarding sans aucun rattachement actif', () => {
    expect(resolveStaffPostAuthPath([])).toBe(STAFF_ONBOARDING_PATH);
    expect(resolveStaffPostAuthPath([membership({ status: 'disabled' })])).toBe(
      STAFF_ONBOARDING_PATH
    );
    expect(resolveStaffPostAuthPath([membership({ role: 'customer' })])).toBe(
      STAFF_ONBOARDING_PATH
    );
  });
});

describe('validateStaffRegistration', () => {
  const valid = {
    fullName: 'Awa Traoré',
    email: 'awa@exemple.ci',
    password: 'mot-de-passe-solide',
    confirmPassword: 'mot-de-passe-solide',
    acceptTerms: true,
  };

  it('accepte une inscription complète', () => {
    expect(validateStaffRegistration(valid)).toBeNull();
  });

  it('rejette nom, e-mail, longueur et confirmation invalides', () => {
    expect(validateStaffRegistration({ ...valid, fullName: 'A' })).toMatch(
      /nom complet/i
    );
    expect(validateStaffRegistration({ ...valid, email: 'awa' })).toMatch(
      /e-mail valide/i
    );
    expect(
      validateStaffRegistration({ ...valid, password: 'court', confirmPassword: 'court' })
    ).toMatch(/au moins 8/i);
    expect(
      validateStaffRegistration({ ...valid, confirmPassword: 'autre-mot-de-passe' })
    ).toMatch(/ne correspondent pas/i);
  });

  it('exige l’acceptation des conditions d’utilisation', () => {
    expect(validateStaffRegistration({ ...valid, acceptTerms: false })).toMatch(
      /accepter les conditions d’utilisation/i
    );
  });
});

describe('getPasswordStrength', () => {
  it('classe le vide et les mots de passe courts comme très faibles à faibles', () => {
    expect(getPasswordStrength('')).toEqual({ score: 0, label: 'Très faible' });
    // Même varié, un mot de passe de moins de 8 caractères reste « Faible ».
    expect(getPasswordStrength('Ab1!xyz').score).toBe(1);
    expect(getPasswordStrength('abcdefgh')).toEqual({ score: 1, label: 'Faible' });
  });

  it('récompense longueur et variété des caractères', () => {
    expect(getPasswordStrength('Motdepasse1')).toEqual({ score: 3, label: 'Fort' });
    expect(getPasswordStrength('Motdepasse1!solide')).toEqual({
      score: 4,
      label: 'Très fort',
    });
    expect(getPasswordStrength('motdepasse-solide').label).toBe('Fort');
  });
});

describe('parseLegalRoute', () => {
  it('reconnaît les deux pages légales publiques', () => {
    expect(parseLegalRoute('/conditions')).toBe('terms');
    expect(parseLegalRoute('/confidentialite')).toBe('privacy');
    expect(parseLegalRoute('/conditions/')).toBe('terms');
  });

  it('ignore les autres chemins', () => {
    expect(parseLegalRoute('/connexion')).toBeNull();
    expect(parseLegalRoute('/')).toBeNull();
    expect(parseLegalRoute('/conditions/generales')).toBeNull();
  });
});

describe('frais et onboarding', () => {
  it('lit les montants FCFA saisis avec espaces', () => {
    expect(parseFeeInput('1000')).toBe(1000);
    expect(parseFeeInput('1 500')).toBe(1500);
    expect(parseFeeInput('0')).toBe(0);
    expect(parseFeeInput('')).toBeNull();
    expect(parseFeeInput('-500')).toBeNull();
    expect(parseFeeInput('12,5')).toBeNull();
  });

  it('accepte un onboarding valide', () => {
    expect(validateOnboardingInput(validOnboarding)).toBeNull();
  });

  it('rejette noms absents, e-mail d’agence et frais invalides', () => {
    expect(
      validateOnboardingInput({ ...validOnboarding, organizationName: ' ' })
    ).toMatch(/organisation/i);
    expect(
      validateOnboardingInput({ ...validOnboarding, shopName: 'E' })
    ).toMatch(/agence/i);
    expect(
      validateOnboardingInput({ ...validOnboarding, shopEmail: 'contact' })
    ).toMatch(/e-mail de l’agence/i);
    expect(
      validateOnboardingInput({ ...validOnboarding, pickupFeeXof: 'gratuit' })
    ).toMatch(/frais de ramassage/i);
    expect(
      validateOnboardingInput({ ...validOnboarding, deliveryFeeXof: '200000' })
    ).toMatch(/frais de livraison/i);
  });
});

describe('mapStaffAuthError', () => {
  it('formule l’inscription fermée côté serveur sans parler des clients', () => {
    const message = mapStaffAuthError(new Error('Signups not allowed for this instance'));
    expect(message).toMatch(/inscriptions ne sont pas encore ouvertes/i);
    expect(message).not.toMatch(/clients/i);
  });

  it('réutilise les formulations communes pour les identifiants invalides', () => {
    expect(mapStaffAuthError(new Error('Invalid login credentials'))).toBe(
      'E-mail ou mot de passe incorrect.'
    );
  });
});
