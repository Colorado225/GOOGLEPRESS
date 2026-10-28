import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sparkles, Shirt, Waves, ArrowRight, Check, ShieldCheck, Scale, Award } from 'lucide-react';

export const ServiceTypeSelectionScreen: React.FC = () => {
  const { setSelectedServiceCategory, setOrderStep } = useApp();

  const handleSelect = (category: 'pressing' | 'blanchisserie') => {
    setSelectedServiceCategory(category);
    setOrderStep(1);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 animate-in fade-in duration-200">
      {/* Title Header */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-2">
          <Sparkles className="w-3.5 h-3.5" /> Étape initiale • Choix de la prestation
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">
          Nouvelle commande — Sélection du service
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-[13.5px] max-w-xl mx-auto mt-1">
          Choisissez le type de traitement adapté aux pièces confiées par le client pour ouvrir le formulaire et catalogue dédié.
        </p>
      </div>

      {/* Two Interactive Hero Service Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: PRESSING (Bleu Roi) */}
        <div
          onClick={() => handleSelect('pressing')}
          className="group relative bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 hover:border-blue-600 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
        >
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-600 group-hover:h-2 transition-all" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                <Shirt className="w-7 h-7" />
              </div>
              <span className="px-3 py-1 rounded-full text-[11.5px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 uppercase tracking-wide">
                Bleu • Soins Délicats
              </span>
            </div>

            <h2 className="text-xl font-extrabold text-zinc-950 dark:text-zinc-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Pressing & Nettoyage à sec
            </h2>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">
              Vêtements de ville, costumes, robes, boubous bazin, matières nobles & retouches sur mesure.
            </p>

            {/* List of covered categories */}
            <div className="mt-5 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-4 text-[12.5px] text-zinc-700 dark:text-zinc-300">
              <p className="font-bold text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Prestations & Pièces incluses :
              </p>
              <div className="grid grid-cols-2 gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  👔 Chemises & chemisiers
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  👖 Pantalons & jeans
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  👗 Robes & soirées
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  🤵 Costumes 2 ou 3 pièces
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  🥻 Boubous bazin riche
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  🧥 Vestes & manteaux
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  🔥 Repassage seul
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  🪡 Retouches & ourlets
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
              Tarification à la pièce
            </span>
            <button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[13px] px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 group-hover:translate-x-1"
            >
              <span>Ouvrir Pressing</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card 2: BLANCHISSERIE (Vert Turquoise) */}
        <div
          onClick={() => handleSelect('blanchisserie')}
          className="group relative bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 hover:border-teal-600 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
        >
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-teal-600 group-hover:h-2 transition-all" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900 flex items-center justify-center group-hover:scale-110 group-hover:bg-teal-600 group-hover:text-white transition-all shadow-xs">
                <Waves className="w-7 h-7" />
              </div>
              <span className="px-3 py-1 rounded-full text-[11.5px] font-bold bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 uppercase tracking-wide">
                Turquoise • Grand Volume
              </span>
            </div>

            <h2 className="text-xl font-extrabold text-zinc-950 dark:text-zinc-50 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
              Blanchisserie & Linge de maison
            </h2>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">
              Draps, serviettes, taies, nappes, uniformes pros, lavage grand volume et linge au kilo.
            </p>

            {/* List of covered categories */}
            <div className="mt-5 space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-4 text-[12.5px] text-zinc-700 dark:text-zinc-300">
              <p className="font-bold text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Prestations & Linge inclus :
              </p>
              <div className="grid grid-cols-2 gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  🛏️ Draps & housses de lit
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  🧖 Serviettes & peignoirs
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  🛌 Taies d'oreiller
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  🍽️ Nappes & restauration
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  🦺 Uniformes & blouses
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  🛋️ Couettes & édredons
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  🪟 Rideaux & voilages
                </span>
                <span className="flex items-center gap-1.5 font-bold text-teal-700 dark:text-teal-300">
                  ⚖️ Linge au kilo (au poids)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Au kilo & à la pièce
            </span>
            <button
              type="button"
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-[13px] px-4 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 group-hover:translate-x-1"
            >
              <span>Ouvrir Blanchisserie</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Trust & Assurance Footnote */}
      <div className="mt-6 bg-zinc-100/70 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-[12px] text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Sélection réversible : vous pouvez basculer ou ajuster le service à tout moment pendant la saisie.</span>
        </div>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">Poste Comptoir • PressingPro Abidjan</span>
      </div>
    </div>
  );
};
