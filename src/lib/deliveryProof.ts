import type { DeliveryProof, DeliveryProofSettings } from '../types';
import { isValidImageDataUrl } from './shopIdentity';

/**
 * Preuve de remise : règles pures, testables sans navigateur.
 *
 * Le dépôt suit une règle simple : les calculs et validations métier vivent
 * dans `src/lib`, les composants ne font qu'afficher et collecter. C'est ce qui
 * permet de tester ici (Vitest) ce qu'un coursier peut confirmer — photo,
 * signature, code — sans monter de navigateur ni de caméra.
 */

/** Longueur imposée du code de remise. */
export const DELIVERY_CODE_LENGTH = 4;

/** Plafond d'une photo de remise (même limite que les photos de vêtements). */
export const MAX_PROOF_PHOTO_LENGTH = 350_000;

/** Plafond d'une signature : un tracé simple, pas une image. */
export const MAX_PROOF_SIGNATURE_LENGTH = 40_000;

export const MAX_RECEIVER_NAME_LENGTH = 60;
export const MAX_PROOF_NOTE_LENGTH = 300;

/**
 * Par défaut, aucune preuve n'est exigée : activer une obligation sans que le
 * pressing l'ait demandée bloquerait des livraisons en cours. Le propriétaire
 * choisit dans Paramètres ce qu'il veut rendre obligatoire.
 */
export const DEFAULT_DELIVERY_PROOF_SETTINGS: DeliveryProofSettings = {
  requirePhoto: false,
  requireSignature: false,
  requireCode: false,
};

/** Lecture tolérante d'un réglage stocké (valeur absente ou corrompue). */
export const normalizeDeliveryProofSettings = (
  value?: Partial<DeliveryProofSettings> | null
): DeliveryProofSettings => ({
  requirePhoto: value?.requirePhoto === true,
  requireSignature: value?.requireSignature === true,
  requireCode: value?.requireCode === true,
});

export const hasDeliveryProofRequirements = (settings: DeliveryProofSettings): boolean =>
  settings.requirePhoto || settings.requireSignature || settings.requireCode;

const isImageDataUrlUpTo = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' &&
  value.length <= maxLength &&
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);

/** Un code de remise valide : exactement quatre chiffres, zéros de tête compris. */
export const isDeliveryCode = (value: unknown): value is string =>
  typeof value === 'string' && new RegExp(`^\\d{${DELIVERY_CODE_LENGTH}}$`).test(value);

/**
 * Code à 4 chiffres, zéros de tête conservés (« 0042 » reste « 0042 »).
 * `random` est injectable pour rendre les tests déterministes.
 */
export const generateDeliveryCode = (random: () => number = Math.random): string => {
  const raw = Math.floor(Math.max(0, Math.min(0.999_999, random())) * 10_000);
  return String(raw).padStart(DELIVERY_CODE_LENGTH, '0');
};

/** Saisie brute du formulaire de confirmation de livraison. */
export interface DeliveryProofDraft {
  photoDataUrl?: string | null;
  signatureDataUrl?: string | null;
  codeEntered?: string;
  receiverName?: string;
  note?: string;
}

const cleanText = (value: string | undefined, maxLength: number): string | undefined => {
  const trimmed = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
};

/**
 * Contrôle la saisie avant enregistrement.
 *
 * Deux familles d'erreurs : les valeurs fournies mais inutilisables (photo
 * illisible, code mal formé…) et les preuves manquantes alors qu'elles sont
 * exigées par les Paramètres. Le code n'est exigé que si la tournée possède
 * vraiment un code : les livraisons créées avant cette fonctionnalité n'en ont
 * pas, et bloquer le coursier serait injuste.
 */
export const validateDeliveryProofDraft = (
  draft: DeliveryProofDraft | null | undefined,
  options: { settings: DeliveryProofSettings; expectedCode?: string }
): string[] => {
  const errors: string[] = [];
  const photo = draft?.photoDataUrl ?? undefined;
  const signature = draft?.signatureDataUrl ?? undefined;
  const code = (draft?.codeEntered ?? '').trim();
  const receiverName = (draft?.receiverName ?? '').trim();
  const note = (draft?.note ?? '').trim();

  if (photo && !isImageDataUrlUpTo(photo, MAX_PROOF_PHOTO_LENGTH)) {
    errors.push(
      'La photo de remise est illisible ou trop lourde (350 000 caractères maximum après compression).'
    );
  }
  if (signature && !isImageDataUrlUpTo(signature, MAX_PROOF_SIGNATURE_LENGTH)) {
    errors.push('La signature est illisible ou trop lourde. Effacez-la et faites signer à nouveau.');
  }
  if (code && !isDeliveryCode(code)) {
    errors.push(`Le code de remise doit contenir exactement ${DELIVERY_CODE_LENGTH} chiffres.`);
  }
  if (receiverName.length > MAX_RECEIVER_NAME_LENGTH) {
    errors.push(`Le nom du réceptionnaire ne doit pas dépasser ${MAX_RECEIVER_NAME_LENGTH} caractères.`);
  }
  if (note.length > MAX_PROOF_NOTE_LENGTH) {
    errors.push(`La note de remise ne doit pas dépasser ${MAX_PROOF_NOTE_LENGTH} caractères.`);
  }

  const expectedCode = options.expectedCode?.trim();
  if (options.settings.requirePhoto && !photo) {
    errors.push('Ajoutez la photo du linge remis.');
  }
  if (options.settings.requireSignature && !signature) {
    errors.push('Faites signer le réceptionnaire avant de confirmer.');
  }
  if (options.settings.requireCode && expectedCode) {
    if (!code) {
      errors.push('Saisissez le code de remise à 4 chiffres donné par le client.');
    } else if (isDeliveryCode(code) && code !== expectedCode) {
      errors.push('Le code de remise ne correspond pas à celui de cette livraison.');
    }
  }

  return errors;
};

