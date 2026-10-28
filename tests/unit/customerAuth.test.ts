import { describe, expect, it } from 'vitest';
import { getPasswordStrength } from '../../src/lib/passwordStrength';
import {
  getCanonicalCustomerPath,
  getCustomerRouteTitle,
  getMetadataString,
  isCustomerPath,
  isValidEmail,
  mapSupabaseAuthError,
  normalizePhoneToE164,
  parseCustomerRoute,
  validateCustomerLogin,
  validateCustomerRegistration,
  validateNewPassword,
} from '../../src/lib/customerAuth';

describe('customerAuth routes', () => {
  it('reconnaît les pages publiques de l’espace client', () => {
    expect(parseCustomerRoute('/client')).toEqual({ kind: 'account' });
    expect(parseCustomerRoute('/client/connexion/')).toEqual({ kind: 'login' });
    expect(parseCustomerRoute('/client/inscription')).toEqual({ kind: 'register' });
    expect(parseCustomerRoute('/client/nouveau-mot-de-passe')).toEqual({ kind: 'password' });
    expect(parseCustomerRoute('/client/inconnue')).toEqual({ kind: 'not-found' });
    expect(parseCustomerRoute('/espace-client/connexion')).toEqual({ kind: 'login' });
    expect(getCanonicalCustomerPath('/espace-client/inscription/')).toBe(
      '/client/inscription'
    );
    expect(isCustomerPath('/espace-client')).toBe(true);
    expect(isCustomerPath('/commandes')).toBe(false);
  });

  it('fournit un titre de document pour chaque page', () => {
    expect(getCustomerRouteTitle({ kind: 'login' })).toContain('Connexion');
    expect(getCustomerRouteTitle({ kind: 'register' })).toContain('Inscription');
    expect(getCustomerRouteTitle({ kind: 'account' })).toContain('Mon espace');
  });
});

describe('customerAuth téléphone et e-mail', () => {
  it('normalise les numéros ivoiriens sans retirer le zéro initial', () => {
    expect(normalizePhoneToE164('07 00 00 03 01')).toBe('+2250700000301');
    expect(normalizePhoneToE164('2250700000301')).toBe('+2250700000301');
    expect(normalizePhoneToE164('+225 07 00 00 03 01')).toBe('+2250700000301');
    expect(normalizePhoneToE164('002250700000301')).toBe('+2250700000301');
  });

  it('refuse les numéros et e-mails manifestement invalides', () => {
    expect(normalizePhoneToE164('0700')).toBeNull();
    expect(normalizePhoneToE164('téléphone')).toBeNull();
    expect(isValidEmail('cliente@exemple.com')).toBe(true);
    expect(isValidEmail('cliente@exemple')).toBe(false);
  });
});

describe('customerAuth validation des formulaires', () => {
  it('valide la connexion', () => {
    expect(validateCustomerLogin({ email: 'cliente@exemple.com', password: 'secret' })).toBeNull();
    expect(validateCustomerLogin({ email: 'invalide', password: 'secret' })).toMatch(/e-mail valide/);
    expect(validateCustomerLogin({ email: 'cliente@exemple.com', password: '' })).toMatch(/mot de passe/);
  });

  it('valide une inscription complète et ses erreurs principales', () => {
    const valid = {
      fullName: 'Awa Koné',
      phone: '07 00 00 03 01',
      email: 'cliente@exemple.com',
      password: 'mot-de-passe-solide',
      confirmPassword: 'mot-de-passe-solide',
      confirmsDepositPhone: true,
    };

    expect(validateCustomerRegistration(valid)).toBeNull();
    expect(validateCustomerRegistration({ ...valid, fullName: 'A' })).toMatch(/nom complet/);
    expect(validateCustomerRegistration({ ...valid, phone: '123' })).toMatch(/numéro valide/);
    expect(validateCustomerRegistration({ ...valid, password: 'court', confirmPassword: 'court' })).toMatch(/au moins 8/);
    expect(validateCustomerRegistration({ ...valid, confirmPassword: 'autre' })).toMatch(/ne correspondent pas/);
    expect(validateCustomerRegistration({ ...valid, confirmsDepositPhone: false })).toMatch(/Confirmez/);
  });

  it('valide le nouveau mot de passe', () => {
    expect(validateNewPassword('nouveau-secret', 'nouveau-secret')).toBeNull();
    expect(validateNewPassword('court', 'court')).toMatch(/au moins 8/);
    expect(validateNewPassword('nouveau-secret', 'autre-secret')).toMatch(/ne correspondent pas/);
  });
});

describe('customerAuth erreurs et métadonnées', () => {
  it('traduit les erreurs Supabase importantes sans exposer de détail technique inutile', () => {
    expect(mapSupabaseAuthError(new Error('Invalid login credentials'))).toBe(
      'E-mail ou mot de passe incorrect.'
    );
    expect(mapSupabaseAuthError(new Error('Signups not allowed for this instance'))).toMatch(
      /pas encore ouvertes/
    );
    expect(mapSupabaseAuthError(new Error('Email not confirmed'))).toMatch(/Confirmez d’abord/);
    expect(mapSupabaseAuthError(new Error('Failed to fetch'))).toMatch(/injoignable/);
  });

  it('lit la première métadonnée textuelle non vide', () => {
    expect(
      getMetadataString({ name: '  Awa Koné ', phone_e164: '+2250700000301' }, ['full_name', 'name'])
    ).toBe('Awa Koné');
    expect(getMetadataString({ full_name: 42 }, ['full_name'])).toBeNull();
  });
});

describe('passwordStrength partagé', () => {
  it('est la même jauge pour les deux espaces', () => {
    expect(getPasswordStrength('')).toEqual({ score: 0, label: 'Très faible' });
    expect(getPasswordStrength('abcdefgh')).toEqual({ score: 1, label: 'Faible' });
    expect(getPasswordStrength('Motdepasse1')).toEqual({ score: 3, label: 'Fort' });
    expect(getPasswordStrength('Motdepasse1!solide')).toEqual({
      score: 4,
      label: 'Très fort',
    });
  });

  it('ne dépasse jamais l’échelle de quatre segments', () => {
    const score = getPasswordStrength('Une-Phrase-Très-Longue-2026!').score;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(4);
  });
});
