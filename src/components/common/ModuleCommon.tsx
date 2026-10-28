import React from 'react';
import { ArrowLeft, Info, RotateCcw } from 'lucide-react';
import { SegmentedControl } from './SegmentedControl';
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
        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">{title}</h1>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{subtitle}</p>
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
  <p className="flex items-start gap-2 text-[11.5px] text-zinc-600 dark:text-zinc-400 bg-blue-50/70 dark:bg-blue-950/70 border border-blue-100 dark:border-blue-900 rounded-lg px-3 py-2 mb-4">
    <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
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
  <div className="p-10 text-center text-zinc-400 dark:text-zinc-500">
    <p className="text-[14px] font-semibold text-zinc-700 dark:text-zinc-300">{title}</p>
    <p className="text-[12.5px] mt-1 max-w-md mx-auto">{description}</p>
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export const ResetFiltersButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg px-2.5 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
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
      <SegmentedControl
        ariaLabel="Choisir une période"
        options={presets.map((p) => ({ id: p, label: PERIOD_PRESET_LABELS[p] }))}
        value={preset}
        onChange={onPresetChange}
      />

      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
          <label htmlFor="period-start" className="text-zinc-500 dark:text-zinc-400 font-medium">Du</label>
          <input
            id="period-start"
            type="date"
            value={customStart}
            onChange={(e) => onCustomChange(e.target.value, customEnd)}
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-[12.5px] bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />
          <label htmlFor="period-end" className="text-zinc-500 dark:text-zinc-400 font-medium">au</label>
          <input
            id="period-end"
            type="date"
            value={customEnd}
            onChange={(e) => onCustomChange(customStart, e.target.value)}
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-[12.5px] bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />
        </div>
      )}

      <span className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium tabular-nums">Période : {rangeLabel}</span>
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
      ? 'text-red-700 dark:text-red-300'
      : tone === 'warning'
      ? 'text-amber-700 dark:text-amber-300'
      : tone === 'success'
      ? 'text-emerald-700 dark:text-emerald-300'
      : 'text-zinc-950 dark:text-zinc-50';
  return (
    <div className="card-3d hover-lift rounded-xl p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{label}</p>
      <p className={`text-[22px] font-black tabular-nums tracking-tight mt-1 ${toneClass}`}>{value}</p>
      {hint && <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">{hint}</p>}
    </div>
  );
};
