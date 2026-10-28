import { describe, expect, it } from 'vitest';
import {
  isValidStaffEmail,
  mapStaffAuthError,
  validateStaffLogin,
  validateStaffRegistration,
} from '../../src/lib/staffAuth';

describe('staffAuth — validation des formulaires', () => {
  it('valide les e-mails avant la connexion', () => {
    expect(isValidStaffEmail('awa@example.ci')).toBe(true);
    expect(isValidStaffEmail('awa@')).toBe(false);
    expect(validateStaffLogin({ email: 'awa@', password: 'secret123' })).toContain('e-mail');
    expect(validateStaffLogin({ email: 'awa@example.ci', password: '' })).toContain('mot de passe');
    expect(validateStaffLogin({ email: 'awa@example.ci', password: 'secret123' })).toBeNull();
  });

  it('refuse une inscription avec nom incomplet ou mot de passe trop court', () => {
    const valid = {
      firstName: 'Awa',
      lastName: 'Koné',
      email: 'awa@example.ci',
      password: 'secret123',
      confirmPassword: 'secret123',
    };

    expect(validateStaffRegistration({ ...valid, firstName: 'A' })).toContain('prénom');
    expect(validateStaffRegistration({ ...valid, lastName: 'K' })).toContain('nom');
    expect(validateStaffRegistration({ ...valid, password: '123', confirmPassword: '123' })).toContain('8 caractères');
    expect(validateStaffRegistration({ ...valid, confirmPassword: 'different' })).toContain('correspondent');
    expect(validateStaffRegistration(valid)).toBeNull();
  });

  it('traduit les erreurs courantes sans exposer le message technique brut', () => {
    expect(mapStaffAuthError(new Error('Invalid login credentials'))).toContain('incorrect');
    expect(mapStaffAuthError(new Error('User already registered'))).toContain('existe déjà');
    expect(mapStaffAuthError(new Error('network request failed'))).toContain('injoignable');
    expect(mapStaffAuthError(new Error('internal exception details'))).toContain('Réessayez');
    expect(mapStaffAuthError(new Error('internal exception details'))).not.toContain('internal exception details');
  });
});
