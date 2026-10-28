import { isValidEmail, mapSupabaseAuthError } from './customerAuth';
import { getActiveStaffMemberships } from './staffAccess';
import type { RemoteMembership } from './supabaseOrders';

export const STAFF_LOGIN_PATH = '/connexion';
export const STAFF_REGISTER_PATH = '/inscription';
export const STAFF_ONBOARDING_PATH = '/bienvenue';
export const TERMS_OF_USE_PATH = '/conditions';
export const PRIVACY_POLICY_PATH = '/confidentialite';

export type StaffRoute = 'login' | 'register' | 'onboarding';
export type LegalRoute = 'terms' | 'privacy';

const normalizePathname = (pathname: string): string => {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
};

/**
 * Pages publiques d'accès au personnel. Elles vivent hors de `AppProvider`
 * (comme l'espace client) : aucun visiteur ne doit charger l'état local de
 * l'ERP avant d'être authentifié et rattaché à un pressing.
 */
export const parseStaffRoute = (pathname: string): StaffRoute | null => {
  switch (normalizePathname(pathname)) {
    case STAFF_LOGIN_PATH:
      return 'login';
    case STAFF_REGISTER_PATH:
      return 'register';
    case STAFF_ONBOARDING_PATH:
      return 'onboarding';
    default:
      return null;
  }
};

/** Pages d'information légale publiques, liées depuis l'inscription. */
export const parseLegalRoute = (pathname: string): LegalRoute | null => {
  switch (normalizePathname(pathname)) {
    case TERMS_OF_USE_PATH:
      return 'terms';
    case PRIVACY_POLICY_PATH:
      return 'privacy';
    default:
      return null;
  }
};

/**
 * Destination après une connexion réussie : l'ERP si le compte possède au
 * moins un rôle actif, sinon l'onboarding qui permet à un propriétaire de
 * créer son organisation (un employé sans rattachement y verra les consignes
 * adaptées). La RLS et les RPC restent l'autorité serveur.
 */
export const resolveStaffPostAuthPath = (
  memberships: readonly RemoteMembership[]
): string =>
  getActiveStaffMemberships(memberships).length > 0 ? '/' : STAFF_ONBOARDING_PATH;

export interface StaffRegistrationInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export const validateStaffRegistration = (
  input: StaffRegistrationInput
): string | null => {
  if (input.fullName.trim().replace(/\s+/g, ' ').length < 2) {
    return 'Saisissez votre nom complet.';
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
  if (!input.acceptTerms) {
    return 'Vous devez accepter les conditions d’utilisation et la politique de confidentialité pour créer votre compte.';
  }
  return null;
};

export interface PasswordStrength {
  /** 0 (vide/très faible) à 4 (très fort) ; alimente une jauge à 4 segments. */
  score: number;
  label: string;
}

const PASSWORD_STRENGTH_LABELS = [
  'Très faible',
  'Faible',
  'Moyen',
  'Fort',
  'Très fort',
] as const;

/**
 * Estimation d'affichage de la robustesse d'un mot de passe. Elle guide
 * l'utilisateur pendant la saisie ; la règle contraignante reste la longueur
 * minimale validée ici et côté Supabase Auth.
 */
export const getPasswordStrength = (password: string): PasswordStrength => {
  if (!password) return { score: 0, label: PASSWORD_STRENGTH_LABELS[0] };

  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-zà-ÿ]/.test(password) && /[A-ZÀ-Ÿ]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-zÀ-ÿ0-9]/.test(password)) points += 1;

  let score = points <= 1 ? 1 : points === 2 ? 2 : points === 3 ? 3 : 4;
  // Un mot de passe court reste faible, même s'il mélange les caractères.
  if (password.length < 8) score = Math.min(score, 1);

  return { score, label: PASSWORD_STRENGTH_LABELS[score] };
};

/**
 * Erreurs d'authentification du personnel : même base que l'espace client,
 * avec une formulation adaptée quand les inscriptions sont fermées côté
 * serveur (réglage du projet Supabase, jamais contourné par le navigateur).
 */
export const mapStaffAuthError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  if (
    normalized.includes('signups not allowed') ||
    normalized.includes('signup is disabled') ||
    normalized.includes('signups are disabled')
  ) {
    return 'Les inscriptions ne sont pas encore ouvertes par l’administrateur du service. Réessayez plus tard ou contactez le support PressingPro CI.';
  }

  return mapSupabaseAuthError(error);
};

export interface OnboardingFormInput {
  organizationName: string;
  shopName: string;
  city: string;
  address: string;
  phoneDisplay: string;
  shopEmail: string;
  tagline: string;
  pickupFeeXof: string;
  deliveryFeeXof: string;
}

/** Lit un montant FCFA saisi en texte libre ; retourne null si invalide. */
export const parseFeeInput = (value: string): number | null => {
  const digits = value.replace(/[\s.]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const amount = Number.parseInt(digits, 10);
  return Number.isSafeInteger(amount) ? amount : null;
};

const FEE_MAX_XOF = 100000;

/**
 * Validation d'affichage du formulaire d'onboarding. La RPC
 * `create_my_organization` refait tous ces contrôles côté serveur.
 */
export const validateOnboardingInput = (
  input: OnboardingFormInput
): string | null => {
  if (input.organizationName.trim().length < 2) {
    return 'Saisissez le nom de votre organisation (raison sociale ou nom de votre réseau).';
  }
  if (input.shopName.trim().length < 2) {
    return 'Saisissez le nom de votre agence (le pressing tel que vos clients le connaissent).';
  }
  if (input.shopEmail.trim() && !isValidEmail(input.shopEmail)) {
    return 'L’adresse e-mail de l’agence est invalide.';
  }

  const pickupFee = parseFeeInput(input.pickupFeeXof);
  if (pickupFee === null || pickupFee > FEE_MAX_XOF) {
    return 'Les frais de ramassage doivent être un montant en FCFA entre 0 et 100 000.';
  }
  const deliveryFee = parseFeeInput(input.deliveryFeeXof);
  if (deliveryFee === null || deliveryFee > FEE_MAX_XOF) {
    return 'Les frais de livraison doivent être un montant en FCFA entre 0 et 100 000.';
  }

  return null;
};
