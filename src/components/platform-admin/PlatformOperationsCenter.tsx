import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BellRing,
  CreditCard,
  FileClock,
  Headphones,
  Loader2,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  LayoutDashboard,
} from 'lucide-react';
import {
  fetchPlatformOperationsSnapshot,
  runPlatformOperation,
  type PlatformOperationAction,
  type PlatformOperationsSnapshot,
} from '../../lib/platformOperations';
import type { PlatformAdminOrganization } from '../../lib/platformAdmin';
import { operationSecondaryClass } from './operations/ui';
import { OperationsDashboard } from './operations/OperationsDashboard';
import { FinancePanel } from './operations/FinancePanel';
import { SubscriptionOperationsPanel } from './operations/SubscriptionOperationsPanel';
import { SupportOperationsPanel } from './operations/SupportOperationsPanel';
import { CommunicationPanel } from './operations/CommunicationPanel';
import { SecurityOperationsPanel } from './operations/SecurityOperationsPanel';
import { AuditPanel } from './operations/AuditPanel';
import { SystemPanel } from './operations/SystemPanel';

type OperationsView = 'dashboard' | 'finance' | 'subscriptions' | 'support' | 'communication' | 'security' | 'audit' | 'system';

const SECTIONS = [
  {
    id: 'pilotage',
    label: 'Pilotage & revenus',
    shortLabel: 'Pilotage',
    description: 'Vue globale, facturation et abonnements',
    icon: LayoutDashboard,
  },
  {
    id: 'relations',
    label: 'Relations clients',
    shortLabel: 'Relations',
    description: 'Assistance et communications',
    icon: Headphones,
  },
  {
    id: 'system',
    label: 'Système & conformité',
    shortLabel: 'Système',
    description: 'Sécurité, audit et supervision',
    icon: ShieldCheck,
  },
] as const;

const VIEWS = [
  { id: 'dashboard', label: 'Pilotage', icon: LayoutDashboard, section: 'pilotage' },
  { id: 'finance', label: 'Finances', icon: CreditCard, section: 'pilotage' },
  { id: 'subscriptions', label: 'Offres & renouvellements', icon: SlidersHorizontal, section: 'pilotage' },
  { id: 'support', label: 'Tickets support', icon: Headphones, section: 'relations' },
  { id: 'communication', label: 'Communications', icon: Megaphone, section: 'relations' },
  { id: 'security', label: 'Sécurité', icon: ShieldCheck, section: 'system' },
  { id: 'audit', label: 'Audit', icon: FileClock, section: 'system' },
  { id: 'system', label: 'Supervision', icon: Activity, section: 'system' },
] as const;

