import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  GARMENT_COLORS,
  getGarmentColorSwatch,
  resolveGarmentColorName,
  OrderLine,
} from '../../types';
import { Palette } from 'lucide-react';

/* ————————————————————————————————————————————————————————————————
   Couleurs personnalisées récentes (saisies libres au comptoir),
   mémorisées dans ce navigateur pour être resservies en suggestions.
   ———————————————————————————————————————————————————————————————— */
const CUSTOM_COLORS_KEY = 'pressingpro_custom_colors';
const MAX_CUSTOM_COLORS = 10;

function loadCustomColors(): string[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_COLORS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function rememberCustomColor(name: string): void {
  try {
    const rest = loadCustomColors().filter((c) => c.toLowerCase() !== name.toLowerCase());
    window.localStorage.setItem(
      CUSTOM_COLORS_KEY,
      JSON.stringify([name, ...rest].slice(0, MAX_CUSTOM_COLORS))
    );
  } catch {
    // Stockage indisponible (navigation privée…) : la saisie libre reste fonctionnelle.
  }
}

/** Suggestions proposées dans les champs "écrire la couleur" : palette + saisies récentes. */
function colorSuggestions(): string[] {
  return [...GARMENT_COLORS.map((c) => c.name), ...loadCustomColors()];
}

const isPaletteColor = (name?: string): boolean =>
  !!name && GARMENT_COLORS.some((c) => c.name === name);

/** Pastille des couleurs hors palette (saisie libre) : rayures neutres. */
const CUSTOM_SWATCH = 'repeating-linear-gradient(45deg, #d4d4d8 0 3px, #fafafa 3px 6px)';

/** Pastille ronde d'une couleur (fond CSS de la palette, sinon rayures "saisie libre"). */
export const ColorDot: React.FC<{ color?: string; className?: string }> = ({
  color,
  className = 'w-3 h-3',
}) => (
  <span
    aria-hidden="true"
    className={`inline-block rounded-full border border-zinc-400/70 shrink-0 ${className}`}
    style={{ background: getGarmentColorSwatch(color) ?? (color ? CUSTOM_SWATCH : 'transparent') }}
  />
);

/** Affichage compact, lecture seule : pastille + nom de la couleur. */
export const GarmentColorChip: React.FC<{ color?: string }> = ({ color }) => {
  if (!color) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600">
      <ColorDot color={color} />
      {color}
    </span>
  );
};

/**
 * Sélecteur de la « couleur en cours » au-dessus du catalogue :
 * pastilles de la palette, ou couleur écrite librement (bleu roi, wax rouge…).
 * Chaque article ajouté ensuite hérite de cette couleur ; une même référence
 * en deux couleurs crée deux lignes distinctes au panier, comme en atelier.
 * « Non précisée » reste toujours possible pour aller vite.
 */
