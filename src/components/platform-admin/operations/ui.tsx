import React from 'react';
import { Loader2 } from 'lucide-react';
import type { PlatformOperationAction, PlatformOperationsSnapshot } from '../../../lib/platformOperations';

export const operationInputClass =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3.5 py-2.5 text-[12.5px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-600/10 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950/70 dark:text-zinc-100 dark:focus:bg-zinc-950';
export const operationPrimaryClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-[12px] font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
export const operationSecondaryClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-[12px] font-bold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';
export const operationDangerClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-[12px] font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300';

export type RunPlatformOperation = (
  action: PlatformOperationAction,
  payload?: Record<string, unknown>,
  success?: string,
) => Promise<boolean>;

export interface PlatformOperationPanelProps {
  snapshot: PlatformOperationsSnapshot;
  busy: boolean;
  run: RunPlatformOperation;
  refresh: () => void;
}

export const OperationPanel: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, action, children, className = '' }) => (
  <section className={`min-w-0 rounded-[22px] border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[15px] font-black tracking-tight text-zinc-950 dark:text-zinc-50">{title}</h3>
        {description && <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      {action}
    </div>
    <div className="mt-5">{children}</div>
  </section>
);

export const OperationMetric: React.FC<{
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  icon?: React.ComponentType<{ className?: string }>;
}> = ({ label, value, detail, tone = 'default', icon: Icon }) => (
  <article className="min-w-0 rounded-[20px] border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] dark:border-zinc-800 dark:bg-zinc-900">
    <div className="flex items-start justify-between gap-2">
      <p className="min-w-0 pt-1 text-[10.5px] font-bold leading-snug text-zinc-500 dark:text-zinc-400">{label}</p>
      {Icon && <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone === 'danger' ? 'bg-red-50 text-red-600 dark:bg-red-950/50' : tone === 'warning' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50' : tone === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/50'}`}><Icon className="h-4 w-4" /></span>}
    </div>
    <p className={`mt-3 break-words text-[22px] font-black leading-tight tracking-tight tabular-nums ${tone === 'danger' ? 'text-red-700 dark:text-red-300' : tone === 'warning' ? 'text-amber-700 dark:text-amber-300' : tone === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-zinc-950 dark:text-zinc-50'}`}>{value}</p>
    {detail && <p className="mt-1.5 text-[10.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">{detail}</p>}
  </article>
);

export const OperationBadge: React.FC<{ children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }> = ({ children, tone = 'neutral' }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9.5px] font-black uppercase tracking-[0.07em] ${
    tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
      : tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
        : tone === 'danger' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300'
          : tone === 'info' ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300'
            : 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  }`}>{children}</span>
);

export const OperationEmpty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-8 text-center text-[12px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">{children}</div>
);

export const OperationSubmit: React.FC<{ busy: boolean; children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit'; className?: string }> = ({ busy, children, onClick, type = 'button', className = operationPrimaryClass }) => (
  <button type={type} className={className} disabled={busy} onClick={onClick}>
    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{children}
  </button>
);

export const operationFieldLabel = 'block text-[11px] font-bold text-zinc-600 dark:text-zinc-300';
export const operationTableWrap = 'max-w-full overflow-x-auto rounded-2xl border border-zinc-200/80 dark:border-zinc-800';
export const operationTable = 'w-full min-w-[720px] border-collapse text-left text-[11.5px]';
export const operationTh = 'bg-zinc-50/80 px-3 py-2.5 text-[10px] font-black uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/60 dark:text-zinc-400';
export const operationTd = 'border-t border-zinc-100 px-3 py-2.5 align-top dark:border-zinc-800';
