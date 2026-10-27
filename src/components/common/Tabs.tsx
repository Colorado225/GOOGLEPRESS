import React, { useRef } from 'react';

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
 * Barre d'onglets commune à toutes les pages : regroupe les sections d'une
 * page par contexte de travail (analyser / agir / configurer…) pour ne
 * montrer qu'un bloc cohérent à la fois.
 * Navigation possible aux flèches ← → du clavier une fois un onglet focalisé.
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
    <div role="tablist" aria-label={ariaLabel} className={`flex flex-wrap gap-1.5 ${className}`}>
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
            className={`inline-flex items-center gap-1.5 rounded-lg font-bold border transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 ${
              size === 'sm' ? 'px-2.5 py-1.5 text-[12px]' : 'px-3.5 py-2 text-[13px]'
            } ${
              active
                ? 'bg-[#09090b] text-white border-zinc-900 shadow-2xs'
                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-black'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[10.5px] font-bold tabular-nums px-1.5 py-px rounded-full ${
                  active ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                }`}
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
