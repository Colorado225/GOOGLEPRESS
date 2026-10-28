import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  Building2,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  LogOut,
  PackageCheck,
  Phone,
  RadioTower,
  RefreshCw,
  Save,
  ShieldCheck,
  Truck,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Badge, type BadgeVariant } from '../common/DataTable';
import { formatFCFA } from '../../data/demoData';
import { formatLongDateTime, formatPromisedLong, parseStoredDateTime } from '../../lib/dates';
import {
  CUSTOMER_LOGIN_PATH,
  getMetadataString,
  mapSupabaseAuthError,
  normalizePhoneToE164,
} from '../../lib/customerAuth';
import {
  formatLogisticsSchedule,
  LOGISTICS_STATUS_LABELS,
} from '../../lib/logistics';
import {
  getOrderEventActorLabel,
  getOrderEventLabel,
  getOrderEventNote,
  getOrderProgressPercent,
  getOrderStatusRank,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_SEQUENCE,
  ORDER_TRACKING_STEP_LABELS,
} from '../../lib/orderTracking';
import { supabase } from '../../lib/supabase';
import {
  getCustomerProfile,
  listCustomerAccountLinks,
  listLinkedCustomers,
  listLinkedOrganizations,
  updateCustomerProfile,
  type CustomerAccountLink,
  type CustomerProfile,
  type LinkedCustomer,
  type LinkedOrganization,
} from '../../lib/supabaseCustomer';
import {
  listAccessibleShops,
  listCurrentMemberships,
  listRemoteOrderEvents,
  loadRemoteOrderTrackingSnapshot,
  subscribeToRemoteOrderTracking,
  type RemoteLogisticsTask,
  type RemoteMembership,
  type RemoteOrder,
  type RemoteOrderEvent,
  type RemoteShop,
  type RemoteTrackingRealtimeStatus,
} from '../../lib/supabaseOrders';
import {
  CustomerFormAlerts,
  customerInputClassName,
  customerSecondaryButtonClassName,
  type CustomerNavigate,
} from './CustomerAuthLayout';
import type { LogisticsTaskStatus, LogisticsTimeSlot, OrderStatus } from '../../types';

const ORDER_BADGE_VARIANTS: Record<OrderStatus, BadgeVariant> = {
  received: 'secondary',
  washing: 'info',
  ironing: 'warning',
  ready: 'purple',
  delivered: 'success',
};

const LOGISTICS_BADGE_VARIANTS: Record<LogisticsTaskStatus, BadgeVariant> = {
  scheduled: 'secondary',
  en_route: 'info',
  completed: 'success',
  failed: 'destructive',
  cancelled: 'outline',
};

const REALTIME_LABELS: Record<RemoteTrackingRealtimeStatus, string> = {
  idle: 'Suivi temps réel non démarré',
  connecting: 'Connexion au suivi…',
  subscribed: 'Suivi temps réel connecté',
  closed: 'Suivi temps réel fermé',
  error: 'Suivi temps réel en erreur',
};

const formatRemoteDateTime = (value: string | null | undefined): string => {
  const date = parseStoredDateTime(value);
  return date ? formatLongDateTime(date) : 'Non renseigné';
};

const formatPromisedDate = (value: string): string => {
  const date = parseStoredDateTime(value);
  return date ? formatPromisedLong(date) : 'Non renseigné';
};

const getTicketLabel = (order: RemoteOrder): string =>
  order.ticket_label ?? `#TK-${order.ticket_number}`;

const getRemainingBalance = (order: RemoteOrder): number =>
  order.remaining_balance_xof ?? Math.max(0, order.total_xof - order.deposit_paid_xof);

