import React from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';

interface OrderStepIntroProps {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  aside?: React.ReactNode;
}

/** En-tête commun aux quatre étapes de la réception comptoir. */
export const OrderStepIntro: React.FC<OrderStepIntroProps> = ({
  step,
  title,
  description,
  icon,
  aside,
}) => (
  <section className="relative overflow-hidden rounded-[22px] border border-zinc-200/90 bg-white px-4 py-4 shadow-[0_12px_35px_-28px_rgba(9,9,11,0.45)] sm:px-5 dark:border-zinc-800 dark:bg-zinc-900">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-blue-100/60 blur-3xl dark:bg-blue-950/40"
    />
    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[10.5px] font-black uppercase tracking-[0.16em] text-blue-700 dark:text-blue-400">
            Étape {step} sur 4
          </p>
          <h2 className="mt-0.5 text-[20px] font-black tracking-[-0.025em] text-zinc-950 dark:text-zinc-50 sm:text-[22px]">
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  </section>
);

interface OrderFlowActionsProps {
  onBack?: () => void;
  backLabel?: string;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  nextBusy?: boolean;
  hint?: string;
  nextIcon?: React.ReactNode;
}

/** Barre d'actions cohérente : retour secondaire, progression principale. */
export const OrderFlowActions: React.FC<OrderFlowActionsProps> = ({
  onBack,
  backLabel = 'Retour',
  onNext,
  nextLabel,
  nextDisabled = false,
  nextBusy = false,
  hint,
  nextIcon,
}) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/90 bg-white/95 p-3 shadow-[0_16px_35px_-30px_rgba(9,9,11,0.5)] backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/95">
    <div className="flex items-center gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-[12.5px] font-bold text-zinc-700 transition-colors hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus:ring-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </button>
      )}
      {hint && (
        <p className="hidden text-[11.5px] font-medium text-zinc-500 md:block dark:text-zinc-400">
          {hint}
        </p>
      )}
    </div>
    <button
      type="button"
      onClick={onNext}
      disabled={nextDisabled || nextBusy}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-[13px] font-black text-white shadow-[0_10px_22px_-12px_rgba(9,9,11,0.75)] transition-all hover:-translate-y-0.5 hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-900/15 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none sm:w-auto dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus:ring-zinc-100/20 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
    >
      <span>{nextBusy ? 'Enregistrement…' : nextLabel}</span>
      {nextIcon ?? <ArrowRight className="h-4 w-4" aria-hidden="true" />}
    </button>
  </div>
);

export const OrderValidationMessage: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[12.5px] font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
};

export const OrderSecureHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
    {children}
  </span>
);