export const PlatformOperationsCenter: React.FC<{
  organizations: PlatformAdminOrganization[];
}> = ({ organizations }) => {
  const [snapshot, setSnapshot] = useState<PlatformOperationsSnapshot | null>(null);
  const [view, setView] = useState<OperationsView>('dashboard');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchPlatformOperationsSnapshot());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les opérations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (
    action: PlatformOperationAction,
    payload: Record<string, unknown> = {},
    success = 'Opération enregistrée et auditée.',
  ): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      setSnapshot(await runPlatformOperation(action, payload));
      setFeedback(success);
      return true;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'L’opération a échoué.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const unread = snapshot?.notifications.filter((entry) => !entry.read_at).length ?? 0;
  const activeView = VIEWS.find((candidate) => candidate.id === view);
  const activeSection = SECTIONS.find((section) => section.id === activeView?.section) ?? SECTIONS[0];
  const sectionViews = VIEWS.filter((candidate) => candidate.section === activeSection.id);
  const panelProps = snapshot ? { snapshot, busy, run: (action: PlatformOperationAction, payload?: Record<string, unknown>, success?: string) => run(action, payload, success), refresh: () => void load() } : null;

  return (
    <div className="mt-5 min-w-0">
      <section aria-labelledby="operations-center-title" className="rounded-[24px] border border-white/10 bg-[#0c1222] p-4 text-white shadow-[0_18px_45px_rgba(15,23,42,0.14)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-400">Administration de la plateforme</p>
            <h2 id="operations-center-title" className="mt-1.5 text-[22px] font-black tracking-tight sm:text-[26px]">Centre des opérations SaaS</h2>
            <p className="mt-2 max-w-2xl text-[11.5px] leading-relaxed text-zinc-400 sm:text-[12.5px]">Finances, abonnements, support et sécurité, organisés par métier — sans données métier des pressings.</p>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            {unread > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-black text-zinc-950"><BellRing className="h-3.5 w-3.5" aria-hidden="true" />{unread} alerte(s)</span>}
            <button type="button" className={operationSecondaryClass} onClick={() => void load()} disabled={loading || busy}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Actualiser les opérations
            </button>
          </div>
        </div>

        <nav aria-label="Sections du centre des opérations" className="mt-5 grid grid-cols-3 gap-1.5 rounded-2xl bg-white/[0.07] p-1.5">
          {SECTIONS.map((section) => {
            const active = activeSection.id === section.id;
            const SectionIcon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                aria-label={section.label}
                aria-pressed={active}
                title={section.description}
                onClick={() => {
                  if (active) return;
                  const firstView = VIEWS.find((candidate) => candidate.section === section.id);
                  if (firstView) setView(firstView.id);
                }}
                className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-center text-[10.5px] font-bold transition focus:outline-none focus:ring-2 focus:ring-blue-400 lg:flex-row lg:justify-start lg:gap-2.5 lg:px-3 lg:text-left lg:text-[12px] ${active ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-400 hover:bg-white/10 hover:text-white'}`}
              >
                <SectionIcon className={`h-4 w-4 shrink-0 ${active ? 'text-blue-600' : ''}`} aria-hidden="true" />
                <span className="lg:hidden">{section.shortLabel}</span>
                <span className="hidden lg:inline">{section.label}</span>
              </button>
            );
          })}
        </nav>
      </section>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">Sous-onglets</p>
          <h3 className="mt-0.5 text-[15px] font-black tracking-tight">{activeSection.label}</h3>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{activeSection.description}</p>
        </div>
        <span className="rounded-full bg-zinc-200/80 px-2.5 py-1 text-[10px] font-black text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{sectionViews.length} modules</span>
      </div>

      <nav aria-label="Sous-onglets du centre des opérations" className="mt-2.5 flex max-w-full gap-1.5 overflow-x-auto rounded-[20px] border border-zinc-200/80 bg-white p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] dark:border-zinc-800 dark:bg-zinc-900">
        {sectionViews.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => setView(id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[11.5px] font-bold transition focus:outline-none focus:ring-2 focus:ring-blue-600 ${view === id ? 'bg-zinc-950 text-white shadow-sm dark:bg-blue-600' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50'}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />{label}
          </button>
        ))}
      </nav>

      {(error || feedback) && (
        <div aria-live="polite" className={`mt-4 rounded-xl border px-4 py-3 text-[12px] font-semibold ${error ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>
          {error || feedback}
        </div>
      )}

      {loading && !snapshot ? (
        <div role="status" className="flex items-center justify-center gap-2 py-20 text-[13px] font-semibold text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /> Chargement du centre des opérations…</div>
      ) : panelProps ? (
        <div className="mt-5">
          {view === 'dashboard' && <OperationsDashboard {...panelProps} organizations={organizations} onOpen={setView} />}
          {view === 'finance' && <FinancePanel {...panelProps} organizations={organizations} />}
          {view === 'subscriptions' && <SubscriptionOperationsPanel {...panelProps} organizations={organizations} />}
          {view === 'support' && <SupportOperationsPanel {...panelProps} organizations={organizations} />}
          {view === 'communication' && <CommunicationPanel {...panelProps} organizations={organizations} />}
          {view === 'security' && <SecurityOperationsPanel {...panelProps} />}
          {view === 'audit' && <AuditPanel {...panelProps} />}
          {view === 'system' && <SystemPanel {...panelProps} />}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="text-[12.5px] font-bold">Le centre des opérations n’est pas disponible.</p>
          <button type="button" className={`${operationSecondaryClass} mt-3`} onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Réessayer</button>
        </div>
      )}
    </div>
  );
};
