/**
 * Encodage Code 39 (dit « 3 of 9 ») pour les numéros de ticket.
 *
 * Chaque caractère = 5 barres + 4 espaces, dont exactement 3 éléments larges
 * (2 barres + 1 espace). Les caractères supportés ici (0-9, A-T et le
 * caractère de début/fin *) couvrent les numéros de ticket de l'application
 * (ex. « TK2857 »). Tout autre caractère est ignoré.
 * Le résultat est un code-barres réellement lisible par une douchette.
 */

/** Motifs des 5 barres (W = barre large), dans l'ordre 1-9 puis 0 / A-J / K-T. */
const BAR_PATTERNS: string[] = [
  'WnnnW', // 1 / A / K
  'nWnnW', // 2 / B / L
  'WWnnn', // 3 / C / M
  'nnWnW', // 4 / D / N
  'WnWnn', // 5 / E / O
  'nWWnn', // 6 / F / P
  'nnnWW', // 7 / G / Q
  'WnnWn', // 8 / H / R
  'nWnWn', // 9 / I / S
  'nnWWn', // 0 / J / T
];

/** Groupes de caractères : l'index du groupe donne la position de l'espace large (1, 2 ou 3). */
const CHAR_GROUPS: string[] = ['1234567890', 'ABCDEFGHIJ', 'KLMNOPQRST'];

/** Motif complet du caractère de début/fin « * » : largeurs des 9 éléments (barre, espace, …). */
const STAR_ELEMENTS: boolean[] = [false, true, false, false, true, false, true, false, false];

const NARROW = 1;
const WIDE = 2.2;

export interface BarcodeBar {
  x: number;
  width: number;
}

export interface EncodedBarcode {
  bars: BarcodeBar[];
  /** Largeur totale en unités (pour le viewBox SVG). */
  totalWidth: number;
  /** Texte effectivement encodé (caractères supportés uniquement). */
  encodedText: string;
}

/** Largeurs (true = large) des 9 éléments d'un caractère, ou null si non supporté. */
function charElements(char: string): boolean[] | null {
  for (let groupIdx = 0; groupIdx < CHAR_GROUPS.length; groupIdx += 1) {
    const charIdx = CHAR_GROUPS[groupIdx].indexOf(char);
    if (charIdx === -1) continue;
    const barsPattern = BAR_PATTERNS[charIdx];
    const wideSpaceIdx = groupIdx + 1; // espaces indexés 0..3 : chiffres=1, A-J=2, K-T=3
    const elements: boolean[] = [];
    for (let i = 0; i < 5; i += 1) {
      elements.push(barsPattern[i] === 'W');
      if (i < 4) elements.push(i === wideSpaceIdx);
    }
    return elements;
  }
  return null;
}

/**
 * Encode un texte (ex. numéro de ticket « #TK-2857 » → « TK2857 ») en barres
 * Code 39, caractères de début/fin inclus, avec un espace fin entre caractères.
 */
export function encodeCode39(rawText: string): EncodedBarcode {
  const clean = rawText
    .toUpperCase()
    .split('')
    .filter((c) => charElements(c) !== null)
    .join('');

  const sequence: boolean[][] = [STAR_ELEMENTS];
  for (const c of clean) {
    const el = charElements(c);
    if (el) sequence.push(el);
  }
  sequence.push(STAR_ELEMENTS);

  const bars: BarcodeBar[] = [];
  let x = 0;
  sequence.forEach((elements, seqIdx) => {
    elements.forEach((isWide, elIdx) => {
      const width = isWide ? WIDE : NARROW;
      if (elIdx % 2 === 0) bars.push({ x, width }); // les éléments pairs sont des barres
      x += width;
    });
    if (seqIdx < sequence.length - 1) x += NARROW; // espace inter-caractères
  });

  return { bars, totalWidth: x, encodedText: clean };
}