const getLinesSummary = (order: RemoteOrder): string => {
  const lines: unknown = order.lines;
  if (!Array.isArray(lines)) return 'Articles non détaillés';
  const parts = lines
    .filter(
      (line): line is Record<string, unknown> =>
        Boolean(line && typeof line === 'object' && !Array.isArray(line))
    )
    .map((line) => {
      const name = typeof line.name === 'string' ? line.name : 'Article';
      const quantity = typeof line.quantity === 'number' ? line.quantity : null;
      const color = typeof line.color === 'string' && line.color ? ` (${line.color})` : '';
      return `${quantity && quantity > 1 ? `${quantity} × ` : ''}${name}${color}`;
    });
  return parts.length > 0 ? parts.join(' • ') : 'Articles non détaillés';
};

const isLogisticsTimeSlot = (value: string): value is LogisticsTimeSlot =>
  value === '08:00-10:00' ||
  value === '10:00-12:00' ||
  value === '14:00-16:00' ||
  value === '16:00-18:00' ||
  value === '18:00-20:00';

const formatTaskSchedule = (task: RemoteLogisticsTask): string =>
  isLogisticsTimeSlot(task.time_slot)
    ? formatLogisticsSchedule(task.scheduled_date, task.time_slot)
    : `${task.scheduled_date} • Créneau non renseigné`;

interface CustomerAccountPageProps {
  session: Session;
  onNavigate: CustomerNavigate;
}

