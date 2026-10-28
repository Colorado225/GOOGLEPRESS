/**
 * Règles pures de l'espace client : routes, téléphone, validation des
 * formulaires et messages d'erreur Supabase Auth en français.
 */

export const CUSTOMER_HOME_PATH = '/client';
export const CUSTOMER_LOGIN_PATH = '/client/connexion';
export const CUSTOMER_REGISTER_PATH = '/client/inscription';
export const CUSTOMER_PASSWORD_PATH = '/client/nouveau-mot-de-passe';

export type CustomerRoute =
  | { kind: 'account' }
  | { kind: 'login' }
  | { kind: 'register' }
  | { kind: 'password' }
  | { kind: 'not-found' };

const trimTrailingSlash = (pathname: string): string =>
  pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

export const isCustomerPath = (pathname: string): boolean => {
  const normalized = trimTrailingSlash(pathname || '/');
  return (
    normalized === CUSTOMER_HOME_PATH ||
    normalized.startsWith(`${CUSTOMER_HOME_PATH}/`) ||
    normalized === '/espace-client' ||
    normalized.startsWith('/espace-client/')
  );
};

export const getCanonicalCustomerPath = (pathname: string): string => {
  const normalized = trimTrailingSlash(pathname || '/');
  if (normalized === '/espace-client') return CUSTOMER_HOME_PATH;
  if (normalized.startsWith('/espace-client/')) {
    return `${CUSTOMER_HOME_PATH}${normalized.slice('/espace-client'.length)}`;
  }
  return normalized;
};

export const parseCustomerRoute = (pathname: string): CustomerRoute => {
  const normalized = getCanonicalCustomerPath(pathname);

  if (normalized === CUSTOMER_HOME_PATH) return { kind: 'account' };
  if (normalized === CUSTOMER_LOGIN_PATH) return { kind: 'login' };
  if (normalized === CUSTOMER_REGISTER_PATH) return { kind: 'register' };
  if (normalized === CUSTOMER_PASSWORD_PATH) return { kind: 'password' };
  return { kind: 'not-found' };
};

export const getCustomerRouteTitle = (route: CustomerRoute): string => {
  switch (route.kind) {
    case 'login':
      return 'Connexion — Espace client PressingPro CI';
    case 'register':
      return 'Inscription — Espace client PressingPro CI';
    case 'password':
      return 'Nouveau mot de passe — PressingPro CI';
    case 'account':
      return 'Mon espace — PressingPro CI';
    case 'not-found':
      return 'Page introuvable — PressingPro CI';
  }
};

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

/**
 * Normalise un numéro saisi par un client.
 *
 * Les numéros ivoiriens à 10 chiffres conservent leur zéro initial après
 * l'indicatif : `07 00 00 03 01` devient `+2250700000301`, conformément aux
 * données déjà présentes dans le socle Supabase.
 */
export const normalizePhoneToE164 = (raw: string): string | null => {
  const compact = raw.trim().replace(/[\s().-]/g, '');
  if (!compact) return null;

  let candidate: string | null = null;
  if (compact.startsWith('+')) {
    candidate = compact;
  } else if (compact.startsWith('00')) {
    candidate = `+${compact.slice(2)}`;
  } else if (/^225\d{10}$/.test(compact)) {
    candidate = `+${compact}`;
  } else if (/^0\d{9}$/.test(compact)) {
    candidate = `+225${compact}`;
  }

  return candidate && E164_PATTERN.test(candidate) ? candidate : null;
};

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export interface CustomerLoginInput {
  email: string;
  password: string;
}

export interface CustomerRegistrationInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  confirmsDepositPhone: boolean;
}

export const validateCustomerLogin = (
  input: CustomerLoginInput
): string | null => {
  if (!isValidEmail(input.email)) return 'Saisissez une adresse e-mail valide.';
  if (!input.password) return 'Saisissez votre mot de passe.';
  return null;
};

export const validateCustomerRegistration = (
  input: CustomerRegistrationInput
): string | null => {
  if (input.fullName.trim().replace(/\s+/g, ' ').length < 2) {
    return 'Saisissez votre nom complet.';
  }
  if (!normalizePhoneToE164(input.phone)) {
    return 'Saisissez un numéro valide, par exemple 07 00 00 00 00 ou +2250700000000.';
  }
  if (!isValidEmail(input.email)) return 'Saisissez une adresse e-mail valide.';
  if (input.password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  if (input.password.length > 72) {
    return 'Le mot de passe ne peut pas dépasser 72 caractères.';
  }
  if (input.password !== input.confirmPassword) {
    return 'Les deux mots de passe ne correspondent pas.';
  }
  if (!input.confirmsDepositPhone) {
    return 'Confirmez que ce numéro est celui utilisé pour vos dépôts au pressing.';
  }
  return null;
};

export const validateNewPassword = (
  password: string,
  confirmPassword: string
): string | null => {
  if (password.length < 8) return 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
  if (password.length > 72) return 'Le nouveau mot de passe ne peut pas dépasser 72 caractères.';
  if (password !== confirmPassword) return 'Les deux mots de passe ne correspondent pas.';
  return null;
};

export const getMetadataString = (
  metadata: Record<string, unknown> | null | undefined,
  keys: readonly string[]
): string | null => {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

export const mapSupabaseAuthError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  if (!normalized) return 'Une erreur d’authentification est survenue. Réessayez.';
  if (normalized.includes('invalid login credentials')) {
    return 'E-mail ou mot de passe incorrect.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirmez d’abord votre adresse e-mail depuis le message de confirmation, puis reconnectez-vous.';
  }
  if (
    normalized.includes('signups not allowed') ||
    normalized.includes('signup is disabled') ||
    normalized.includes('signups are disabled')
  ) {
    return 'Les inscriptions clients ne sont pas encore ouvertes par l’administrateur du service.';
  }
  if (
    normalized.includes('user already registered') ||
    normalized.includes('already been registered') ||
    normalized.includes('already exists')
  ) {
    return 'Un compte semble déjà exister avec cette adresse. Essayez de vous connecter ou de réinitialiser votre mot de passe.';
  }
  if (normalized.includes('password should be at least')) {
    return 'Le mot de passe ne respecte pas la longueur minimale demandée par le service.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Trop de tentatives ou d’e-mails en peu de temps. Attendez quelques minutes avant de réessayer.';
  }
  if (
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('failed to fetch')
  ) {
    return 'Le service d’authentification est injoignable. Vérifiez votre connexion puis réessayez.';
  }
  if (normalized.includes('invalid email')) return 'Cette adresse e-mail est invalide.';
  if (normalized.includes('token') && normalized.includes('expired')) {
    return 'Ce lien a expiré. Demandez un nouveau lien depuis la page de connexion.';
  }

  return message;
};
