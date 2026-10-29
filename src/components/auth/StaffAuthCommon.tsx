import React from 'react';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { AuthAlert } from './AuthAlert';

/**
 * Habillage partagé du personnel connecté (garde `StaffAccessGate`, onboarding)
 * et des écrans de vérification d'accès.
 *
 * Les pages publiques de connexion et d'inscription utilisent la composition
 * complète `AuthShell` ; ce module fournit les mêmes jetons (couleurs, focus,
 * densité) à un panneau simple centré, pour que l'ensemble de l'accès
 * personnel garde une seule apparence.
 */

export const staffShellClassName =
  'flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F7F5F2] px-4 py-8 text-[#111827] dark:bg-[#07090F] dark:text-zinc-100';

export const staffPanelClassName =
  'w-full max-w-md rounded-3xl border border-[#E4DFD6] bg-white p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-[#0B101B]';

export const staffWidePanelClassName =
  'w-full max-w-xl rounded-3xl border border-[#E4DFD6] bg-white p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-[#0B101B]';

export const staffLabelClassName =
  'text-[12px] font-bold uppercase tracking-[0.08em] text-[#5C6472] dark:text-zinc-400';

export const staffInputClassName =
  'h-11 w-full rounded-xl border border-[#DFDACF] bg-white px-3.5 text-[14px] text-[#111827] shadow-[0_1px_2px_rgba(17,24,39,0.04)] outline-none transition placeholder:text-[#8B93A1] focus:border-[#1D4ED8] focus:ring-4 focus:ring-[#1D4ED8]/15 disabled:cursor-not-allowed disabled:bg-[#F4F1EB] disabled:text-[#6B7280] dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20 dark:disabled:bg-white/[0.02]';

export const staffPrimaryButtonClassName =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] px-4 text-[14px] font-bold text-white shadow-[0_12px_24px_-14px_rgba(29,78,216,0.9)] transition hover:bg-[#1E40AF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1D4ED8]/30 disabled:cursor-not-allowed disabled:bg-[#1D4ED8]/45 disabled:shadow-none dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-blue-600/45';

export const staffSecondaryButtonClassName =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#DFDACF] bg-white px-4 text-[13.5px] font-bold text-[#111827] transition hover:bg-[#F7F4EE] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#111827]/10 disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:hover:bg-white/[0.08]';

export const StaffAuthHeader: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => (
  <header>
    <p className="inline-flex items-center gap-2 text-[10.5px] font-black uppercase tracking-[0.16em] text-[#6B7280] dark:text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
      Accès personnel
    </p>
    <h1 className="mt-2.5 text-[24px] font-black leading-tight tracking-tight text-[#111827] dark:text-white">
      {title}
    </h1>
    <p className="mt-2 text-[13px] leading-relaxed text-[#5C6472] dark:text-zinc-400">
      {description}
    </p>
  </header>
);

export const StaffAuthAlert: React.FC<{
  tone: 'error' | 'success' | 'warning' | 'info';
  children: React.ReactNode;
  className?: string;
}> = ({ tone, children, className }) => (
  <AuthAlert tone={tone} className={className}>
    {children}
  </AuthAlert>
);

export const StaffAuthLoading: React.FC<{ label: string }> = ({ label }) => (
  <main className={staffShellClassName}>
    <div className="flex items-center gap-2.5 rounded-2xl border border-[#E4DFD6] bg-white px-5 py-3.5 text-[12.5px] font-semibold text-[#5C6472] shadow-sm dark:border-white/10 dark:bg-[#0B101B] dark:text-zinc-300">
      <Loader2 className="h-4 w-4 animate-spin text-[#1D4ED8] dark:text-blue-400" aria-hidden="true" />
      <span role="status">{label}</span>
    </div>
  </main>
);

/** Lien de navigation interne des pages publiques (reste un vrai lien <a>). */
export const StaffAuthLink: React.FC<{
  path: string;
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
  className?: string;
  children: React.ReactNode;
}> = ({ path, onNavigate, className, children }) => (
  <a
    href={path}
    className={className}
    onClick={(event) => {
      event.preventDefault();
      onNavigate(path);
    }}
  >
    {children}
  </a>
);

/** Rappel de sécurité des écrans du personnel. */
export const StaffSecurityNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-[#6B665D] dark:text-zinc-400">
    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    {children}
  </p>
);

/** Mention « session protégée » des écrans de garde. */
export const StaffSessionNote: React.FC = () => (
  <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#6B665D] dark:text-zinc-400">
    <Lock className="h-3 w-3" aria-hidden="true" />
    Session vérifiée côté serveur
  </p>
);
