import React from 'react';
import { cn } from '../../lib/utils';

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

type SegmentedTone = 'neutral' | 'blue' | 'teal';

const ACTIVE_TONES: Record<SegmentedTone, string> = {
  neutral: 'bg-white text-zinc-950 shadow-sm',
  blue: 'bg-blue-600 text-white shadow-sm',
  teal: 'bg-teal-600 text-white shadow-sm',
};

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  /** 'neutral' (segment actif blanc, défaut) · 'blue'/'teal' : code couleur pressing/blanchisserie du comptoir. */
  tone?: SegmentedTone;
  className?: string;
}

/**
 * Groupe de filtres/choix exclusifs en « segmented control » : même langage
 * visuel que la barre d'onglets (piste zinc enfoncée, segment actif en
 * relief), mais sémantique de boutons à bascule (`aria-pressed`) adaptée aux
 * filtres — périodes, rayons du catalogue, traitements… — là où `Tabs`
 * (role=tablist) sert à changer de section de page.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  tone = 'neutral',
  className,
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex flex-wrap gap-0.5 rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 shadow-[inset_0_1px_2px_rgb(9_9_11/0.05)]',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-zinc-900 active:scale-[0.97]',
              active ? ACTIVE_TONES[tone] : 'text-zinc-500 hover:bg-white/60 hover:text-zinc-900',
            )}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
