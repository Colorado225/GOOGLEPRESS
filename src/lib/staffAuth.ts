export interface StaffLoginInput {
  email: string;
  password: string;
}

export interface StaffRegistrationInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const isValidStaffEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const validateStaffLogin = (input: StaffLoginInput): string | null => {
  if (!isValidStaffEmail(input.email)) {
    return 'Saisissez une adresse e-mail valide.';
  }
  if (!input.password) {
    return 'Saisissez votre mot de passe.';
  }
  return null;
};

export const validateStaffRegistration = (
  input: StaffRegistrationInput
): string | null => {
  const firstName = input.firstName.trim().replace(/\s+/g, ' ');
  const lastName = input.lastName.trim().replace(/\s+/g, ' ');

  if (firstName.length < 2) return 'Saisissez votre prénom.';
  if (lastName.length < 2) return 'Saisissez votre nom.';
  if (!isValidStaffEmail(input.email)) {
    return 'Saisissez une adresse e-mail valide.';
  }
  if (input.password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  if (input.password.length > 72) {
    return 'Le mot de passe ne peut pas dépasser 72 caractères.';
  }
  if (input.password !== input.confirmPassword) {
    return 'Les deux mots de passe ne correspondent pas.';
  }
  return null;
};

/** Traduit les erreurs courantes sans exposer les détails techniques au personnel. */
export const mapStaffAuthError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid credentials')
  ) {
    return 'Adresse e-mail ou mot de passe incorrect.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirmez votre adresse e-mail depuis le message reçu, puis reconnectez-vous.';
  }
  if (
    normalized.includes('user already registered') ||
    normalized.includes('already been registered') ||
    normalized.includes('already exists')
  ) {
    return 'Un compte existe déjà avec cette adresse. Essayez de vous connecter.';
  }
  if (normalized.includes('password should be at least')) {
    return 'Le mot de passe ne respecte pas la longueur minimale exigée.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Trop de tentatives. Attendez quelques minutes avant de réessayer.';
  }
  if (
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('failed to fetch')
  ) {
    return 'Le service de connexion est injoignable. Vérifiez votre connexion Internet.';
  }
  return 'Une erreur est survenue. Réessayez dans quelques instants.';
};
