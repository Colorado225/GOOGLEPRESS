/**
 * Estimation d'affichage de la robustesse d'un mot de passe.
 *
 * Module neutre partagé par les pages d'accès du personnel et de l'espace
 * client : il ne contient aucune règle d'authentification, seulement un
 * indicateur visuel (0 à 4) qui accompagne la saisie. La règle contraignante
 * reste la longueur minimale validée côté formulaire et côté Supabase Auth.
 */

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
