/**
 * Jetons de style des pages d'accès publiques (connexion, inscription,
 * nouveau mot de passe). Regroupés dans un module sans composant : la garde
 * ERP, chargée dans le bundle d'entrée, peut réutiliser l'apparence des
 * champs et des boutons sans télécharger la composition complète.
 */

export const authInputClassName =
  'h-11 w-full rounded-xl border border-[#DFDACF] bg-white px-3.5 text-[14px] text-[#111827] shadow-[0_1px_2px_rgba(17,24,39,0.04)] outline-none transition placeholder:text-[#9AA1AC] focus:border-[#1D4ED8] focus:ring-4 focus:ring-[#1D4ED8]/15 disabled:cursor-not-allowed disabled:bg-[#F4F1EB] disabled:text-[#6B7280] dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20 dark:disabled:bg-white/[0.02]';

export const authLabelClassName =
  'text-[12px] font-bold uppercase tracking-[0.08em] text-[#5C6472] dark:text-zinc-400';

export const authHintClassName =
  'mt-1.5 text-[12px] leading-relaxed text-[#6B7280] dark:text-zinc-400';

export const authLinkClassName =
  'rounded font-bold text-[#1D4ED8] underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1D4ED8]/20 dark:text-blue-300';

export const authPrimaryButtonClassName =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] px-4 text-[14px] font-bold text-white shadow-[0_12px_24px_-14px_rgba(29,78,216,0.9)] transition hover:bg-[#1E40AF] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1D4ED8]/30 disabled:cursor-not-allowed disabled:bg-[#1D4ED8]/45 disabled:shadow-none dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-blue-600/45';

export const authSecondaryButtonClassName =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#DFDACF] bg-white px-4 text-[13.5px] font-bold text-[#111827] transition hover:bg-[#F7F4EE] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#111827]/10 disabled:cursor-not-allowed disabled:opacity-55 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:hover:bg-white/[0.08]';
