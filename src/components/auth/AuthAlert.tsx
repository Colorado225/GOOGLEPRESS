import React from 'react';
import { CheckCircle2, CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react';

/**
 * Bandeau d'information des écrans d'accès (erreur, succès, avertissement,
 * information). Module volontairement isolé de `AuthShell` : la garde ERP,
 * chargée dans le bundle d'entrée, n'a besoin que de ce composant et ne doit
 * pas télécharger la composition complète des pages publiques.
 */

export type AlertTone = 'error' | 'success' | 'warning' | 'info';

const ALERT_TONES: Record<AlertTone, { box: string; icon: LucideIcon; title: string }> = {
  error: {
    box: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200',
    icon: CircleAlert,
    title: 'text-red-900 dark:text-red-100',
  },
  success: {
    box: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
    icon: CheckCircle2,
    title: 'text-emerald-900 dark:text-emerald-100',
  },
  warning: {
    box: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
    icon: TriangleAlert,
    title: 'text-amber-950 dark:text-amber-100',
  },
  info: {
    box: 'border-[#DFDACF] bg-[#F7F4EE] text-[#4B5563] dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300',
    icon: Info,
    title: 'text-[#111827] dark:text-zinc-100',
  },
};

export const AuthAlert: React.FC<{
  tone: AlertTone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ tone, title, children, className = '' }) => {
  const config = ALERT_TONES[tone];
  const Icon = config.icon;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`flex gap-2.5 rounded-2xl border px-3.5 py-3 text-[12.5px] leading-relaxed ${config.box} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <p className={`text-[12.5px] font-black ${config.title}`}>{title}</p> : null}
        <div className={title ? 'mt-0.5' : undefined}>{children}</div>
      </div>
    </div>
  );
};
