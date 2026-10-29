import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  LockKeyhole,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  UnlockKeyhole,
  UsersRound,
} from 'lucide-react';
import {
  adminAddSupportNote,
  adminSetOrganizationStatus,
  adminSetShopSubscription,
  adminUpdatePlatformConfig,
  fetchPlatformAdminSnapshot,
  filterPlatformAdminOrganizations,
  getPlatformAdminMetrics,
  type PlatformAccountFilter,
  type PlatformAdminOrganization,
  type PlatformAdminShop,
  type PlatformAdminSnapshot,
  type PlatformPublicConfig,
  type PlatformSupportCategory,
} from '../../lib/platformAdmin';
import { getSubscriptionPlan, getSubscriptionStatusLabel } from '../../lib/subscription';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { getStaffAccessEnvironment, resolvePlatformAdminAccessMode } from '../../lib/staffAccess';
import { PlatformOperationsCenter } from './PlatformOperationsCenter';
import { PlatformAdminSidebar, type PlatformAdminTab } from './PlatformAdminSidebar';

const inputClass =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3.5 py-2.5 text-[13px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-600/10 dark:border-zinc-700 dark:bg-zinc-950/70 dark:text-zinc-100 dark:focus:bg-zinc-950';
const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-[12.5px] font-bold text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';
const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-[12.5px] font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const adminPanelClass =
  'rounded-[22px] border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)] dark:border-zinc-800 dark:bg-zinc-900';

const PAGE_COPY = {
  accounts: {
    eyebrow: 'Portefeuille de la plateforme',
    title: 'Comptes clients de la plateforme',
    description: 'Administrez les pressings et buanderies sans ouvrir leurs commandes, leurs clients ni leurs données métier.',
    icon: Building2,
  },
  operations: {
    eyebrow: 'Supervision commerciale et technique',
    title: 'Pilotage de PressingPro CI',
    description: 'Suivez les revenus, abonnements, tickets, communications, la sécurité et la santé du service.',
    icon: LayoutDashboard,
  },
  config: {
    eyebrow: 'Paramètres de l’éditeur',
    title: 'Configuration de la plateforme',
    description: 'Réglez les inscriptions et l’annonce globale sans ouvrir les données métier des pressings.',
    icon: Settings2,
  },
} as const;

const formatDate = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fr-FR');
};

const statusLabel = (status: PlatformAdminOrganization['status']): string => {
  if (status === 'active') return 'Actif';
  if (status === 'suspended') return 'Verrouillé';
  return 'Fermé';
};

