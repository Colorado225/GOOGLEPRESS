import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  History,
  Loader2,
  MapPin,
  PackageCheck,
  RadioTower,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  Wallet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import {
  Badge,
  Frame,
  FramePanel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type BadgeVariant,
} from '../common/DataTable';
import { formatLongDateTime, formatPromisedLong, parseStoredDateTime } from '../../lib/dates';
import {
  formatLogisticsSchedule,
  LOGISTICS_STATUS_LABELS,
} from '../../lib/logistics';
import {
  canMembershipTransitionOrder,
  getOrderEventActorLabel,
  getOrderEventLabel,
  getOrderEventNote,
  getOrderProgressPercent,
  getOrderStatusRank,
  getProductionTransitionTargets,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_SEQUENCE,
  ORDER_TRACKING_STEP_LABELS,
  upsertByUpdatedAt,
  type OrderEventVisibility,
} from '../../lib/orderTracking';
import {
  listAccessibleShops,
  listCurrentMemberships,
  listRemoteOrderEvents,
  loadRemoteOrderTrackingSnapshot,
  subscribeToRemoteOrderTracking,
  transitionRemoteOrderStatus,
  type RemoteLogisticsTask,
  type RemoteMembership,
  type RemoteOrder,
  type RemoteOrderEvent,
  type RemoteOrderTrackingSnapshot,
  type RemoteShop,
  type RemoteTrackingRealtimeStatus,
} from '../../lib/supabaseOrders';
import { supabase } from '../../lib/supabase';
import { normalizeText } from '../../lib/utils';
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
  idle: 'Realtime non démarré',
  connecting: 'Realtime : connexion…',
  subscribed: 'Realtime connecté',
  closed: 'Realtime fermé',
  error: 'Realtime en erreur',
};

const inputClassName =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[13px] text-zinc-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:ring-zinc-100 dark:disabled:bg-zinc-800';

const secondaryButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-[12.5px] font-bold text-zinc-800 shadow-2xs transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:ring-zinc-100';

const primaryButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[#09090b] px-3.5 py-2 text-[12.5px] font-bold text-white shadow-sm transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus:ring-zinc-100';

const formatRemoteDateTime = (value: string | null | undefined): string => {
  const date = parseStoredDateTime(value);
  return date ? formatLongDateTime(date) : 'Non renseigné';
};

const formatPromisedRemoteDate = (value: string): string => {
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

const formatLogisticsTaskSchedule = (task: RemoteLogisticsTask): string =>
  isLogisticsTimeSlot(task.time_slot)
    ? formatLogisticsSchedule(task.scheduled_date, task.time_slot)
    : `${task.scheduled_date} • Créneau non renseigné`;

export const RemoteOrderTrackingPanel: React.FC = () => {
  const { requestSettingsTab, showToast } = useApp();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [shops, setShops] = useState<RemoteShop[]>([]);
  const [memberships, setMemberships] = useState<RemoteMembership[]>([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [snapshot, setSnapshot] = useState<RemoteOrderTrackingSnapshot>({
    orders: [],
    logisticsTasks: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [realtimeStatus, setRealtimeStatus] =
    useState<RemoteTrackingRealtimeStatus>('idle');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [events, setEvents] = useState<RemoteOrderEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0);
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<OrderEventVisibility>('customer');
  const [transitionTarget, setTransitionTarget] = useState<OrderStatus | null>(null);
  const loadSequenceRef = useRef(0);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (cancelled) return;
        if (sessionError) setError(sessionError.message);
        setSession(data.session);
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      if (!nextSession) {
        setShops([]);
        setMemberships([]);
        setSnapshot({ orders: [], logisticsTasks: [] });
        setSelectedOrderId(null);
        setEvents([]);
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;

    let cancelled = false;
    Promise.all([listAccessibleShops(), listCurrentMemberships(session.user.id)])
      .then(([accessibleShops, currentMemberships]) => {
        if (cancelled) return;
        setShops(accessibleShops);
        setMemberships(currentMemberships);
        if (accessibleShops.length === 1) {
          setSelectedShopId((current) => current || accessibleShops[0].id);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Accès Supabase impossible.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const loadSnapshot = useCallback(
    async (showSpinner = true): Promise<void> => {
      if (!supabase || !session) return;
      const sequence = ++loadSequenceRef.current;
      if (showSpinner) setLoading(true);

      try {
        const nextSnapshot = await loadRemoteOrderTrackingSnapshot(selectedShopId || null);
        if (sequence !== loadSequenceRef.current) return;
        setSnapshot(nextSnapshot);
        setLastSyncAt(new Date());
        setError(null);
      } catch (loadError: unknown) {
        if (sequence !== loadSequenceRef.current) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Le chargement des commandes distantes a échoué.'
        );
      } finally {
        if (showSpinner && sequence === loadSequenceRef.current) setLoading(false);
      }
    },
    [selectedShopId, session]
  );

  useEffect(() => {
    void loadSnapshot(true);
  }, [loadSnapshot]);

  useEffect(() => {
    if (!supabase || !session) {
      setRealtimeStatus('idle');
      return;
    }

    return subscribeToRemoteOrderTracking({
      shopId: selectedShopId || null,
      onChange: () => {
        void loadSnapshot(false).then(() => {
          setEventsRefreshKey((key) => key + 1);
        });
      },
      onStatus: setRealtimeStatus,
    });
  }, [loadSnapshot, selectedShopId, session]);

  const selectedOrder = useMemo(
    () => snapshot.orders.find((order) => order.id === selectedOrderId) ?? null,
    [selectedOrderId, snapshot.orders]
  );

  useEffect(() => {
    if (!supabase || !session || !selectedOrderId) {
      setEvents([]);
      setEventsLoading(false);
      return;
    }

    let cancelled = false;
    setEventsLoading(true);
    listRemoteOrderEvents(selectedOrderId)
      .then((nextEvents) => {
        if (!cancelled) setEvents(nextEvents);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'L’historique distant de cette commande n’a pas pu être chargé.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventsRefreshKey, selectedOrderId, selectedOrder?.updated_at, session]);

  const tasksByOrderId = useMemo(() => {
    const map = new Map<string, RemoteLogisticsTask[]>();
    for (const task of snapshot.logisticsTasks) {
      if (!task.order_id) continue;
      const current = map.get(task.order_id) ?? [];
      current.push(task);
      map.set(task.order_id, current);
    }
    return map;
  }, [snapshot.logisticsTasks]);

  const filteredOrders = useMemo(() => {
    const needle = normalizeText(searchTerm.trim());
    if (!needle) return snapshot.orders;
    return snapshot.orders.filter((order) =>
      normalizeText(
        [
          getTicketLabel(order),
          order.customer_name_snapshot,
          order.customer_phone_snapshot,
          ORDER_STATUS_LABELS[order.status],
          getLinesSummary(order),
        ].join(' ')
      ).includes(needle)
    );
  }, [searchTerm, snapshot.orders]);

  const selectedTasks = selectedOrder
    ? [...(tasksByOrderId.get(selectedOrder.id) ?? [])].sort((a, b) =>
        b.updated_at.localeCompare(a.updated_at)
      )
    : [];
  const selectedHasActiveDelivery = selectedTasks.some(
    (task) => task.kind === 'delivery' && task.status === 'en_route'
  );
  const selectedTargets = selectedOrder
    ? getProductionTransitionTargets(selectedOrder.status)
    : {};
  const selectedCanTransition = selectedOrder
    ? canMembershipTransitionOrder(memberships, selectedOrder)
    : false;

  const handleTransition = async (targetStatus: OrderStatus) => {
    if (!selectedOrder || transitionTarget) return;
    setTransitionTarget(targetStatus);
    setError(null);
    setMessage(null);

    try {
      const updated = await transitionRemoteOrderStatus({
        orderId: selectedOrder.id,
        targetStatus,
        expectedStatus: selectedOrder.status,
        note,
        visibility,
      });
      setSnapshot((current) => ({
        ...current,
        orders: upsertByUpdatedAt(current.orders, updated),
      }));
      setNote('');
      await loadSnapshot(false);
      setEventsRefreshKey((key) => key + 1);
      const text = `${getTicketLabel(updated)} : ${ORDER_STATUS_LABELS[updated.status]} enregistré dans Supabase.`;
      setMessage(text);
      showToast(`✓ ${text}`);
    } catch (transitionError: unknown) {
      const text =
        transitionError instanceof Error
          ? transitionError.message
          : 'La transition distante a échoué.';
      setError(text);
      showToast(text);
      await loadSnapshot(false);
      setEventsRefreshKey((key) => key + 1);
    } finally {
      setTransitionTarget(null);
    }
  };

  if (!supabase) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-[13px] text-amber-950 shadow-2xs dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
        <h2 className="flex items-center gap-2 text-[15px] font-black">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" /> Suivi distant non configuré
        </h2>
        <p className="mt-2 leading-relaxed">
          Les variables publiques Supabase ne sont pas présentes dans ce build. Les autres
          onglets de l’atelier continuent d’utiliser les données locales de ce navigateur ;
          aucune synchronisation entre appareils n’est donc active ici.
        </p>
        <button
          type="button"
          onClick={() => requestSettingsTab('backend')}
          className={`${secondaryButtonClassName} mt-4`}
        >
          Ouvrir Paramètres → Backend Supabase
        </button>
      </section>
    );
  }

  if (authLoading) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-5 text-[13px] font-semibold text-zinc-600 shadow-2xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Vérification de la session Supabase…
      </p>
    );
  }

  if (!session) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-5 text-[13px] shadow-2xs dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="flex items-center gap-2 text-[15px] font-black text-zinc-950 dark:text-zinc-50">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Connexion requise pour le suivi distant
        </h2>
        <p className="mt-2 leading-relaxed text-zinc-600 dark:text-zinc-400">
          Connectez un compte Supabase autorisé, puis revenez dans cet onglet. Les commandes
          locales visibles dans Production, Rangement et Tournées ne sont pas envoyées
          automatiquement vers le serveur.
        </p>
        <button
          type="button"
          onClick={() => requestSettingsTab('backend')}
          className={`${primaryButtonClassName} mt-4`}
        >
          Se connecter dans Paramètres → Backend Supabase
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="remote-order-tracking-title" className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="remote-order-tracking-title"
              className="flex items-center gap-2 text-[16px] font-black text-zinc-950 dark:text-zinc-50"
            >
              <RadioTower className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              Suivi distant Supabase
            </h2>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Premier lot synchronisé : commandes déjà présentes dans Supabase, transitions de
              production par RPC atomique et historique partagé. Les onglets historiques de
              l’atelier restent locaux tant que la création des commandes n’est pas basculée.
            </p>
            <p className="mt-2 text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
              Session : {session.user.email ?? session.user.id} ·{' '}
              {memberships.length > 0
                ? `${memberships.length} rôle(s) d’équipe chargé(s)`
                : 'Aucun rôle d’équipe chargé (lecture RLS uniquement)'}
              {lastSyncAt
                ? ` · Dernière lecture à ${new Intl.DateTimeFormat('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  }).format(lastSyncAt)}`
                : ''}
            </p>
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
              {realtimeStatus === 'subscribed' ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <RadioTower className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {REALTIME_LABELS[realtimeStatus]}
            </Badge>
            <button
              type="button"
              onClick={() => void loadSnapshot(true)}
              disabled={loading}
              className={secondaryButtonClassName}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              Actualiser
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(220px,320px)_1fr]">
          <div>
            <label
              htmlFor="remote-tracking-shop"
              className="mb-1 block text-[11.5px] font-bold uppercase text-zinc-600 dark:text-zinc-400"
            >
              Agence
            </label>
            <select
              id="remote-tracking-shop"
              value={selectedShopId}
              onChange={(event) => {
                setSelectedShopId(event.target.value);
                setSelectedOrderId(null);
              }}
              className={inputClassName}
            >
              <option value="">Toutes les agences accessibles</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="remote-tracking-search"
              className="mb-1 block text-[11.5px] font-bold uppercase text-zinc-600 dark:text-zinc-400"
            >
              Recherche dans les commandes distantes
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                aria-hidden="true"
              />
              <input
                id="remote-tracking-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Ticket, client, téléphone ou article…"
                className={`${inputClassName} pl-9`}
              />
            </div>
          </div>
        </div>
      </div>

      {message && (
        <p
          aria-live="polite"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12.5px] font-semibold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
        >
          {error}
        </p>
      )}
      {actionError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
        >
          Transition refusée : {actionError}
        </p>
      )}

      <Frame>
        <FramePanel className="p-0">
          <Table aria-label="Commandes Supabase accessibles à la session courante">
            <TableHeader>
              <TableRow>
                <TableHead>Ticket · client</TableHead>
                <TableHead>Production</TableHead>
                <TableHead>Logistique</TableHead>
                <TableHead>Promesse</TableHead>
                <TableHead>Solde</TableHead>
                <TableHead>Dernière mise à jour</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && snapshot.orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" />
                    Chargement des commandes distantes…
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    {shops.length === 0
                      ? 'Aucune agence accessible à cette session : le premier tenant et ses rôles doivent encore être créés.'
                      : snapshot.orders.length === 0
                        ? 'Aucune commande Supabase accessible pour le moment. Les commandes créées dans les écrans locaux ne sont pas encore synchronisées.'
                        : 'Aucune commande distante ne correspond à cette recherche.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const linkedTasks = tasksByOrderId.get(order.id) ?? [];
                  const latestTask = linkedTasks[0];
                  const remaining = getRemainingBalance(order);
                  return (
                    <TableRow key={order.id}>
                      <TableCell>
                        <span className="block font-black text-zinc-950 dark:text-zinc-50">
                          {getTicketLabel(order)}
                        </span>
                        <span className="block text-zinc-600 dark:text-zinc-400">
                          {order.customer_name_snapshot}
                        </span>
                        <span className="block text-[11.5px] text-zinc-500 dark:text-zinc-500">
                          {order.customer_phone_snapshot}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ORDER_BADGE_VARIANTS[order.status]}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                        <span className="mt-1 block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                          Étape {getOrderStatusRank(order.status)} / 5
                        </span>
                      </TableCell>
                      <TableCell>
                        {latestTask ? (
                          <>
                            <Badge variant={LOGISTICS_BADGE_VARIANTS[latestTask.status]}>
                              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                              {latestTask.kind === 'pickup' ? 'Ramassage' : 'Livraison'} ·{' '}
                              {LOGISTICS_STATUS_LABELS[latestTask.status]}
                            </Badge>
                            <span className="mt-1 block text-[11.5px] text-zinc-500 dark:text-zinc-400">
                              {formatLogisticsTaskSchedule(latestTask)}
                            </span>
                          </>
                        ) : order.fulfillment_method === 'home_delivery' ? (
                          <span className="text-zinc-600 dark:text-zinc-400">
                            Livraison prévue, tournée non liée
                          </span>
                        ) : (
                          <span className="text-zinc-600 dark:text-zinc-400">Retrait comptoir</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatPromisedRemoteDate(order.promised_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-bold tabular-nums">
                        {remaining > 0 ? formatFCFA(remaining) : 'Soldée'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatRemoteDateTime(order.updated_at)}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          aria-pressed={selectedOrderId === order.id}
                          className={secondaryButtonClassName}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Suivi
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </FramePanel>
      </Frame>

      {selectedOrder ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <div>
                <h3 className="text-[15px] font-black text-zinc-950 dark:text-zinc-50">
                  {getTicketLabel(selectedOrder)} · {selectedOrder.customer_name_snapshot}
                </h3>
                <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                  {selectedOrder.customer_phone_snapshot} · Reçue le{' '}
                  {formatRemoteDateTime(selectedOrder.received_at)}
                </p>
              </div>
              <Badge variant={ORDER_BADGE_VARIANTS[selectedOrder.status]}>
                {ORDER_STATUS_LABELS[selectedOrder.status]}
              </Badge>
            </div>

            <div className="mt-4" aria-label={`Progression : ${ORDER_STATUS_LABELS[selectedOrder.status]}`}>
              <div className="grid grid-cols-5 gap-1.5" aria-hidden="true">
                {ORDER_STATUS_SEQUENCE.map((status) => {
                  const complete =
                    getOrderStatusRank(status) <= getOrderStatusRank(selectedOrder.status);
                  const current = status === selectedOrder.status;
                  return (
                    <div key={status} className="min-w-0 text-center">
                      <div
                        className={`h-2 rounded-full ${
                          complete ? 'bg-blue-600 dark:bg-blue-400' : 'bg-zinc-200 dark:bg-zinc-700'
                        } ${current ? 'ring-2 ring-blue-300 dark:ring-blue-700' : ''}`}
                      />
                      <p
                        className={`mt-1 truncate text-[10.5px] font-bold ${
                          current
                            ? 'text-zinc-950 dark:text-zinc-50'
                            : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {ORDER_TRACKING_STEP_LABELS[status]}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400">
                Progression de production : {getOrderProgressPercent(selectedOrder.status)} %
              </p>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 text-[12.5px] sm:grid-cols-2">
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                <dt className="flex items-center gap-1.5 font-bold text-zinc-500 dark:text-zinc-400">
                  <PackageCheck className="h-4 w-4" aria-hidden="true" /> Articles
                </dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
                  {getLinesSummary(selectedOrder)}
                </dd>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                <dt className="flex items-center gap-1.5 font-bold text-zinc-500 dark:text-zinc-400">
                  <Clock3 className="h-4 w-4" aria-hidden="true" /> Date promise
                </dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatPromisedRemoteDate(selectedOrder.promised_at)}
                </dd>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                <dt className="flex items-center gap-1.5 font-bold text-zinc-500 dark:text-zinc-400">
                  <Wallet className="h-4 w-4" aria-hidden="true" /> Montant
                </dt>
                <dd className="mt-1 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  Total {formatFCFA(selectedOrder.total_xof)} · Acompte{' '}
                  {formatFCFA(selectedOrder.deposit_paid_xof)} · Reste{' '}
                  {formatFCFA(getRemainingBalance(selectedOrder))}
                </dd>
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                <dt className="flex items-center gap-1.5 font-bold text-zinc-500 dark:text-zinc-400">
                  <MapPin className="h-4 w-4" aria-hidden="true" /> Rangement
                </dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedOrder.storage_location_code_snapshot
                    ? `${selectedOrder.storage_location_code_snapshot}${
                        selectedOrder.storage_location_label_snapshot
                          ? ` · ${selectedOrder.storage_location_label_snapshot}`
                          : ''
                      }`
                    : selectedOrder.rack_location_snapshot ?? 'Non renseigné'}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <h4 className="flex items-center gap-2 text-[13px] font-black text-zinc-900 dark:text-zinc-100">
                <Truck className="h-4 w-4" aria-hidden="true" /> Logistique (statut séparé)
              </h4>
              {selectedTasks.length === 0 ? (
                <p className="mt-2 text-[12.5px] text-zinc-600 dark:text-zinc-400">
                  {selectedOrder.fulfillment_method === 'home_delivery'
                    ? 'Livraison prévue sur la commande, mais aucune tournée distante liée n’est visible.'
                    : 'Retrait au comptoir : aucune tournée liée.'}
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {selectedTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-[12.5px] dark:bg-zinc-800"
                    >
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {task.kind === 'pickup' ? 'Ramassage' : 'Livraison'} ·{' '}
                        {formatLogisticsTaskSchedule(task)}
                      </span>
                      <Badge variant={LOGISTICS_BADGE_VARIANTS[task.status]} size="sm">
                        {LOGISTICS_STATUS_LABELS[task.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <h4 className="text-[13px] font-black text-zinc-900 dark:text-zinc-100">
                Changer l’étape de production
              </h4>
              {!selectedCanTransition ? (
                <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  Lecture seule pour cette session : aucun rôle propriétaire, responsable,
                  caisse ou atelier actif ne couvre cette agence.
                </p>
              ) : selectedOrder.status === 'delivered' ? (
                <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-[12.5px] font-semibold text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
                  Commande déjà remise : la production est verrouillée.
                </p>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_minmax(180px,220px)]">
                    <div>
                      <label
                        htmlFor="remote-transition-note"
                        className="mb-1 block text-[11.5px] font-bold uppercase text-zinc-600 dark:text-zinc-400"
                      >
                        Note de suivi (optionnelle)
                      </label>
                      <input
                        id="remote-transition-note"
                        type="text"
                        maxLength={500}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Ex. pièce délicate vérifiée"
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="remote-transition-visibility"
                        className="mb-1 block text-[11.5px] font-bold uppercase text-zinc-600 dark:text-zinc-400"
                      >
                        Visibilité de l’événement
                      </label>
                      <select
                        id="remote-transition-visibility"
                        value={visibility}
                        onChange={(event) =>
                          setVisibility(event.target.value as OrderEventVisibility)
                        }
                        className={inputClassName}
                      >
                        <option value="customer">Visible par le client lié</option>
                        <option value="internal">Interne à l’équipe</option>
                      </select>
                    </div>
                  </div>

                  {selectedHasActiveDelivery && (
                    <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[12.5px] font-semibold text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
                      Livraison en route : la RPC bloquera tout retour en production tant que
                      la tournée n’est pas terminée ou signalée en échec.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTargets.previous && (
                      <button
                        type="button"
                        onClick={() => void handleTransition(selectedTargets.previous!)}
                        disabled={Boolean(transitionTarget) || selectedHasActiveDelivery}
                        className={secondaryButtonClassName}
                      >
                        {transitionTarget === selectedTargets.previous ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        )}
                        Retour : {ORDER_STATUS_LABELS[selectedTargets.previous]}
                      </button>
                    )}
                    {selectedTargets.next && (
                      <button
                        type="button"
                        onClick={() => void handleTransition(selectedTargets.next!)}
                        disabled={Boolean(transitionTarget) || selectedHasActiveDelivery}
                        className={primaryButtonClassName}
                      >
                        Étape suivante : {ORDER_STATUS_LABELS[selectedTargets.next]}
                        {transitionTarget === selectedTargets.next ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    La remise finale n’est pas proposée ici : elle devra passer par
                    l’encaissement comptoir ou la confirmation de livraison. Si le rangement
                    est obligatoire dans l’agence, la RPC refusera aussi le passage générique
                    en « Prête » tant qu’une RPC de rangement n’est pas livrée.
                  </p>
                </>
              )}
            </div>
          </article>

          <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="flex items-center gap-2 text-[14px] font-black text-zinc-950 dark:text-zinc-50">
              <History className="h-4.5 w-4.5" aria-hidden="true" /> Historique partagé
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Source : table Supabase <code>order_events</code>, filtrée par RLS et par
              visibilité. Les notes internes ne sont pas renvoyées à un compte client.
            </p>

            {eventsLoading ? (
              <p className="mt-5 flex items-center gap-2 text-[12.5px] font-semibold text-zinc-500 dark:text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Chargement de l’historique…
              </p>
            ) : events.length === 0 ? (
              <p className="mt-5 rounded-lg bg-zinc-50 px-3 py-3 text-[12.5px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Aucun événement visible pour cette session.
              </p>
            ) : (
              <ol className="mt-5 space-y-4">
                {events.map((event, index) => {
                  const eventNote = getOrderEventNote(event.payload);
                  return (
                    <li key={event.id} className="relative flex gap-3">
                      {index < events.length - 1 && (
                        <span
                          className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-px bg-zinc-200 dark:bg-zinc-700"
                          aria-hidden="true"
                        />
                      )}
                      <span className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-white bg-blue-600 shadow-sm dark:border-zinc-900" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[12.5px] font-black text-zinc-900 dark:text-zinc-100">
                            {getOrderEventLabel(event)}
                          </p>
                          {event.visibility === 'internal' && (
                            <Badge variant="warning" size="sm">
                              Interne
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">
                          {formatRemoteDateTime(event.created_at)} ·{' '}
                          {getOrderEventActorLabel(event.actor_type)}
                        </p>
                        {event.from_status && event.to_status && (
                          <p className="mt-1 text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400">
                            {ORDER_STATUS_LABELS[event.from_status as OrderStatus] ??
                              event.from_status}{' '}
                            →{' '}
                            {ORDER_STATUS_LABELS[event.to_status as OrderStatus] ??
                              event.to_status}
                          </p>
                        )}
                        {eventNote && (
                          <p className="mt-1 rounded-md bg-zinc-50 px-2 py-1.5 text-[12px] leading-relaxed text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                            {eventNote}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </article>
        </div>
      ) : snapshot.orders.length > 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-5 text-center text-[12.5px] font-semibold text-zinc-500 shadow-2xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          Choisissez « Suivi » sur une commande pour afficher sa progression, sa logistique
          séparée et son historique Supabase.
        </p>
      ) : null}
    </section>
  );
};
