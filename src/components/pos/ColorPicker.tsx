import React from 'react';
import { useApp } from '../../context/AppContext';
import { GARMENT_COLORS, getGarmentColorSwatch, OrderLine } from '../../types';
import { Palette } from 'lucide-react';

/** Pastille ronde d'une couleur (fond CSS de la palette). */
export const ColorDot: React.FC<{ color?: string; className?: string }> = ({ color, className = 'w-3 h-3' }) => (
  <span
    aria-hidden="true"
    className={`inline-block rounded-full border border-zinc-400/70 shrink-0 ${className}`}
    style={{ background: getGarmentColorSwatch(color) ?? 'transparent' }}
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
 * chaque article ajouté ensuite hérite de cette couleur (une même référence
 * en deux couleurs crée deux lignes distinctes au panier, comme en atelier).
 * « Non précisée » reste toujours possible pour aller vite.
 */
export const CurrentColorSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { selectedGarmentColor, setSelectedGarmentColor } = useApp();

  return (
    <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-2 ${className}`}>
      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-zinc-700">
        <Palette className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
        Couleur des pièces ajoutées :
      </span>

      <button
        type="button"
        onClick={() => setSelectedGarmentColor(undefined)}
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
            onClick={() =>
              setSelectedGarmentColor(selectedGarmentColor === color.name ? undefined : color.name)
            }
            className={`w-6 h-6 rounded-full border transition-transform focus:outline-none focus:ring-2 focus:ring-zinc-900 ${
              selectedGarmentColor === color.name
                ? 'ring-2 ring-zinc-900 ring-offset-1 scale-110 border-zinc-500'
                : 'border-zinc-400/70 hover:scale-110'
            }`}
            style={{ background: color.swatch }}
          />
        ))}
      </span>

      {selectedGarmentColor && (
        <span className="text-[11.5px] font-bold text-zinc-800">{selectedGarmentColor}</span>
      )}
    </div>
  );
};

/**
 * Modification de la couleur d'une ligne déjà au panier.
 * Si une autre ligne (même article, même traitement) porte déjà la couleur
 * choisie, les deux lignes fusionnent automatiquement.
 */
export const LineColorSelect: React.FC<{ line: OrderLine }> = ({ line }) => {
  const { updateCartLineColor } = useApp();

  return (
    <span className="inline-flex items-center gap-1.5 mt-1">
      <ColorDot color={line.color} />
      <label htmlFor={`color-${line.id}`} className="sr-only">
        Couleur de {line.name}
      </label>
      <select
        id={`color-${line.id}`}
        value={line.color ?? ''}
        onChange={(e) => updateCartLineColor(line.id, e.target.value || undefined)}
        className="text-[11px] font-medium text-zinc-700 bg-white border border-zinc-200 rounded-md px-1.5 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-900"
      >
        <option value="">Couleur non précisée</option>
        {GARMENT_COLORS.map((color) => (
          <option key={color.name} value={color.name}>
            {color.name}
          </option>
        ))}
      </select>
    </span>
  );
};