const StatusBadge: React.FC<{ status: PlatformAdminOrganization['status'] }> = ({ status }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9.5px] font-black uppercase tracking-[0.08em] ${
      status === 'active'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
        : status === 'suspended'
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300'
          : 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
    }`}
  >
    {status === 'suspended' && <LockKeyhole className="h-3 w-3" aria-hidden="true" />}
    {statusLabel(status)}
  </span>
);

const SubscriptionEditor: React.FC<{
  shop: PlatformAdminShop;
  busy: boolean;
  onSave: (
    shop: PlatformAdminShop,
    input: { plan: PlatformAdminShop['subscription']['plan']; status: PlatformAdminShop['subscription']['status']; renewsOn: string | null }
  ) => void;
}> = ({ shop, busy, onSave }) => {
  const subscription = shop.subscription;
  const [plan, setPlan] = useState(subscription.requested_plan ?? subscription.plan);
  const [status, setStatus] = useState(subscription.status);
  const [renewsOn, setRenewsOn] = useState(subscription.renews_on ?? '');

  useEffect(() => {
    setPlan(subscription.requested_plan ?? subscription.plan);
    setStatus(subscription.status);
    setRenewsOn(subscription.renews_on ?? '');
  }, [shop.id, subscription.plan, subscription.requested_plan, subscription.renews_on, subscription.status]);

  const requestedPlan = subscription.requested_plan
    ? getSubscriptionPlan(subscription.requested_plan)
    : null;

  return (
    <section className={`${adminPanelClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-[14px] font-black text-zinc-900 dark:text-zinc-100">{shop.name}</h4>
          <p className="mt-0.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">
            {shop.city || 'Ville non renseignée'} · {shop.email || shop.phone_display || 'Contact non renseigné'}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10.5px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {getSubscriptionPlan(subscription.plan).label} · {getSubscriptionStatusLabel(subscription.status)}
        </span>
      </div>

      {requestedPlan && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Demande {requestedPlan.label} à valider, déposée le {formatDate(subscription.requested_at)}.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-[11.5px] font-bold text-zinc-600 dark:text-zinc-300">
          Formule appliquée
          <select
            aria-label={`Formule appliquée pour ${shop.name}`}
            className={`${inputClass} mt-1`}
            value={plan}
            onChange={(event) => setPlan(event.target.value as typeof plan)}
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
        </label>
        <label className="text-[11.5px] font-bold text-zinc-600 dark:text-zinc-300">
          Statut de l’abonnement
          <select
            aria-label={`Statut de l’abonnement pour ${shop.name}`}
            className={`${inputClass} mt-1`}
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
          >
            <option value="essai">Essai</option>
            <option value="actif">Actif</option>
            <option value="suspendu">Suspendu</option>
          </select>
        </label>
        <label className="text-[11.5px] font-bold text-zinc-600 dark:text-zinc-300">
          Échéance facultative
          <input
            aria-label={`Échéance pour ${shop.name}`}
            type="date"
            className={`${inputClass} mt-1`}
            value={renewsOn}
            onChange={(event) => setRenewsOn(event.target.value)}
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={busy}
          onClick={() => onSave(shop, { plan, status, renewsOn: renewsOn || null })}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
          {requestedPlan ? `Valider ${requestedPlan.label}` : 'Appliquer l’abonnement'}
        </button>
      </div>
    </section>
  );
};