export const CurrentColorSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { selectedGarmentColor, setSelectedGarmentColor } = useApp();
  const [customText, setCustomText] = useState('');

  // Si la couleur en cours est une saisie libre, la réafficher dans le champ.
  useEffect(() => {
    if (selectedGarmentColor && !isPaletteColor(selectedGarmentColor)) {
      setCustomText(selectedGarmentColor);
    }
  }, [selectedGarmentColor]);

  const commitCustom = () => {
    const resolved = resolveGarmentColorName(customText);
    if (!resolved) {
      setCustomText('');
      return;
    }
    if (!isPaletteColor(resolved)) {
      rememberCustomColor(resolved);
      setCustomText(resolved);
    } else {
      setCustomText(''); // l'utilisateur a tapé le nom d'une couleur de la palette
    }
    setSelectedGarmentColor(resolved);
  };

  const choosePaletteColor = (name: string) => {
    setCustomText('');
    setSelectedGarmentColor(selectedGarmentColor === name ? undefined : name);
  };

  return (
    <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-2 ${className}`}>
      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-zinc-700">
        <Palette className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
        Couleur des pièces ajoutées :
      </span>

      <button
        type="button"
        onClick={() => {
          setCustomText('');
          setSelectedGarmentColor(undefined);
        }}
        aria-pressed={selectedGarmentColor === undefined}
        className={`text-[11px] font-semibold border rounded-full px-2.5 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 ${
          selectedGarmentColor === undefined
            ? 'bg-[#09090b] text-white border-[#09090b]'
            : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100'
        }`}
      >
        Non précisée
      </button>

      <span className="inline-flex flex-wrap items-center gap-1.5" role="group" aria-label="Choisir une couleur">
        {GARMENT_COLORS.map((color) => (
          <button
            key={color.name}
            type="button"
            title={color.name}
            aria-label={`Couleur ${color.name}`}
            aria-pressed={selectedGarmentColor === color.name}
            onClick={() => choosePaletteColor(color.name)}
            className={`w-6 h-6 rounded-full border transition-transform focus:outline-none focus:ring-2 focus:ring-zinc-900 ${
              selectedGarmentColor === color.name
                ? 'ring-2 ring-zinc-900 ring-offset-1 scale-110 border-zinc-500'
                : 'border-zinc-400/70 hover:scale-110'
            }`}
            style={{ background: color.swatch }}
          />
        ))}
      </span>

      {isPaletteColor(selectedGarmentColor) && (
        <span className="text-[11.5px] font-bold text-zinc-800">{selectedGarmentColor}</span>
      )}

      {/* Saisie libre d'une couleur hors palette, validée par Entrée ou en quittant le champ */}
      <span className="inline-flex items-center gap-1.5">
        <label htmlFor="current-custom-color" className="text-[11.5px] text-zinc-500 font-medium">
          ou écrire :
        </label>
        <input
          id="current-custom-color"
          type="text"
          list="current-custom-color-options"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onBlur={() => {
            if (customText.trim()) commitCustom();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitCustom();
              e.currentTarget.blur();
            }
            if (e.key === 'Escape') setCustomText('');
          }}
          placeholder="ex. bleu roi, wax rouge…"
          className="w-[170px] text-[12px] font-medium text-zinc-800 bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
        <datalist id="current-custom-color-options">
          {colorSuggestions().map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </span>
    </div>
  );
};

/**
 * Couleur d'une ligne déjà au panier : champ libre avec suggestions
 * (palette + couleurs récemment écrites). Validation par Entrée ou en
 * quittant le champ ; si la nouvelle couleur recrée un doublon
 * (même article, même traitement), les lignes fusionnent.
 */
export const LineColorSelect: React.FC<{ line: OrderLine }> = ({ line }) => {
  const { updateCartLineColor } = useApp();
  const [text, setText] = useState(line.color ?? '');

  useEffect(() => {
    setText(line.color ?? '');
  }, [line.color]);

  const commit = () => {
    const resolved = resolveGarmentColorName(text);
    if (resolved === (line.color ?? undefined)) {
      setText(line.color ?? '');
      return;
    }
    if (resolved && !isPaletteColor(resolved)) rememberCustomColor(resolved);
    updateCartLineColor(line.id, resolved);
  };

  return (
    <span className="inline-flex items-center gap-1.5 mt-1">
      <ColorDot color={line.color} />
      <label htmlFor={`color-${line.id}`} className="sr-only">
        Couleur de {line.name}
      </label>
      <input
        id={`color-${line.id}`}
        type="text"
        list={`color-options-${line.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') setText(line.color ?? '');
        }}
        placeholder="Couleur non précisée"
        title="Écrire la couleur ou la choisir dans les suggestions, puis Entrée"
        className="w-[142px] text-[11px] font-medium text-zinc-700 bg-white border border-zinc-200 rounded-md px-1.5 py-0.5 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
      <datalist id={`color-options-${line.id}`}>
        {colorSuggestions().map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </span>
  );
};
