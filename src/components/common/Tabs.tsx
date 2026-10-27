import React, { useRef } from 'react';
import { cn } from '../../lib/utils';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  /** Petit compteur optionnel (nombre d'éléments de la section, alertes…). */
  badge?: number | string;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
  /** 'md' : onglets de page (défaut) · 'sm' : sous-onglets compacts dans une carte. */
  size?: 'md' | 'sm';
}

/**
 * Barre d'onglets commune à toutes les pages, style « segmented control »
 * (motif reui c-tabs-6 adapté aux conventions maison) : piste zinc enfoncée
 * pleine largeur, segment actif blanc en relief, icônes + libellés et
 * compteurs optionnels. Regroupe les sections d'une page par contexte de
 * travail (analyser / agir / configurer…) pour ne montrer qu'un bloc
 * cohérent à la fois.
 * Navigation possible aux flèches ← → du clavier une fois un onglet focalisé.
 * Sur écran étroit, la piste défile horizontalement sans écraser les libellés.
 */
export function Tabs<T extends string>({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  className = '',
  size = 'md',
}: TabsProps<T>): React.ReactElement {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + tabs.length) % tabs.length;
    onChange(tabs[nextIndex].id);
    buttonRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex w-full gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-100 p-1 shadow-[inset_0_2px_4px_rgb(9_9_11/0.06),inset_0_-1px_0_rgb(255_255_255/0.7)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {tabs.map((tab, index) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1 active:scale-[0.98]',
              size === 'sm' ? 'px-2.5 py-1.5 text-[12px]' : 'px-3.5 py-2 text-[13px]',
              active
                ? 'bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-500 hover:bg-white/60 hover:text-zinc-900',
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[10.5px] font-bold tabular-nums',
                  active
                    ? 'bg-zinc-900 text-white'
                    : 'border border-zinc-200 bg-white text-zinc-600 shadow-2xs',
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