export const CustomerAccountPage: React.FC<CustomerAccountPageProps> = ({
  session,
  onNavigate,
}) => {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [links, setLinks] = useState<CustomerAccountLink[]>([]);
  const [customers, setCustomers] = useState<LinkedCustomer[]>([]);
  const [organizations, setOrganizations] = useState<LinkedOrganization[]>([]);
  const [memberships, setMemberships] = useState<RemoteMembership[]>([]);
  const [shops, setShops] = useState<RemoteShop[]>([]);
  const [orders, setOrders] = useState<RemoteOrder[]>([]);
  const [tasks, setTasks] = useState<RemoteLogisticsTask[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [events, setEvents] = useState<RemoteOrderEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] =
    useState<RemoteTrackingRealtimeStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const loadSequenceRef = useRef(0);
  const profileFormInitializedRef = useRef(false);

  const metadataName = getMetadataString(session.user.user_metadata, ['full_name', 'name']);
  const metadataPhone = getMetadataString(session.user.user_metadata, ['phone_e164', 'phone']);

  const loadAccount = useCallback(
    async (showSpinner = true, syncProfileForm = false): Promise<void> => {
      if (!supabase) return;
      const sequence = ++loadSequenceRef.current;
      if (showSpinner) setLoading(true);

      try {
        const [profileRow, linkRows, membershipRows] = await Promise.all([
          getCustomerProfile(session.user.id),
          listCustomerAccountLinks(session.user.id),
          listCurrentMemberships(session.user.id),
        ]);
        if (sequence !== loadSequenceRef.current) return;

        const customerIds = [...new Set(linkRows.map((link) => link.customer_id))];
        const organizationIds = [...new Set(linkRows.map((link) => link.organization_id))];
        const [customerRows, organizationRows, snapshot, shopRows] = await Promise.all([
          listLinkedCustomers(customerIds),
          listLinkedOrganizations(organizationIds),
          customerIds.length > 0
            ? loadRemoteOrderTrackingSnapshot(null)
            : Promise.resolve({ orders: [] as RemoteOrder[], logisticsTasks: [] as RemoteLogisticsTask[] }),
          customerIds.length > 0 ? listAccessibleShops() : Promise.resolve([] as RemoteShop[]),
        ]);
        if (sequence !== loadSequenceRef.current) return;

        const customerIdSet = new Set(customerIds);
        const visibleOrders = snapshot.orders.filter((order) =>
          customerIdSet.has(order.customer_id)
        );
        const visibleOrderIds = new Set(visibleOrders.map((order) => order.id));
        const visibleTasks = snapshot.logisticsTasks.filter(
          (task) => task.order_id && visibleOrderIds.has(task.order_id)
        );

        setProfile(profileRow);
        setLinks(linkRows);
        setCustomers(customerRows);
        setOrganizations(organizationRows);
        setMemberships(membershipRows);
        setShops(shopRows);
        setOrders(visibleOrders);
        setTasks(visibleTasks);
        setSelectedOrderId((current) =>
          current && visibleOrderIds.has(current)
            ? current
            : visibleOrders[0]?.id ?? null
        );
        setLastSyncAt(new Date());
        setError(null);

        if (syncProfileForm || !profileFormInitializedRef.current) {
          setProfileName(profileRow?.display_name ?? metadataName ?? '');
          setProfilePhone(profileRow?.phone_e164 ?? metadataPhone ?? session.user.phone ?? '');
          profileFormInitializedRef.current = true;
        }
      } catch (loadError: unknown) {
        if (sequence !== loadSequenceRef.current) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Votre espace client n’a pas pu être chargé.'
        );
      } finally {
        if (showSpinner && sequence === loadSequenceRef.current) setLoading(false);
      }
    },
    [metadataName, metadataPhone, session.user.id, session.user.phone]
  );

  useEffect(() => {
    void loadAccount(true, true);
  }, [loadAccount]);

  useEffect(() => {
    if (!supabase) return;
    return subscribeToRemoteOrderTracking({
      onChange: () => {
        void loadAccount(false, false).then(() => {
          setEventsRefreshKey((key) => key + 1);
        });
      },
      onStatus: setRealtimeStatus,
    });
  }, [loadAccount]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  useEffect(() => {
    if (!supabase || !selectedOrderId) {
      setEvents([]);
      setEventsLoading(false);
      return;
    }

    let cancelled = false;
    setEventsLoading(true);
    listRemoteOrderEvents(selectedOrderId)
      .then((nextEvents) => {
        if (!cancelled) {
          // Double protection côté interface : le portail client ne montre
          // jamais un événement interne, même avec un compte mixte équipe.
          setEvents(nextEvents.filter((event) => event.visibility === 'customer'));
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'L’historique de cette commande n’a pas pu être chargé.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventsRefreshKey, selectedOrder?.updated_at, selectedOrderId]);

  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );
  const organizationsById = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization])),
    [organizations]
  );
  const shopsById = useMemo(() => new Map(shops.map((shop) => [shop.id, shop])), [shops]);
  const tasksByOrderId = useMemo(() => {
    const map = new Map<string, RemoteLogisticsTask[]>();
    for (const task of tasks) {
      if (!task.order_id) continue;
      const current = map.get(task.order_id) ?? [];
      current.push(task);
      map.set(task.order_id, current);
    }
    return map;
  }, [tasks]);

  const hasStaffMembership = memberships.some((membership) => membership.status === 'active');
  const accountDisplayName = profile?.display_name ?? metadataName ?? session.user.email ?? 'Mon compte';
  const selectedTasks = selectedOrder ? tasksByOrderId.get(selectedOrder.id) ?? [] : [];

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || savingProfile) return;

    const phoneE164 = normalizePhoneToE164(profilePhone);
    if (profileName.trim().length < 2) {
      setError('Saisissez votre nom complet.');
      setMessage(null);
      return;
    }
    if (!phoneE164) {
      setError('Saisissez un numéro valide, par exemple 07 00 00 00 00.');
      setMessage(null);
      return;
    }

    setSavingProfile(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateCustomerProfile({
        userId: session.user.id,
        displayName: profileName,
        phoneE164,
      });
      setProfile(updated);
      setProfileName(updated.display_name ?? profileName);
      setProfilePhone(updated.phone_e164 ?? phoneE164);
      setMessage(
        'Coordonnées enregistrées. Le pressing devra toujours vérifier ce numéro avant de relier ou modifier la liaison de vos commandes.'
      );
    } catch (saveError: unknown) {
      setError(mapSupabaseAuthError(saveError));
    } finally {
      setSavingProfile(false);
    }
  };

  const signOut = async () => {
    if (!supabase || signingOut) return;
    setSigningOut(true);
    const { error: signOutError } = await supabase.auth.signOut();
    setSigningOut(false);
    if (signOutError) {
      setError(mapSupabaseAuthError(signOutError));
      return;
    }
    onNavigate(CUSTOMER_LOGIN_PATH, { replace: true });
  };

  return (
    <main className="min-h-screen bg-[#f4f4f5] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white/95 dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#09090b] text-lg font-black text-white dark:bg-zinc-100 dark:text-zinc-950">
              P
            </span>
            <div>
              <p className="text-[15px] font-black leading-tight">PressingPro CI</p>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Mon espace client</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                realtimeStatus === 'subscribed'
                  ? 'success'
                  : realtimeStatus === 'error'
                    ? 'destructive'
                    : 'warning'
              }
            >
              <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
              {REALTIME_LABELS[realtimeStatus]}
            </Badge>
            <button
              type="button"
              onClick={() => {
                void loadAccount(true, true);
                setEventsRefreshKey((key) => key + 1);
              }}
              disabled={loading}
              className={customerSecondaryButtonClassName}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              Actualiser
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={signingOut}
              className={customerSecondaryButtonClassName}
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden="true" />
              )}
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <section className="rounded-3xl bg-[#09090b] p-6 text-white shadow-xl shadow-zinc-950/10">
          <p className="text-[12px] font-black uppercase tracking-[0.18em] text-teal-300">
            Bienvenue
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
            {accountDisplayName}
          </h1>
          <p className="mt-2 text-[13.5px] text-zinc-300">
            {session.user.email ?? 'Compte connecté'}
            {lastSyncAt
              ? ` · Dernière lecture à ${new Intl.DateTimeFormat('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }).format(lastSyncAt)}`
              : ''}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="info">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              {links.length} fiche(s) client liée(s)
            </Badge>
            <Badge variant="purple">
              <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {orders.length} commande(s) visible(s)
            </Badge>
            {hasStaffMembership && (
              <Badge variant="warning">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Ce compte possède aussi un rôle équipe
              </Badge>
            )}
          </div>
        </section>

        <CustomerFormAlerts error={error} message={message} />

        {loading && !profile && links.length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-5 text-[13.5px] font-semibold text-zinc-600 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden="true" />
            Chargement de votre espace client…
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="flex items-center gap-2 text-[15px] font-black">
                  <UserRound className="h-5 w-5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                  Mes coordonnées
                </h2>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Le numéro doit être exactement celui communiqué au pressing.
                  Il est déclaré ici, puis vérifié par l’équipe avant liaison.
                </p>
                <form onSubmit={(event) => void saveProfile(event)} className="mt-4 space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="customer-profile-name"
                      className="mb-1.5 block text-[12px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
                    >
                      Nom complet
                    </label>
                    <input
                      id="customer-profile-name"
                      type="text"
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                      autoComplete="name"
                      disabled={savingProfile}
                      className={customerInputClassName}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="customer-profile-phone"
                      className="mb-1.5 block text-[12px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
                    >
                      Téléphone des dépôts
                    </label>
                    <input
                      id="customer-profile-phone"
                      type="tel"
                      value={profilePhone}
                      onChange={(event) => setProfilePhone(event.target.value)}
                      autoComplete="tel"
                      inputMode="tel"
                      disabled={savingProfile}
                      className={customerInputClassName}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className={`${customerSecondaryButtonClassName} w-full`}
                  >
                    {savingProfile ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="h-4 w-4" aria-hidden="true" />
                    )}
                    Enregistrer mes coordonnées
                  </button>
                </form>
              </section>

              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="flex items-center gap-2 text-[15px] font-black">
                  <Building2 className="h-5 w-5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                  Pressings liés à mon compte
                </h2>

                {links.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                    <p className="font-black">Liaison en attente de vérification</p>
                    <p className="mt-1.5">
                      Aucune fiche client n’est encore reliée à ce compte.
                      Présentez au pressing l’e-mail du compte et le numéro
                      enregistré ci-contre ; après contrôle, l’équipe pourra
                      activer la liaison et vos commandes apparaîtront ici.
                    </p>
                    <p className="mt-2 flex items-center gap-2 font-semibold">
                      <Phone className="h-4 w-4" aria-hidden="true" />
                      {profile?.phone_e164 ?? metadataPhone ?? 'Numéro non renseigné'}
                    </p>
                    {hasStaffMembership && (
                      <p className="mt-3 border-t border-amber-200 pt-3 dark:border-amber-800">
                        Ce compte possède un rôle équipe : utilisez
                        l’application métier pour le travail du pressing, et
                        cet espace uniquement pour vos commandes personnelles liées.
                      </p>
                    )}
                  </div>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {links.map((link) => {
                      const customer = customersById.get(link.customer_id);
                      const organization = organizationsById.get(link.organization_id);
                      return (
                        <li
                          key={link.id}
                          className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-black text-zinc-950 dark:text-zinc-50">
                                {organization?.name ?? 'Pressing lié'}
                              </p>
                              <p className="mt-0.5 text-[12.5px] text-zinc-500 dark:text-zinc-400">
                                Fiche : {customer?.full_name ?? 'Nom non renseigné'} ·{' '}
                                {customer?.phone_display ?? link.verified_phone_e164}
                              </p>
                            </div>
                            <Badge variant="success" size="sm">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Numéro vérifié
                            </Badge>
                          </div>
                          {customer && (
                            <p className="mt-2 text-[12.5px] font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">
                              {customer.deposits_count} dépôt(s) · Solde de la fiche :{' '}
                              {formatFCFA(customer.balance_xof)}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            {links.length > 0 && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="flex items-center gap-2 text-[15px] font-black">
                    <PackageCheck className="h-5 w-5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                    Mes commandes
                  </h2>

                  {orders.length === 0 ? (
                    <p className="mt-4 rounded-2xl bg-zinc-50 px-4 py-5 text-center text-[13px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      Aucune commande distante n’est encore visible pour les
                      fiches liées à ce compte.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {orders.map((order) => {
                        const shop = shopsById.get(order.shop_id);
                        const orderTasks = tasksByOrderId.get(order.id) ?? [];
                        const latestTask = orderTasks[0];
                        const remaining = getRemainingBalance(order);
                        const selected = selectedOrderId === order.id;
                        return (
                          <li
                            key={order.id}
                            className={`rounded-2xl border p-4 transition ${
                              selected
                                ? 'border-blue-300 bg-blue-50/70 dark:border-blue-700 dark:bg-blue-950/30'
                                : 'border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800'
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-black text-zinc-950 dark:text-zinc-50">
                                  {getTicketLabel(order)}
                                  {shop ? ` · ${shop.name}` : ''}
                                </p>
                                <p className="mt-0.5 text-[12.5px] text-zinc-500 dark:text-zinc-400">
                                  {getLinesSummary(order)}
                                </p>
                              </div>
                              <Badge variant={ORDER_BADGE_VARIANTS[order.status]}>
                                {ORDER_STATUS_LABELS[order.status]}
                              </Badge>
                            </div>

                            <div className="mt-4" aria-label={`Progression : ${ORDER_STATUS_LABELS[order.status]}`}>
                              <div className="grid grid-cols-5 gap-1.5" aria-hidden="true">
                                {ORDER_STATUS_SEQUENCE.map((status) => (
                                  <div key={status} className="min-w-0 text-center">
                                    <div
                                      className={`h-2 rounded-full ${
                                        getOrderStatusRank(status) <= getOrderStatusRank(order.status)
                                          ? 'bg-blue-600 dark:bg-blue-400'
                                          : 'bg-zinc-200 dark:bg-zinc-700'
                                      }`}
                                    />
                                    <p className="mt-1 truncate text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                                      {ORDER_TRACKING_STEP_LABELS[status]}
                                    </p>
                                  </div>
                                ))}
                              </div>
                              <p className="mt-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                                Production : {getOrderProgressPercent(order.status)} %
                              </p>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-zinc-600 dark:text-zinc-300">
                              <span className="inline-flex items-center gap-1.5">
                                <Clock3 className="h-4 w-4" aria-hidden="true" />
                                Promis : {formatPromisedDate(order.promised_at)}
                              </span>
                              <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
                                <Wallet className="h-4 w-4" aria-hidden="true" />
                                {remaining > 0 ? `Reste ${formatFCFA(remaining)}` : 'Soldée'}
                              </span>
                              {latestTask ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Truck className="h-4 w-4" aria-hidden="true" />
                                  {latestTask.kind === 'pickup' ? 'Ramassage' : 'Livraison'} :{' '}
                                  {LOGISTICS_STATUS_LABELS[latestTask.status]} ·{' '}
                                  {formatTaskSchedule(latestTask)}
                                </span>
                              ) : (
                                <span>
                                  {order.fulfillment_method === 'home_delivery'
                                    ? 'Livraison à domicile prévue'
                                    : 'Retrait au comptoir'}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedOrderId(order.id)}
                              aria-pressed={selected}
                              className={`${customerSecondaryButtonClassName} mt-4`}
                            >
                              <History className="h-4 w-4" aria-hidden="true" />
                              Voir l’historique
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="flex items-center gap-2 text-[15px] font-black">
                    <History className="h-5 w-5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                    Historique de suivi
                  </h2>

                  {!selectedOrder ? (
                    <p className="mt-4 text-[13px] text-zinc-500 dark:text-zinc-400">
                      Sélectionnez une commande pour voir ses étapes.
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-[12.5px] font-semibold text-zinc-500 dark:text-zinc-400">
                        {getTicketLabel(selectedOrder)} · Dernière mise à jour :{' '}
                        {formatRemoteDateTime(selectedOrder.updated_at)}
                      </p>

                      {selectedTasks.length > 0 && (
                        <div className="mt-4 rounded-2xl bg-zinc-50 p-3.5 dark:bg-zinc-800">
                          <p className="flex items-center gap-2 text-[12.5px] font-black text-zinc-800 dark:text-zinc-100">
                            <Truck className="h-4 w-4" aria-hidden="true" />
                            Logistique, séparée de la production
                          </p>
                          <ul className="mt-2 space-y-2">
                            {selectedTasks.map((task) => (
                              <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                                <span>
                                  {task.kind === 'pickup' ? 'Ramassage' : 'Livraison'} ·{' '}
                                  {formatTaskSchedule(task)}
                                </span>
                                <Badge variant={LOGISTICS_BADGE_VARIANTS[task.status]} size="sm">
                                  {LOGISTICS_STATUS_LABELS[task.status]}
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {eventsLoading ? (
                        <p className="mt-5 flex items-center gap-2 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Chargement de l’historique…
                        </p>
                      ) : events.length === 0 ? (
                        <p className="mt-5 rounded-2xl bg-zinc-50 px-4 py-4 text-[13px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          Aucun événement visible pour cette commande.
                        </p>
                      ) : (
                        <ol className="mt-5 space-y-4">
                          {events.map((event, index) => {
                            const note = getOrderEventNote(event.payload);
                            return (
                              <li key={event.id} className="relative flex gap-3">
                                {index < events.length - 1 && (
                                  <span
                                    className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-px bg-zinc-200 dark:bg-zinc-700"
                                    aria-hidden="true"
                                  />
                                )}
                                <span className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-white bg-blue-600 shadow-sm dark:border-zinc-900" />
                                <div className="min-w-0">
                                  <p className="text-[13px] font-black text-zinc-950 dark:text-zinc-50">
                                    {getOrderEventLabel(event)}
                                  </p>
                                  <p className="mt-0.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                                    {formatRemoteDateTime(event.created_at)} ·{' '}
                                    {getOrderEventActorLabel(event.actor_type)}
                                  </p>
                                  {note && (
                                    <p className="mt-1.5 rounded-lg bg-zinc-50 px-2.5 py-2 text-[12.5px] leading-relaxed text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                                      {note}
                                    </p>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
};
