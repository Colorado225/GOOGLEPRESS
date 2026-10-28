import React from 'react';
import { Sparkles, ShieldCheck } from 'lucide-react';
// Import statique : Vite embarque le fichier dans le build de production
// (l'ancien chemin texte "/src/assets/..." produisait une image cassée en prod).
import bannerImage from '../../assets/images/dry_clean_rack_banner_1793109060337.jpg';

export const PromoBanner: React.FC = () => {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200/90 dark:border-zinc-700/90 shadow-2xs bg-zinc-950 text-white min-h-[110px] flex items-center">
      {/* Background Image */}
      <img
        src={bannerImage}
        alt="Atelier pressing moderne"
        className="absolute inset-0 w-full h-full object-cover opacity-25 filter brightness-90 mix-blend-luminosity"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-900/90 to-blue-950/70" />

      {/* Content */}
      <div className="relative z-10 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center font-black text-xs text-white">
              P
            </span>
            <span className="text-[12px] font-bold text-blue-400 tracking-wide uppercase">
              PressingPro CI • Qualité Supérieure
            </span>
          </div>
          <p className="text-[15px] font-bold tracking-tight text-white">
            « Un vêtement bien entretenu, c'est une meilleure image ! »
          </p>
          <p className="text-[11.5px] text-zinc-300 mt-0.5">
            Détachage expert fibres délicates, bazin riche & costumes d’affaires
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-white/10 dark:bg-zinc-900/10 backdrop-blur-xs border border-white/15 px-3 py-1.5 rounded-lg text-center">
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase">Garantie</p>
            <p className="text-[12px] font-bold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% Soigné
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
