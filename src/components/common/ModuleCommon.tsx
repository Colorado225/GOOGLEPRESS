import React from 'react';
import { ArrowLeft, Info, RotateCcw } from 'lucide-react';
import type { PeriodPreset } from '../../lib/periods';
import { PERIOD_PRESET_LABELS } from '../../lib/periods';

/** En-tête de page reprenant la convention des écrans existants (Clients, Commandes…). */
interface PageHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, onBack, action }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
    <div className="flex items-center gap-2 min-w-0">
      <button
        type="button"
        onClick={onBack}
        aria-label="Retour au tableau de bord"
        className="p-1 hover:bg-zinc-200 rounded-lg text-zinc-500 hover:text-black transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-zinc-900"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 truncate">{title}</h1>
        <p className="text-[13px] text-zinc-500">{subtitle}</p>
      </div>
    </div>
    {action}
  </div>
);

/**
 * Mention obligatoire des nouveaux modules : données fictives de démo au
 * premier lancement + persistance strictement locale au navigateur.
 */
export const LocalDataNotice: React.FC = () => (
  <p className="flex items-start gap-2 text-[11.5px] text-zinc-600 bg-blue-50/70 border border-blue-100 rounded-lg px-3 py-2 mb-4">
    <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
    <span>
      <strong>Données de démonstration fictives</strong> chargées au premier lancement. Vos
      modifications sont conservées <strong>uniquement dans ce navigateur</strong> (stockage
      local, sans serveur ni synchronisation entre appareils).
    </span>
  </p>
);

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action }) => (
  <div className="p-10 text-center text-zinc-400">
    <p className="text-[14px] font-semibold text-zinc-700">{title}</p>
    <p className="text-[12.5px] mt-1 max-w-md mx-auto">{description}</p>
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export const ResetFiltersButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zinc-600 hover:text-black border border-zinc-200 hover:bg-zinc-50 rounded-lg px-2.5 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900"
  >
    <RotateCcw className="w-3.5 h-3.5" />
    Réinitialiser les filtres
  </button>
);

interface PeriodFilterProps {
  preset: PeriodPreset;
  onPresetChange: (preset: PeriodPreset) => void;
  customStart: string;
  customEnd: string;
  onCustomChange: (start: string, end: string) => void;
  rangeLabel: string;
}

/** Sélecteur de période partagé (Dépenses, Rapports) : prédéfinies + personnalisée. */
export const PeriodFilter: React.FC<PeriodFilterProps> = ({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomChange,
  rangeLabel,
}) => {
  const presets = Object.keys(PERIOD_PRESET_LABELS) as PeriodPreset[];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choisir une période">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPresetChange(p)}
            aria-pressed={preset === p}
            className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 ${
              preset === p
                ? 'bg-[#09090b] text-white shadow-2xs'
                : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 bg-white'
            }`}
          >
            {PERIOD_PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
          <label htmlFor="period-start" className="text-zinc-500 font-medium">Du</label>
          <input
            id="period-start"
            type="date"
            value={customStart}
            onChange={(e) => onCustomChange(e.target.value, customEnd)}
            className="border border-zinc-200 rounded-lg px-2 py-1.5 text-[12.5px] bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
          <label htmlFor="period-end" className="text-zinc-500 font-medium">au</label>
          <input
            id="period-end"
            type="date"
            value={customEnd}
            onChange={(e) => onCustomChange(customStart, e.target.value)}
            className="border border-zinc-200 rounded-lg px-2 py-1.5 text-[12.5px] bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
      )}

      <span className="text-[12px] text-zinc-500 font-medium tabular-nums">Période : {rangeLabel}</span>
    </div>
  );
};

/** Carte KPI sobre, dans le style des cartes du tableau de bord. */
interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}

export const KpiCard: React.FC<KpiCardProps> = ({ label, value, hint, tone = 'default' }) => {
  const toneClass =
    tone === 'danger'
      ? 'text-red-700'
      : tone === 'warning'
      ? 'text-amber-700'
      : tone === 'success'
      ? 'text-emerald-700'
      : 'text-zinc-950';
  return (
    <div className="card-3d hover-lift rounded-xl p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`text-[22px] font-black tabular-nums tracking-tight mt-1 ${toneClass}`}>{value}</p>
      {hint && <p className="text-[11.5px] text-zinc-500 mt-0.5">{hint}</p>}
    </div>
  );
};