/**
 * Construit la preuve à enregistrer, ou `null` si le coursier n'a rien fourni
 * (tournée confirmée sans preuve : l'interface le dit explicitement).
 */
export const buildDeliveryProof = (
  draft: DeliveryProofDraft | null | undefined,
  meta: {
    capturedAt: string;
    capturedByEmployeeId?: string;
    capturedByEmployeeName?: string;
  }
): DeliveryProof | null => {
  const photo = draft?.photoDataUrl ?? null;
  const signature = draft?.signatureDataUrl ?? null;
  const proof: DeliveryProof = {
    photoDataUrl: isImageDataUrlUpTo(photo, MAX_PROOF_PHOTO_LENGTH) ? photo ?? undefined : undefined,
    signatureDataUrl: isImageDataUrlUpTo(signature, MAX_PROOF_SIGNATURE_LENGTH)
      ? signature ?? undefined
      : undefined,
    codeEntered: cleanText(draft?.codeEntered, 8),
    receiverName: cleanText(draft?.receiverName, MAX_RECEIVER_NAME_LENGTH),
    note: cleanText(draft?.note, MAX_PROOF_NOTE_LENGTH),
    capturedAt: meta.capturedAt,
    capturedByEmployeeId: meta.capturedByEmployeeId,
    capturedByEmployeeName: meta.capturedByEmployeeName,
  };

  const hasContent = Boolean(
    proof.photoDataUrl || proof.signatureDataUrl || proof.codeEntered || proof.receiverName || proof.note
  );
  return hasContent ? proof : null;
};

/**
 * Relit une preuve venue du stockage local (données potentiellement anciennes
 * ou corrompues) : les images invalides sont ignorées, le reste est conservé.
 */
export const normalizeDeliveryProof = (value: unknown): DeliveryProof | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const capturedAt = typeof raw.capturedAt === 'string' ? raw.capturedAt : '';
  if (!capturedAt) return undefined;

  const proof: DeliveryProof = {
    photoDataUrl: isImageDataUrlUpTo(raw.photoDataUrl, MAX_PROOF_PHOTO_LENGTH)
      ? (raw.photoDataUrl as string)
      : undefined,
    signatureDataUrl: isImageDataUrlUpTo(raw.signatureDataUrl, MAX_PROOF_SIGNATURE_LENGTH)
      ? (raw.signatureDataUrl as string)
      : undefined,
    codeEntered: typeof raw.codeEntered === 'string' ? raw.codeEntered.slice(0, 8) : undefined,
    receiverName: typeof raw.receiverName === 'string' ? raw.receiverName.slice(0, MAX_RECEIVER_NAME_LENGTH) : undefined,
    note: typeof raw.note === 'string' ? raw.note.slice(0, MAX_PROOF_NOTE_LENGTH) : undefined,
    capturedAt,
    capturedByEmployeeId:
      typeof raw.capturedByEmployeeId === 'string' ? raw.capturedByEmployeeId : undefined,
    capturedByEmployeeName:
      typeof raw.capturedByEmployeeName === 'string' ? raw.capturedByEmployeeName : undefined,
  };

  // La note seule suffit à conserver l'entrée : c'est peut-être la seule trace
  // d'une remise contestée. En revanche `hasDeliveryProof` ne la compte pas
  // comme une preuve vérifiable (pas de photo, de signature ni de code).
  const hasContent = Boolean(
    proof.photoDataUrl || proof.signatureDataUrl || proof.codeEntered || proof.receiverName || proof.note
  );
  return hasContent ? proof : undefined;
};

/** Une preuve exploitable contient au moins un élément vérifiable. */
export const hasDeliveryProof = (proof?: DeliveryProof | null): proof is DeliveryProof => {
  if (!proof) return false;
  return Boolean(
    proof.photoDataUrl || proof.signatureDataUrl || proof.codeEntered || proof.receiverName
  );
};

/** Éléments présents, en clair, pour l'affichage (« Photo », « Code »…). */
export const describeDeliveryProof = (proof?: DeliveryProof | null): string[] => {
  if (!proof) return [];
  const channels: string[] = [];
  if (proof.photoDataUrl) channels.push('Photo');
  if (proof.signatureDataUrl) channels.push('Signature');
  if (proof.codeEntered) channels.push('Code de remise');
  if (proof.receiverName) channels.push(`Réceptionné par ${proof.receiverName}`);
  return channels;
};