const OrganizationDetail: React.FC<{
  organization: PlatformAdminOrganization;
  busyKey: string | null;
  onSubscriptionSave: (
    shop: PlatformAdminShop,
    input: { plan: PlatformAdminShop['subscription']['plan']; status: PlatformAdminShop['subscription']['status']; renewsOn: string | null }
  ) => void;
  onStatusChange: (status: 'active' | 'suspended', note: string) => void;
  onSupportNote: (input: { shopId: string | null; category: PlatformSupportCategory; note: string }) => void;
}> = ({ organization, busyKey, onSubscriptionSave, onStatusChange, onSupportNote }) => {
  const [reason, setReason] = useState('');
  const [supportNote, setSupportNote] = useState('');
  const [supportCategory, setSupportCategory] = useState<PlatformSupportCategory>('support');
  const [supportShopId, setSupportShopId] = useState('');

  useEffect(() => {
    setReason('');
    setSupportNote('');
    setSupportCategory('support');
    setSupportShopId('');
  }, [organization.id]);

  return (
    <aside className="space-y-4 rounded-[24px] border border-zinc-200/80 bg-white p-4 shadow-[0_12px_35px_rgba(16,24,40,0.05)] dark:border-zinc-800 dark:bg-zinc-900 lg:sticky lg:top-24">
      <div className="rounded-[20px] border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:border-blue-950 dark:from-blue-950/40 dark:to-indigo-950/30">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9.5px] font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
              Compte client sélectionné
            </p>
            <h3 className="mt-1.5 break-words text-[19px] font-black tracking-tight text-zinc-950 dark:text-zinc-50">
              {organization.name}
            </h3>
          </div>
          <StatusBadge status={organization.status} />
        </div>
        <p className="mt-2 break-all text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {organization.owner?.display_name || 'Propriétaire non renseigné'} · {organization.owner?.email || 'E-mail indisponible'}
        </p>
      </div>

      <section className="rounded-[20px] border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <h4 className="flex items-center gap-2 text-[13px] font-black">
          {organization.status === 'suspended' ? <UnlockKeyhole className="h-4 w-4 text-blue-600" /> : <LockKeyhole className="h-4 w-4 text-blue-600" />}
          Accès du pressing
        </h4>
        <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Le verrouillage bloque les accès RLS de toute l’organisation. Il ne supprime ni les données ni les historiques.
        </p>
        {organization.status !== 'suspended' && (
          <label className="mt-3 block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-300">
            Motif du verrouillage
            <input
              aria-label="Motif du verrouillage"
              className={`${inputClass} mt-1`}
              value={reason}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex. paiement à vérifier, support…"
            />
          </label>
        )}
        <button
          type="button"
          className={`mt-3 w-full ${organization.status === 'suspended' ? primaryButtonClass : secondaryButtonClass}`}
          disabled={busyKey === 'status'}
          onClick={() => onStatusChange(organization.status === 'suspended' ? 'active' : 'suspended', reason)}
        >
          {busyKey === 'status' ? <Loader2 className="h-4 w-4 animate-spin" /> : organization.status === 'suspended' ? <UnlockKeyhole className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
          {organization.status === 'suspended' ? 'Réactiver le compte' : 'Verrouiller le compte'}
        </button>
      </section>

      <div className="space-y-3">
        <h4 className="text-[12px] font-black uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Agences et abonnements
        </h4>
        {organization.shops.map((shop) => (
          <SubscriptionEditor
            key={shop.id}
            shop={shop}
            busy={busyKey === `subscription-${shop.id}`}
            onSave={onSubscriptionSave}
          />
        ))}
      </div>

      <section className="rounded-[20px] border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <h4 className="flex items-center gap-2 text-[13px] font-black">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"><LifeBuoy className="h-4 w-4" /></span>
          Support technique interne
        </h4>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select
            aria-label="Catégorie de la note"
            className={inputClass}
            value={supportCategory}
            onChange={(event) => setSupportCategory(event.target.value as PlatformSupportCategory)}
          >
            <option value="support">Support</option>
            <option value="configuration">Configuration</option>
          </select>
          <select
            aria-label="Agence concernée par la note"
            className={inputClass}
            value={supportShopId}
            onChange={(event) => setSupportShopId(event.target.value)}
          >
            <option value="">Toute l’organisation</option>
            {organization.shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
          </select>
        </div>
        <textarea
          aria-label="Nouvelle note de support"
          className={`${inputClass} mt-2 min-h-24 resize-y`}
          value={supportNote}
          maxLength={4000}
          onChange={(event) => setSupportNote(event.target.value)}
          placeholder="Diagnostic, action menée, configuration à suivre…"
        />
        <button
          type="button"
          className={`${primaryButtonClass} mt-2 w-full`}
          disabled={busyKey === 'support'}
          onClick={() => onSupportNote({ shopId: supportShopId || null, category: supportCategory, note: supportNote })}
        >
          {busyKey === 'support' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LifeBuoy className="h-4 w-4" />}
          Ajouter la note interne
        </button>
        <ul className="mt-4 space-y-2">
          {organization.support_notes.map((note) => (
            <li key={note.id} className="rounded-xl bg-zinc-50 p-3 text-[11.5px] dark:bg-zinc-800/60">
              <div className="flex items-center justify-between gap-2 font-bold text-zinc-500 dark:text-zinc-400">
                <span>{note.category === 'support' ? 'Support' : 'Configuration'}</span>
                <time dateTime={note.created_at}>{formatDate(note.created_at)}</time>
              </div>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-200">{note.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
};

const GlobalConfigPanel: React.FC<{
  config: PlatformPublicConfig;
  busy: boolean;
  onSave: (config: Pick<PlatformPublicConfig, 'registrations_open' | 'support_message' | 'support_message_tone'>) => void;
}> = ({ config, busy, onSave }) => {
  const [registrationsOpen, setRegistrationsOpen] = useState(config.registrations_open);
  const [message, setMessage] = useState(config.support_message);
  const [tone, setTone] = useState(config.support_message_tone);

  useEffect(() => {
    setRegistrationsOpen(config.registrations_open);
    setMessage(config.support_message);
    setTone(config.support_message_tone);
  }, [config.registrations_open, config.support_message, config.support_message_tone]);

  return (
    <div className="space-y-5">
      <section className={`${adminPanelClass} flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5`} aria-label="Aperçu de la configuration">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-blue-600"><ShieldCheck className="h-5 w-5" /></span>
          <div>
            <h2 className="text-[14px] font-black">Aperçu avant enregistrement</h2>
            <p className="mt-0.5 text-[11.5px] text-zinc-500">Vérifiez les réglages, puis appliquez-les à toute la plateforme.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-black">
          <span className={`rounded-full px-3 py-1.5 ${registrationsOpen ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'}`}>{registrationsOpen ? 'Inscriptions ouvertes' : 'Inscriptions fermées'}</span>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{message.trim() ? 'Annonce active' : 'Aucune annonce'}</span>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section className={`${adminPanelClass} p-5`}>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"><Building2 className="h-5 w-5" /></span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">Acquisition</p>
              <h2 className="mt-0.5 text-[15px] font-black">Nouveaux pressings inscrits</h2>
            </div>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-zinc-500">Contrôle la création d’organisations, pas les comptes existants.</p>
          <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 transition hover:border-blue-200 dark:border-zinc-800 dark:bg-zinc-950/50">
            <span>
              <span className="block text-[13px] font-bold">Autoriser les nouvelles inscriptions</span>
              <span className="mt-1 block text-[11.5px] leading-relaxed text-zinc-500">La base refuse toute création lorsque ce réglage est fermé.</span>
            </span>
            <input
              type="checkbox"
              aria-label="Autoriser les nouvelles inscriptions"
              className="h-5 w-5 shrink-0 accent-blue-600"
              checked={registrationsOpen}
              onChange={(event) => setRegistrationsOpen(event.target.checked)}
            />
          </label>
          <div className="mt-4 rounded-2xl bg-blue-50/70 p-4 text-[11.5px] leading-relaxed text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
            Les comptes déjà enregistrés conservent leurs accès et leurs abonnements, quelle que soit cette option.
          </div>
        </section>

        <section className={`${adminPanelClass} p-5`}>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"><Globe2 className="h-5 w-5" /></span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400">Communication</p>
              <h2 className="mt-0.5 text-[15px] font-black">Annonce globale de support</h2>
            </div>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-zinc-500">Affichée dans l’ERP de tous les pressings à sa prochaine ouverture.</p>
          <label className="mt-4 block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-300">
            Message
            <textarea
              aria-label="Annonce globale de support"
              className={`${inputClass} mt-1.5 min-h-24 resize-y`}
              maxLength={500}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Laisser vide pour ne rien afficher."
            />
          </label>
          <label className="mt-3 block text-[11.5px] font-bold text-zinc-600 dark:text-zinc-300">
            Niveau
            <select aria-label="Niveau de l’annonce" className={`${inputClass} mt-1.5`} value={tone} onChange={(event) => setTone(event.target.value as typeof tone)}>
              <option value="info">Information</option>
              <option value="warning">Avertissement</option>
              <option value="critical">Critique</option>
            </select>
          </label>
          <div className={`mt-4 rounded-2xl border p-4 ${tone === 'critical' ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200' : tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200' : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200'}`}>
            <p className="text-[9px] font-black uppercase tracking-[0.14em] opacity-70">Aperçu dans l’ERP</p>
            <p className="mt-1.5 whitespace-pre-wrap text-[12px] font-semibold leading-relaxed">{message.trim() || 'Aucune annonce ne sera affichée.'}</p>
          </div>
        </section>
      </div>

      <div className={`${adminPanelClass} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <p className="text-[11px] leading-relaxed text-zinc-500">Les modifications sont enregistrées côté serveur et journalisées.</p>
        <button type="button" className={`${primaryButtonClass} w-full sm:w-auto`} disabled={busy} onClick={() => onSave({ registrations_open: registrationsOpen, support_message: message, support_message_tone: tone })}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
          Enregistrer la configuration globale
        </button>
      </div>
    </div>
  );
};

export const PlatformAdminPage: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const demo = resolvePlatformAdminAccessMode(getStaffAccessEnvironment(isSupabaseConfigured)) === 'explicit-local-demo';
  const [snapshot, setSnapshot] = useState<PlatformAdminSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tab, setTab] = useState<PlatformAdminTab>('accounts');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const mobileSidebarRef = useRef<HTMLDivElement>(null);
  const mobileSidebarTriggerRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PlatformAccountFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchPlatformAdminSnapshot());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger les comptes clients.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [tab]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    const desktopMedia = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileSidebarOpen(false);
    };
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const buttons = mobileSidebarRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyboard);
    desktopMedia.addEventListener('change', closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyboard);
      desktopMedia.removeEventListener('change', closeOnDesktop);
      const trigger = mobileSidebarTriggerRef.current;
      if (trigger?.getClientRects().length) trigger.focus();
    };
  }, [mobileSidebarOpen]);

  const runAction = async (
    key: string,
    action: () => Promise<PlatformAdminSnapshot>,
    success: string,
    after?: () => void
  ) => {
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    setFeedback(null);
    try {
      setSnapshot(await action());
      setFeedback(success);
      after?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'L’action d’administration a échoué.');
    } finally {
      setBusyKey(null);
    }
  };

  const organizations = snapshot?.organizations ?? [];
  const metrics = getPlatformAdminMetrics(organizations);
  const visibleOrganizations = useMemo(
    () => filterPlatformAdminOrganizations(organizations, query, filter),
    [organizations, query, filter]
  );
  const selected = organizations.find((organization) => organization.id === selectedId) ?? null;

  const signOut = async () => {
    if (demo) {
      onNavigate('/');
      return;
    }
    if (supabase) await supabase.auth.signOut();
  };

  const changeTab = (nextTab: PlatformAdminTab) => {
    setError(null);
    setFeedback(null);
    setTab(nextTab);
    setMobileSidebarOpen(false);
  };

  const pageCopy = PAGE_COPY[tab];
  const PageIcon = pageCopy.icon;

  return (
    <div className="min-h-screen bg-[#f5f7fb] font-sans text-zinc-900 antialiased lg:flex dark:bg-zinc-950 dark:text-zinc-100">
      {sidebarVisible && (
        <div className="hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:shrink-0">
          <PlatformAdminSidebar id="platform-admin-sidebar-desktop" activeTab={tab} onChange={changeTab} pendingCount={metrics.pending} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/95 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="flex min-h-[72px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="lg:hidden">
                <button
                  ref={mobileSidebarTriggerRef}
                  type="button"
                  aria-label="Afficher la sidebar"
                  aria-expanded={mobileSidebarOpen}
                  aria-controls="platform-admin-sidebar-mobile"
                  className={secondaryButtonClass}
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Sidebar</span>
                </button>
              </div>
              <div className="hidden lg:block">
                <button
                  type="button"
                  aria-label={sidebarVisible ? 'Masquer la sidebar' : 'Afficher la sidebar'}
                  aria-expanded={sidebarVisible}
                  aria-controls="platform-admin-sidebar-desktop"
                  title={sidebarVisible ? 'Masquer la sidebar' : 'Afficher la sidebar'}
                  className={secondaryButtonClass}
                  onClick={() => setSidebarVisible((visible) => !visible)}
                >
                  {sidebarVisible ? <PanelLeftClose className="h-4 w-4" aria-hidden="true" /> : <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />}
                  {sidebarVisible ? 'Masquer la sidebar' : 'Afficher la sidebar'}
                </button>
              </div>
              <div className="min-w-0">
                <p className="hidden text-[8.5px] font-black uppercase tracking-[0.18em] text-blue-600 sm:block dark:text-blue-400">PressingPro CI · éditeur</p>
                <h1 className="truncate text-[16px] font-black tracking-tight sm:text-[17px]">Administration plateforme</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-[9.5px] font-black uppercase tracking-[0.08em] text-red-700 xl:inline-flex dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />Super-admin unique</span>
              {demo && <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10.5px] font-bold text-amber-800 sm:inline dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">Données fictives</span>}
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
              </button>
              <button type="button" aria-label={demo ? 'Quitter la console' : 'Se déconnecter'} className={secondaryButtonClass} onClick={() => void signOut()}>
                <LogOut className="h-4 w-4" /><span className="hidden md:inline">{demo ? 'Quitter la console' : 'Se déconnecter'}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-600 shadow-sm sm:flex dark:border-blue-950 dark:bg-zinc-900 dark:text-blue-400"><PageIcon className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">{pageCopy.eyebrow}</p>
                <h2 className="mt-1 text-[24px] font-black tracking-[-0.025em] text-zinc-950 sm:text-[28px] dark:text-zinc-50">{pageCopy.title}</h2>
                <p className="mt-1.5 max-w-3xl text-[12px] leading-relaxed text-zinc-500 sm:text-[12.5px] dark:text-zinc-400">{pageCopy.description}</p>
              </div>
            </div>
            <span className="hidden shrink-0 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700 xl:inline-flex dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" />Données métier exclues</span>
          </div>

        {(error || feedback) && (
          <div aria-live="polite" className={`mt-4 rounded-xl border px-4 py-3 text-[12.5px] font-semibold ${error ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>
            {error || feedback}
          </div>
        )}

        {loading && !snapshot ? (
          <div role="status" className="flex items-center justify-center gap-2 py-24 text-[13px] font-semibold text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement des comptes clients…
          </div>
        ) : snapshot && tab === 'operations' ? (
          <PlatformOperationsCenter organizations={snapshot.organizations} />
        ) : snapshot && tab === 'config' ? (
          <div className="mt-6">
            <GlobalConfigPanel
              config={snapshot.config}
              busy={busyKey === 'config'}
              onSave={(config) => void runAction('config', () => adminUpdatePlatformConfig(config), 'Configuration globale enregistrée.')}
            />
          </div>
        ) : snapshot ? (
          <>
            <section aria-label="Synthèse des comptes" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Pressings clients', value: metrics.organizations, detail: `${metrics.shops} agence(s)`, icon: Building2, iconClass: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400' },
                { label: 'Comptes actifs', value: metrics.active, detail: 'accès autorisés', icon: CheckCircle2, iconClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' },
                { label: 'À valider', value: metrics.pending, detail: 'demande(s) de formule', icon: ClipboardCheck, iconClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400' },
                { label: 'Verrouillés', value: metrics.suspended, detail: 'accès RLS fermés', icon: LockKeyhole, iconClass: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400' },
              ].map((metric) => (
                <article key={metric.label} className={`${adminPanelClass} p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md`}>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${metric.iconClass}`}><metric.icon className="h-[18px] w-[18px]" /></span>
                  <p className="mt-4 text-[28px] font-black leading-none tracking-tight tabular-nums">{metric.value}</p>
                  <h3 className="mt-2 text-[12px] font-black">{metric.label}</h3>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-zinc-500">{metric.detail}</p>
                </article>
              ))}
            </section>

            <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)]">
              <section aria-label="Liste des pressings clients" className={`${adminPanelClass} min-w-0 overflow-hidden`}>
                <div className="border-b border-zinc-100 p-4 sm:p-5 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">Gestion des accès</p>
                      <h3 className="mt-1 text-[16px] font-black tracking-tight">Portefeuille clients</h3>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-[10px] font-black text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{visibleOrganizations.length} / {organizations.length} compte(s)</span>
                  </div>
                  <label className="relative mt-4 block">
                    <span className="sr-only">Rechercher un compte client</span>
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input aria-label="Rechercher un compte client" className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pressing, agence, propriétaire, ville…" />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Filtrer les comptes clients">
                    {([
                      ['all', 'Tous'],
                      ['pending', 'À valider'],
                      ['active', 'Actifs'],
                      ['suspended', 'Verrouillés'],
                    ] as const).map(([id, label]) => (
                      <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition ${filter === id ? 'bg-blue-600 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <ul className="space-y-2 p-3">
                  {visibleOrganizations.map((organization) => {
                    const pending = organization.shops.filter((shop) => shop.subscription.requested_plan).length;
                    return (
                      <li key={organization.id}>
                        <button
                          type="button"
                          aria-label={`Gérer ${organization.name}`}
                          onClick={() => setSelectedId(organization.id)}
                          className={`group relative w-full rounded-2xl border p-4 pl-[52px] text-left transition duration-200 ${selectedId === organization.id ? 'border-blue-300 bg-blue-50/80 shadow-sm ring-4 ring-blue-600/5 dark:border-blue-800 dark:bg-blue-950/30' : 'border-transparent bg-zinc-50/80 hover:border-blue-200 hover:bg-white hover:shadow-md dark:bg-zinc-950/40 dark:hover:border-blue-900 dark:hover:bg-zinc-950/70'}`}
                        >
                          <span className={`absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-black ${selectedId === organization.id ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 shadow-sm dark:bg-zinc-800 dark:text-blue-400'}`}>{organization.name.trim().charAt(0).toUpperCase() || 'P'}</span>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-[15px] font-black">{organization.name}</h3>
                                <StatusBadge status={organization.status} />
                              </div>
                              <p className="mt-1 truncate text-[11.5px] text-zinc-500">{organization.owner?.display_name || 'Propriétaire non renseigné'} · {organization.owner?.email || 'contact indisponible'}</p>
                            </div>
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-zinc-400"><span className="hidden sm:inline">Inscrit le {formatDate(organization.created_at)}</span><ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:text-blue-600" /></span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] font-semibold text-zinc-600 dark:text-zinc-300">
                            <span className="inline-flex items-center gap-1.5"><Store className="h-3.5 w-3.5" />{organization.shops.length} agence(s)</span>
                            <span className="inline-flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5" />{organization.shops.map((shop) => getSubscriptionPlan(shop.subscription.plan).label).join(' · ') || 'Sans formule'}</span>
                            {pending > 0 && <span className="rounded-full bg-amber-100 px-2 py-1 font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">{pending} demande(s) à valider</span>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                  {visibleOrganizations.length === 0 && (
                    <li className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-[13px] text-zinc-500 dark:border-zinc-700">Aucun compte ne correspond à cette recherche.</li>
                  )}
                </ul>
              </section>

              {selected ? (
                <OrganizationDetail
                  organization={selected}
                  busyKey={busyKey}
                  onSubscriptionSave={(shop, input) => void runAction(`subscription-${shop.id}`, () => adminSetShopSubscription({ shopId: shop.id, ...input }), `Abonnement de ${shop.name} appliqué.`)}
                  onStatusChange={(status, note) => {
                    if (status === 'suspended' && !window.confirm(`Verrouiller ${selected.name} et fermer ses accès ?`)) return;
                    void runAction('status', () => adminSetOrganizationStatus(selected.id, status, note), status === 'suspended' ? 'Compte verrouillé : les accès RLS sont fermés.' : 'Compte réactivé.');
                  }}
                  onSupportNote={(input) => void runAction('support', () => adminAddSupportNote({ organizationId: selected.id, ...input }), 'Note de support interne ajoutée.')}
                />
              ) : (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[24px] border border-dashed border-blue-200 bg-white/80 p-6 text-center shadow-sm sm:p-10 dark:border-blue-950 dark:bg-zinc-900/70">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"><ShieldCheck className="h-7 w-7" /></span>
                  <h3 className="mt-4 text-[15px] font-black">Sélectionnez un compte client</h3>
                  <p className="mt-1.5 max-w-sm text-[12px] leading-relaxed text-zinc-500">Validez ses formules, gérez son accès ou consignez une intervention technique.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <p className="text-[13px] font-bold">La console n’a pas pu être chargée.</p>
            <button type="button" className={`${secondaryButtonClass} mt-3`} onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Réessayer</button>
          </div>
        )}
        </main>
      </div>

      {mobileSidebarOpen && (
        <div role="dialog" aria-modal="true" aria-label="Menu de l’administration" className="fixed inset-0 z-50 lg:hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <div ref={mobileSidebarRef} className="absolute inset-y-0 left-0 w-[272px] max-w-[85vw] shadow-2xl">
            <PlatformAdminSidebar
              id="platform-admin-sidebar-mobile"
              activeTab={tab}
              onChange={changeTab}
              pendingCount={metrics.pending}
              onClose={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
