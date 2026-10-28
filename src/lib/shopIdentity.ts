import type { ShopSettings } from '../types';
import type { WorkspaceScope } from './workspaceScope';

/**
 * Identité visible du pressing : nom affiché et logo.
 *
 * Le logo est conservé sous forme de data URL (PNG/WebP redimensionné côté
 * navigateur) : cela respecte la politique de sécurité `img-src 'self' data:
 * blob:` et fonctionne hors ligne, sans dépendre d'un bucket distant.
 */

/** Taille maximale acceptée avant redimensionnement (2 Mo). */
export const MAX_LOGO_FILE_BYTES = 2 * 1024 * 1024;

/** Types acceptés. `image/svg+xml` est volontairement exclu (scripts embarqués). */
export const ACCEPTED_LOGO_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

/** Côté du carré vers lequel le logo est redimensionné. */
export const LOGO_TARGET_SIZE = 256;

/** Limite de sécurité sur la data URL stockée (~350 Ko de base64). */
export const MAX_LOGO_DATA_URL_LENGTH = 350_000;

type LogoFileMeta = Pick<File, 'name' | 'type' | 'size'>;

/**
 * Règles communes à toutes les images téléversées (logo, photo de vêtement).
 * Le libellé ne sert qu'au message d'erreur.
 */
const validateImageBasics = (file: LogoFileMeta, noun: 'logo' | 'image'): string | null => {
  if (!file || typeof file.size !== 'number') {
    return 'Choisissez un fichier image.';
  }
  if (file.size === 0) {
    return 'Ce fichier est vide.';
  }
  if (file.size > MAX_LOGO_FILE_BYTES) {
    return `Le ${noun} ne doit pas dépasser 2 Mo.`;
  }
  if (!file.type) {
    return 'Impossible de déterminer le format de cette image.';
  }
  if (file.type === 'image/svg+xml') {
    return 'Les fichiers SVG ne sont pas acceptés. Utilisez un PNG, un JPEG ou un WebP.';
  }
  if (!(ACCEPTED_LOGO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Format non pris en charge. Utilisez un PNG, un JPEG ou un WebP.';
  }
  return null;
};

/**
 * Valide un fichier de logo avant lecture. Retourne un message en français ou
 * `null` si le fichier est acceptable.
 */
export const validateLogoFile = (file: LogoFileMeta): string | null =>
  validateImageBasics(file, 'logo');

/** Mêmes règles, message neutre, pour la photo d'un vêtement du catalogue. */
export const validateImageFile = (file: LogoFileMeta): string | null =>
  validateImageBasics(file, 'image');

/**
 * Vérifie qu'une valeur stockée est bien un logo utilisable.
 *
 * Une sauvegarde locale peut être corrompue ou contenir une URL distante
 * (bloquée par la CSP) : dans ce cas le logo est simplement ignoré.
 */
export const isValidImageDataUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  if (value.length > MAX_LOGO_DATA_URL_LENGTH) return false;
  return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
};

/** Alias historique conservé pour le logo de l'établissement. */
export const isValidLogoDataUrl = isValidImageDataUrl;

/** Initiales de secours quand aucun logo n'est défini : « Éclat Cocody » → « ÉC ». */
export const getBrandInitials = (name: string): string => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) return 'P';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

/**
 * Nom de l'établissement affiché dans l'interface.
 *
 * Priorité : nom enregistré dans les Paramètres → nom réel de l'agence puis de
 * l'organisation (Supabase) → libellé neutre. Le nom du produit n'est utilisé
 * qu'en démonstration locale, jamais sur l'espace d'un vrai pressing.
 */
export const resolveShopDisplayName = (
  shopSettings: Pick<ShopSettings, 'name'>,
  workspace: WorkspaceScope
): string => {
  const saved = shopSettings.name?.trim();
  if (saved) return saved;
  const shop = workspace.shopName?.trim();
  if (shop) return shop;
  const organization = workspace.organizationName?.trim();
  if (organization) return organization;
  return workspace.mode === 'live' ? 'Mon pressing' : 'PressingPro CI (démonstration)';
};

/** Titre d'onglet du navigateur, construit sur le nom réel du pressing. */
export const buildBrandedTitle = (pageLabel: string, brandName: string): string => {
  const page = pageLabel.trim();
  const brand = brandName.trim();
  if (!page) return brand;
  if (!brand) return page;
  return `${page} — ${brand}`;
};
