import { LOGO_TARGET_SIZE, validateLogoFile } from './shopIdentity';

/**
 * Redimensionnement d'un logo dans le navigateur.
 *
 * Pourquoi côté client : le logo est stocké en data URL, sous la limite de
 * `localStorage` et compatible avec la CSP `img-src 'self' data: blob:`.
 * Un logo de 2 Mo ramené à 256 px pèse quelques dizaines de kilo-octets.
 *
 * Le recadrage est centré et conserve les proportions (pas de déformation :
 * un logo horizontal reste horizontal, sur un fond transparent).
 */

export interface DownscaleOptions {
  /** Côté du carré cible (256 par défaut). */
  size?: number;
  /** Qualité WebP, 0 à 1. */
  quality?: number;
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Lecture du fichier impossible.'));
    };
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });

const loadImage = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Cette image ne peut pas être lue.'));
    image.src = source;
  });

const drawToCanvas = (
  image: HTMLImageElement,
  size: number
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Ce navigateur ne peut pas traiter l’image.');

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error('Cette image ne contient aucun pixel lisible.');
  }

  // « contain » : tout le logo reste visible, sans déformation.
  const scale = Math.min(size / sourceWidth, size / sourceHeight);
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.clearRect(0, 0, size, size);
  context.drawImage(image, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
  return canvas;
};

/**
 * Convertit un fichier image en data URL carrée.
 *
 * Lève une erreur avec un message français si le fichier est refusé ou
 * illisible ; l'appelant l'affiche tel quel.
 */
export const fileToLogoDataUrl = async (
  file: File,
  options: DownscaleOptions = {}
): Promise<string> => {
  const validationError = validateLogoFile(file);
  if (validationError) throw new Error(validationError);

  const size = options.size ?? LOGO_TARGET_SIZE;
  const quality = options.quality ?? 0.9;
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const canvas = drawToCanvas(image, size);

  // WebP est plus compact ; les navigateurs sans support retombent sur PNG
  // (le préfixe `data:image/` reste valide dans les deux cas).
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/png');
};
