import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Copy,
  Info,
  Layers,
  MapPin,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  Search,
  Settings2,
  Store,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Tabs } from '../common/Tabs';
import { SegmentedControl } from '../common/SegmentedControl';
import { EmptyState, KpiCard, ResetFiltersButton } from '../common/ModuleCommon';
import { ConfirmModal } from '../common/ModalShell';
import { TablePaginationFooter } from '../common/DataTable';
import { usePagination } from '../../lib/pagination';
import { normalizeText } from '../../lib/utils';
import { formatFCFA } from '../../data/demoData';
import { formatDurationHours, parseStoredDateTime } from '../../lib/reports';
import {
  STORAGE_ZONE_LABELS,
  calculateStorageOccupancy,
  formatPackageCount,
  formatStorageLocation,
  getCurrentlyStoredOrders,
  getOccupancyPercent,
  getOrderPackageCount,
  getOrderStorageCode,
  getOrderStorageLabel,
  getOrderStorageSearchText,
  getOrdersOutForDeliveryIds,
  hasLegacyStorage,
  hasStorageLocation,
  hasStructuredStorage,
  isStorageLocationSaturated,
  normalizeStorageCode,
  sortStorageLocations,
} from '../../lib/storage';
import type {
  LaundryOrder,
  StorageLocation,
  StorageLocationFormData,
  StorageZone,
} from '../../types';
import { StorageAssignmentModal } from './StorageAssignmentModal';
import { StorageLocationFormModal } from './StorageLocationFormModal';
import { StorageLocationSeriesModal } from './StorageLocationSeriesModal';

type StorageView = 'orders' | 'locations';
type StorageStateFilter = 'all' | 'unstored' | 'legacy' | 'stored';
type FulfillmentFilter = 'all' | 'counter_pickup' | 'home_delivery';

const STORAGE_ZONES = Object.keys(STORAGE_ZONE_LABELS) as StorageZone[];

interface StorageGroup {
  id: string;
  title: string;
  subtitle?: string;
  orders: LaundryOrder[];
  tone: 'warning' | 'legacy' | 'stored';
}

const parseTicketNumber = (ticketNumber: string): number => {
  const match = ticketNumber.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
};

const hasLocationReferences = (
  location: StorageLocation,
  orders: LaundryOrder[]
): boolean =>
  orders.some((order) => {
    if (order.storageLocationId === location.id) return true;
    const referencedCode = normalizeStorageCode(getOrderStorageCode(order) ?? '');
    return referencedCode !== '' && referencedCode === location.code;
  });

const waitingLabel = (order: LaundryOrder): string | undefined => {
  const date = parseStoredDateTime(order.readyAt);
  if (!date) return undefined;
  const hours = (Date.now() - date.getTime()) / 3_600_000;
  if (hours < 0) return undefined;
  return `depuis ${formatDurationHours(hours)}`;
};

export const StoragePanel: React.FC = () => {
  const {
    orders,
    logisticsTasks,
    storageLocations,
    shopSettings,
    requestSettingsTab,
    setPreviewTicket,
    setActiveHandoverOrder,
    requestWorkshopTab,
    focusLogisticsTask,
    focusedStorageOrderId,
    setFocusedStorageOrderId,
    storagePanelViewRequest,
    clearStoragePanelViewRequest,
    clearOrderStorage,
    setStorageLocationActive,
    deleteStorageLocation,
    showToast,
  } = useApp();

  const [view, setView] = useState<StorageView>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<StorageStateFilter>('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>('all');
  const [zoneFilter, setZoneFilter] = useState<'all' | StorageZone>('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [assignmentOrder, setAssignmentOrder] = useState<LaundryOrder | null>(null);
  const [locationFormOpen, setLocationFormOpen] = useState(false);
  const [seriesModalOpen, setSeriesModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StorageLocation | null>(null);
  const [locationPrefill, setLocationPrefill] = useState<StorageLocationFormData | null>(null);
  const [clearingOrder, setClearingOrder] = useState<LaundryOrder | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<StorageLocation | null>(null);
  const handledFocusRef = useRef<string | null>(null);

  const sortedLocations = useMemo(
    () => sortStorageLocations(storageLocations),
    [storageLocations]
  );
  const locationsById = useMemo(
    () => new Map(storageLocations.map((location) => [location.id, location])),
    [storageLocations]
  );
  const occupancyByLocation = useMemo(
    () => calculateStorageOccupancy(orders, logisticsTasks),
    [logisticsTasks, orders]
  );
  const outForDeliveryIds = useMemo(
    () => getOrdersOutForDeliveryIds(logisticsTasks),
    [logisticsTasks]
  );
  const readyInShop = useMemo(
    () =>
      orders.filter(
        (order) => order.status === 'ready' && !outForDeliveryIds.has(order.id)
      ),
    [orders, outForDeliveryIds]
  );
  const currentlyStoredOrders = useMemo(
    () => getCurrentlyStoredOrders(orders, logisticsTasks),
    [logisticsTasks, orders]
  );

  const metrics = useMemo(() => {
    const structured = readyInShop.filter(hasStructuredStorage).length;
    const legacy = readyInShop.filter(hasLegacyStorage).length;
    const unstored = readyInShop.filter((order) => !hasStorageLocation(order)).length;
    const knownPackages = Array.from(occupancyByLocation.values()).reduce(
      (sum, occupancy) => sum + occupancy.packageCount,
      0
    );
    const saturated = sortedLocations.filter(
      (location) =>
        location.isActive &&
        isStorageLocationSaturated(location, occupancyByLocation.get(location.id))
    ).length;
    return { structured, legacy, unstored, knownPackages, saturated };
  }, [occupancyByLocation, readyInShop, sortedLocations]);

  const filteredOrders = useMemo(() => {
    const needle = normalizeText(searchTerm);
    return readyInShop
      .filter((order) => {
        if (stateFilter === 'stored') return hasStructuredStorage(order);
        if (stateFilter === 'legacy') return hasLegacyStorage(order);
        if (stateFilter === 'unstored') return !hasStorageLocation(order);
        return true;
      })
      .filter(
        (order) =>
          fulfillmentFilter === 'all' ||
          (order.fulfillmentMethod ?? 'counter_pickup') === fulfillmentFilter
      )
      .filter((order) => {
        if (locationFilter === 'all') return true;
        if (locationFilter === 'unstored') return !hasStorageLocation(order);
        if (locationFilter === 'legacy') return hasLegacyStorage(order);
        return order.storageLocationId === locationFilter;
      })
      .filter((order) => {
        if (zoneFilter === 'all') return true;
        return (
          locationsById.get(order.storageLocationId ?? '')?.zone === zoneFilter
        );
      })
      .filter((order) => {
        if (!needle) return true;
        const haystack = normalizeText(
          [
            order.ticketNumber,
            order.customerName,
            order.customerPhone,
            order.customerAddress,
            getOrderStorageSearchText(order),
            order.storageNotes ?? '',
            order.promisedAt,
            ...order.lines.map(
              (line) => `${line.name} ${line.color ?? ''} ${line.serviceType}`
            ),
          ].join(' ')
        );
        if (haystack.includes(needle)) return true;
        // Retrouve aussi « A 01 » / « A01 » pour le code physique « A-01 ».
        const compactNeedle = needle.replace(/[^a-z0-9]/g, '');
        const compactCode = normalizeText(getOrderStorageCode(order) ?? '').replace(
          /[^a-z0-9]/g,
          ''
        );
        return compactNeedle.length >= 2 && compactCode.includes(compactNeedle);
      })
      .sort((a, b) => {
        const rank = (order: LaundryOrder) =>
          !hasStorageLocation(order) ? 0 : hasLegacyStorage(order) ? 1 : 2;
        const rankDiff = rank(a) - rank(b);
        if (rankDiff !== 0) return rankDiff;
        const codeDiff = (getOrderStorageCode(a) ?? '').localeCompare(
          getOrderStorageCode(b) ?? '',
          'fr-FR',
          { numeric: true, sensitivity: 'base' }
        );
        if (codeDiff !== 0) return codeDiff;
        return parseTicketNumber(a.ticketNumber) - parseTicketNumber(b.ticketNumber);
      });
  }, [
    fulfillmentFilter,
    locationFilter,
    locationsById,
    readyInShop,
    searchTerm,
    stateFilter,
    zoneFilter,
  ]);

  const { page, pageCount, setPage, pageItems, rangeStart, rangeEnd } = usePagination(
    filteredOrders,
    12,
    [searchTerm, stateFilter, fulfillmentFilter, zoneFilter, locationFilter]
  );

  const groupedPageItems = useMemo<StorageGroup[]>(() => {
    const groups = new Map<string, StorageGroup>();
    for (const order of pageItems) {
      if (!hasStorageLocation(order)) {
        const group = groups.get('unstored') ?? {
          id: 'unstored',
          title: 'À ranger — aucun emplacement',
          subtitle: 'Ces commandes sont prêtes mais ne sont pas encore retrouvables par casier.',
          orders: [],
          tone: 'warning' as const,
        };
        group.orders.push(order);
        groups.set(group.id, group);
        continue;
      }
      if (hasLegacyStorage(order)) {
        const group = groups.get('legacy') ?? {
          id: 'legacy',
          title: 'Anciens repères en texte libre',
          subtitle: 'À convertir vers un emplacement configuré pour suivre l’occupation.',
          orders: [],
          tone: 'legacy' as const,
        };
        group.orders.push(order);
        groups.set(group.id, group);
        continue;
      }
      const location = locationsById.get(order.storageLocationId ?? '');
      const id = order.storageLocationId ?? getOrderStorageCode(order) ?? 'stored';
      const group = groups.get(id) ?? {
        id,
        title: location
          ? formatStorageLocation(location)
          : getOrderStorageLabel(order) ?? 'Emplacement renseigné',
        subtitle: location
          ? `${STORAGE_ZONE_LABELS[location.zone]}${location.isActive ? '' : ' • emplacement désactivé'}`
          : 'Emplacement absent de la configuration actuelle',
        orders: [],
        tone: 'stored' as const,
      };
      group.orders.push(order);
      groups.set(group.id, group);
    }
    return Array.from(groups.values());
  }, [locationsById, pageItems]);

  const resetFilters = () => {
    setSearchTerm('');
    setStateFilter('all');
    setFulfillmentFilter('all');
    setZoneFilter('all');
    setLocationFilter('all');
  };

  // Ouverture ciblée depuis Commandes, Remises ou une fiche emplacement.
  useEffect(() => {
    if (!focusedStorageOrderId) {
      handledFocusRef.current = null;
      return;
    }
    if (handledFocusRef.current === focusedStorageOrderId) return;
    const order = orders.find((item) => item.id === focusedStorageOrderId);
    handledFocusRef.current = focusedStorageOrderId;
    if (!order) {
      setFocusedStorageOrderId(null);
      return;
    }
    setView('orders');
    setStateFilter('all');
    setFulfillmentFilter('all');
    setZoneFilter('all');
    setLocationFilter('all');
    setSearchTerm(order.ticketNumber);

    const scrollTimer = window.setTimeout(() => {
      const element = document.getElementById(`storage-order-${order.id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.focus({ preventScroll: true });
    }, 100);
    const clearTimer = window.setTimeout(() => setFocusedStorageOrderId(null), 4000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [focusedStorageOrderId, orders, setFocusedStorageOrderId]);

  useEffect(() => {
    if (!storagePanelViewRequest) return;
    setView(storagePanelViewRequest);
    clearStoragePanelViewRequest();
  }, [clearStoragePanelViewRequest, storagePanelViewRequest]);

  const openHandover = (order: LaundryOrder) => {
    setActiveHandoverOrder(order);
    requestWorkshopTab('handover');
  };

  const openLogistics = (order: LaundryOrder) => {
    if (order.deliveryTaskId) focusLogisticsTask(order.deliveryTaskId);
    else requestWorkshopTab('logistics');
  };

  const showOrdersAtLocation = (location: StorageLocation) => {
    setView('orders');
    setSearchTerm('');
    setStateFilter('all');
    setFulfillmentFilter('all');
    setZoneFilter('all');
    setLocationFilter(location.id);
  };

  const newLocationButton = (
    <button
      type="button"
      onClick={() => {
        setEditingLocation(null);
        setLocationPrefill(null);
        setLocationFormOpen(true);
      }}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#09090b] dark:bg-zinc-100 px-4 py-2.5 text-[13px] font-bold text-white dark:text-zinc-950 shadow-sm transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      Nouvel emplacement
    </button>
  );

  const seriesButton = (
    <button
      type="button"
      onClick={() => setSeriesModalOpen(true)}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2.5 text-[13px] font-bold text-zinc-800 dark:text-zinc-200 shadow-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
    >
      <Layers className="h-4 w-4" aria-hidden="true" />
      Créer une série
    </button>
  );

  const renderOrderCard = (order: LaundryOrder) => {
    const storageLabel = getOrderStorageLabel(order);
    const storageCode = getOrderStorageCode(order);
    const isHomeDelivery =
      (order.fulfillmentMethod ?? 'counter_pickup') === 'home_delivery';
    const focused = focusedStorageOrderId === order.id;
    const age = waitingLabel(order);

    return (
      <article
        key={order.id}
        id={`storage-order-${order.id}`}
        tabIndex={-1}
        className={`rounded-xl border bg-white dark:bg-zinc-900 p-3.5 shadow-2xs focus:outline-none ${
          focused
            ? 'border-zinc-950 dark:border-zinc-100 ring-2 ring-zinc-900 dark:ring-zinc-100'
            : 'border-zinc-200 dark:border-zinc-700'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[15px] font-black tracking-tight text-zinc-950 dark:text-zinc-50">
                {order.ticketNumber}
              </span>
              {storageCode ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${
                    hasStructuredStorage(order)
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {storageCode}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-[11px] font-black text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Non rangée
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  isHomeDelivery
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {isHomeDelivery ? (
                  <Truck className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Store className="h-3 w-3" aria-hidden="true" />
                )}
                {isHomeDelivery ? 'Livraison domicile' : 'Retrait comptoir'}
              </span>
              {order.isUrgent && (
                <span className="rounded-full bg-red-100 dark:bg-red-950 px-2 py-0.5 text-[11px] font-black text-red-700 dark:text-red-300">
                  Urgent
                </span>
              )}
              {order.isLate && (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-black text-white">
                  En retard
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
              {order.customerName}
              <span className="ml-2 font-mono text-[11.5px] font-medium text-zinc-500 dark:text-zinc-400">
                {order.customerPhone}
              </span>
            </p>
            <p className="mt-0.5 text-[12px] text-zinc-600 dark:text-zinc-400">
              {storageLabel ?? 'Emplacement non renseigné'}
              {' • '}
              {hasStructuredStorage(order)
                ? formatPackageCount(order)
                : hasLegacyStorage(order)
                  ? 'repère texte libre'
                  : 'à placer dans un casier'}
            </p>
          </div>

          <div className="text-right text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            <p>
              Prête le <strong className="text-zinc-800 dark:text-zinc-200">{order.readyAt ?? '—'}</strong>
              {age ? ` (${age})` : ''}
            </p>
            <p>
              Rangée le{' '}
              <strong className="text-zinc-800 dark:text-zinc-200">{order.storedAt ?? '—'}</strong>
            </p>
            <p>
              Promis le{' '}
              <strong className="text-zinc-800 dark:text-zinc-200">{order.promisedAt}</strong>
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {order.lines.map((line) => (
            <span
              key={line.id}
              className="rounded-md bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-[11.5px] font-medium text-zinc-700 dark:text-zinc-300"
            >
              {line.quantity}× {line.name}
              {line.color ? ` • ${line.color}` : ''}
            </span>
          ))}
        </div>

        {order.storageNotes && (
          <p className="mt-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1.5 text-[12px] text-teal-900 dark:text-teal-200">
            Repère : {order.storageNotes}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <span
            className={`text-[12px] font-bold ${
              order.remainingBalance > 0
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {order.remainingBalance > 0
              ? `Reste à payer : ${formatFCFA(order.remainingBalance)}`
              : 'Soldée'}
          </span>
          <span className="ml-auto flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setAssignmentOrder(order)}
              className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 dark:bg-zinc-100 px-2.5 py-1.5 text-[12px] font-bold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
              {hasStructuredStorage(order) ? 'Déplacer' : 'Ranger'}
            </button>
            <button
              type="button"
              onClick={() => setPreviewTicket(order)}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Ticket
            </button>
            {isHomeDelivery ? (
              <button
                type="button"
                onClick={() => openLogistics(order)}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-900 px-2.5 py-1.5 text-[12px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                Tournée
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openHandover(order)}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 dark:border-emerald-900 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Remettre
              </button>
            )}
            {hasStorageLocation(order) && (
              <button
                type="button"
                onClick={() => setClearingOrder(order)}
                aria-label={`Retirer l’emplacement de ${order.ticketNumber}`}
                title="Retirer l’emplacement"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </span>
        </div>
      </article>
    );
  };

  const renderOrders = () => {
    if (pageItems.length === 0) {
      return (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xs">
          <EmptyState
            title={
              readyInShop.length === 0
                ? 'Aucune commande prête en attente dans l’atelier'
                : 'Aucune commande ne correspond à ces filtres'
            }
            description={
              readyInShop.length === 0
                ? 'Les commandes terminées apparaîtront ici dès qu’elles passeront au statut « Prêt », rangées ou à ranger. Les commandes déjà parties avec un livreur ne sont pas comptées dans les rayons.'
                : 'Essayez un autre ticket, un autre casier ou réinitialisez les filtres.'
            }
            action={readyInShop.length > 0 ? <ResetFiltersButton onClick={resetFilters} /> : undefined}
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {groupedPageItems.map((group) => (
          <section key={group.id} aria-labelledby={`storage-group-${group.id}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3
                id={`storage-group-${group.id}`}
                className={`rounded-md px-2 py-1 text-[12px] font-black uppercase tracking-wider ${
                  group.tone === 'warning'
                    ? 'bg-amber-500 text-white'
                    : group.tone === 'legacy'
                      ? 'bg-zinc-500 text-white'
                      : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                }`}
              >
                {group.title}
              </h3>
              <span className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
                {group.orders.length} commande(s) sur cette page
                {group.subtitle ? ` • ${group.subtitle}` : ''}
              </span>
            </div>
            <div className="space-y-2.5">{group.orders.map(renderOrderCard)}</div>
          </section>
        ))}
      </div>
    );
  };

  const renderLocations = () => {
    if (sortedLocations.length === 0) {
      return (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xs">
          <EmptyState
            title="Aucun emplacement configuré"
            description="Créez les portants, étagères et bacs correspondant à votre local, puis reportez leurs codes sur les étiquettes physiques."
            action={newLocationButton}
          />
        </div>
      );
    }

    return (
      <>
        <div className="mb-3 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/80 dark:bg-teal-950/60 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-[13.5px] font-extrabold text-zinc-950 dark:text-zinc-50">
                Plan physique du propriétaire
              </h3>
              <p className="mt-0.5 max-w-3xl text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Créez les casiers comme ils existent dans votre atelier, puis reportez exactement
                les mêmes codes sur les étiquettes. Un casier déjà utilisé ne se supprime pas :
                désactivez-le pour conserver l’historique.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
                <span className="rounded-full bg-white dark:bg-zinc-900 px-2 py-1 text-zinc-700 dark:text-zinc-300">
                  Rangement {shopSettings.storageAssignmentRequired ? 'obligatoire' : 'différable'}
                </span>
                <span className="rounded-full bg-white dark:bg-zinc-900 px-2 py-1 text-zinc-700 dark:text-zinc-300">
                  Capacité {shopSettings.storageAllowCapacityOverflow ? 'indicative' : 'stricte'}
                </span>
                <span className="rounded-full bg-white dark:bg-zinc-900 px-2 py-1 text-zinc-700 dark:text-zinc-300">
                  Suggestions {shopSettings.storageSuggestionsEnabled ? 'activées' : 'désactivées'}
                </span>
                <span className="rounded-full bg-white dark:bg-zinc-900 px-2 py-1 text-zinc-700 dark:text-zinc-300">
                  Défaut : {shopSettings.storageDefaultCapacityPackages} paquets/casier
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => requestSettingsTab('storage')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal-300 dark:border-teal-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-[12.5px] font-bold text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
                Règles du propriétaire
              </button>
              {seriesButton}
              {newLocationButton}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedLocations.map((location) => {
          const occupancy = occupancyByLocation.get(location.id) ?? {
            orderCount: 0,
            packageCount: 0,
            unknownPackageOrders: 0,
          };
          const percent = getOccupancyPercent(location, occupancy);
          const saturated = isStorageLocationSaturated(location, occupancy);
          const locationOrders = currentlyStoredOrders.filter(
            (order) => order.storageLocationId === location.id
          );
          const canDeleteLocation = !hasLocationReferences(location, orders);

          return (
            <article
              key={location.id}
              className={`rounded-xl border bg-white dark:bg-zinc-900 p-4 shadow-2xs ${
                location.isActive
                  ? 'border-zinc-200 dark:border-zinc-700'
                  : 'border-zinc-200 dark:border-zinc-800 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[22px] font-black leading-none tracking-tight text-zinc-950 dark:text-zinc-50">
                    {location.code}
                  </p>
                  <h3 className="mt-1.5 text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100">
                    {location.label}
                  </h3>
                  <p className="mt-0.5 text-[11.5px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {STORAGE_ZONE_LABELS[location.zone]}
                    {!location.isActive ? ' • désactivé' : ''}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-black ${
                    saturated
                      ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                      : percent >= 80
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                  }`}
                >
                  {percent} %
                </span>
              </div>

              {location.description && (
                <p className="mt-2 min-h-8 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {location.description}
                </p>
              )}

              <div className="mt-3">
                <div
                  className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                  role="progressbar"
                  aria-label={`Occupation de ${location.code}`}
                  aria-valuemin={0}
                  aria-valuemax={location.capacityPackages}
                  aria-valuenow={Math.min(occupancy.packageCount, location.capacityPackages)}
                >
                  <div
                    className={`h-full rounded-full ${
                      saturated ? 'bg-red-500' : percent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11.5px] font-medium text-zinc-500 dark:text-zinc-400">
                  {occupancy.packageCount}
                  {occupancy.unknownPackageOrders > 0 ? '+' : ''}/{location.capacityPackages} paquets
                  {' • '}
                  {occupancy.orderCount} commande(s)
                  {occupancy.unknownPackageOrders > 0 &&
                    ` • ${occupancy.unknownPackageOrders} sans nombre de paquets`}
                </p>
              </div>

              {locationOrders.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {locationOrders.slice(0, 6).map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setFocusedStorageOrderId(order.id)}
                      className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 font-mono text-[11px] font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    >
                      {order.ticketNumber}
                      {getOrderPackageCount(order) ? ` • ${getOrderPackageCount(order)} p.` : ''}
                    </button>
                  ))}
                  {locationOrders.length > 6 && (
                    <span className="px-1 py-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      +{locationOrders.length - 6}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <button
                  type="button"
                  onClick={() => showOrdersAtLocation(location)}
                  className="inline-flex items-center gap-1 rounded-lg bg-zinc-950 dark:bg-zinc-100 px-2.5 py-1.5 text-[12px] font-bold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                >
                  <Package className="h-3.5 w-3.5" aria-hidden="true" />
                  Voir les commandes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingLocation(location);
                    setLocationPrefill(null);
                    setLocationFormOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingLocation(null);
                    setLocationPrefill({
                      code: '',
                      label: `${location.label} — copie`,
                      zone: location.zone,
                      capacityPackages: location.capacityPackages,
                      description: location.description,
                      isActive: location.isActive,
                    });
                    setLocationFormOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Dupliquer
                </button>
                <button
                  type="button"
                  onClick={() => setStorageLocationActive(location.id, !location.isActive)}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-[12px] font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                >
                  {location.isActive ? (
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {location.isActive ? 'Désactiver' : 'Réactiver'}
                </button>
                {canDeleteLocation && (
                  <button
                    type="button"
                    onClick={() => setDeletingLocation(location)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900 px-2.5 py-1.5 text-[12px] font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Supprimer
                  </button>
                )}
              </div>
            </article>
          );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200/90 dark:border-zinc-700/90 bg-white dark:bg-zinc-900 p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-zinc-950 dark:text-zinc-50">
            <Archive className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            Rangement des commandes terminées
          </h2>
          <p className="mt-0.5 max-w-3xl text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Retrouvez chaque paquet par ticket, client ou code physique. Le propriétaire fixe
            librement les casiers, leurs capacités et les règles de rangement selon son local.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {seriesButton}
          {newLocationButton}
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/70 px-3 py-2 text-[11.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span>
          Le plan A–E est seulement une <strong>proposition de démarrage</strong> : créez vos propres
          codes, dupliquez un casier type ou générez une série complète (B-01 → B-12). Les règles
          du propriétaire se règlent dans <strong>Paramètres → Rangement atelier</strong>. Les données
          restent <strong>uniquement dans ce navigateur</strong> pour le moment.
        </span>
      </p>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <KpiCard
          label="Prêtes en atelier"
          value={String(readyInShop.length)}
          hint="Hors commandes déjà en livraison"
        />
        <KpiCard
          label="À ranger / convertir"
          value={String(metrics.unstored + metrics.legacy)}
          hint={`${metrics.unstored} sans repère • ${metrics.legacy} en texte libre`}
          tone={metrics.unstored + metrics.legacy > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          label="Commandes rangées"
          value={String(metrics.structured)}
          hint={`${metrics.knownPackages} paquet(s) comptés`}
          tone={metrics.structured > 0 ? 'success' : 'default'}
        />
        <KpiCard
          label="Emplacements saturés"
          value={String(metrics.saturated)}
          hint={
            shopSettings.storageAllowCapacityOverflow
              ? 'Capacité indicative atteinte'
              : 'Capacité stricte atteinte'
          }
          tone={metrics.saturated > 0 ? 'danger' : 'default'}
        />
      </div>

      <Tabs
        ariaLabel="Vues du rangement atelier"
        activeId={view}
        onChange={setView}
        tabs={[
          {
            id: 'orders',
            label: 'Commandes prêtes',
            icon: <Package className="h-4 w-4" aria-hidden="true" />,
            badge: readyInShop.length,
          },
          {
            id: 'locations',
            label: 'Emplacements',
            icon: <MapPin className="h-4 w-4" aria-hidden="true" />,
            badge: storageLocations.length,
          },
        ]}
      />

      {view === 'orders' ? (
        <>
          <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-700/90 bg-white dark:bg-zinc-900 p-3 shadow-2xs">
            <div className="flex flex-wrap items-end gap-2.5">
              <div className="min-w-56 flex-1">
                <label htmlFor="storage-search" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Retrouver une commande
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                  <input
                    id="storage-search"
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ticket, client, téléphone, article, couleur, A-01…"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 py-2 pl-8 pr-3 text-[12.5px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>

              <div>
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  État de rangement
                </span>
                <SegmentedControl<StorageStateFilter>
                  ariaLabel="Filtrer par état de rangement"
                  options={[
                    { id: 'all', label: 'Toutes' },
                    { id: 'unstored', label: 'À ranger' },
                    { id: 'stored', label: 'Rangées' },
                    { id: 'legacy', label: 'Texte libre' },
                  ]}
                  value={stateFilter}
                  onChange={setStateFilter}
                />
              </div>

              <div>
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Restitution
                </span>
                <SegmentedControl<FulfillmentFilter>
                  ariaLabel="Filtrer par mode de restitution"
                  options={[
                    { id: 'all', label: 'Toutes' },
                    { id: 'counter_pickup', label: 'Comptoir', icon: <Store className="h-3.5 w-3.5" aria-hidden="true" /> },
                    { id: 'home_delivery', label: 'Domicile', icon: <Truck className="h-3.5 w-3.5" aria-hidden="true" /> },
                  ]}
                  value={fulfillmentFilter}
                  onChange={setFulfillmentFilter}
                />
              </div>

              <div>
                <label htmlFor="storage-zone-filter" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Type d’emplacement
                </label>
                <select
                  id="storage-zone-filter"
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value as 'all' | StorageZone)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-2 text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                >
                  <option value="all">Tous les types</option>
                  {STORAGE_ZONES.map((zone) => (
                    <option key={zone} value={zone}>{STORAGE_ZONE_LABELS[zone]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="storage-location-filter" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Emplacement
                </label>
                <select
                  id="storage-location-filter"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-2 text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                >
                  <option value="all">Tous les emplacements</option>
                  <option value="unstored">Non rangées</option>
                  <option value="legacy">Ancien texte libre</option>
                  {sortedLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {formatStorageLocation(location)}{location.isActive ? '' : ' (désactivé)'}
                    </option>
                  ))}
                </select>
              </div>

              <ResetFiltersButton onClick={resetFilters} />
            </div>
          </div>

          {renderOrders()}

          {filteredOrders.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xs">
              <TablePaginationFooter
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                total={filteredOrders.length}
                label="commande(s) prête(s)"
              />
            </div>
          )}
        </>
      ) : (
        renderLocations()
      )}

      {assignmentOrder && (
        <StorageAssignmentModal
          key={`assign-${assignmentOrder.id}`}
          order={assignmentOrder}
          mode="assign"
          onClose={() => setAssignmentOrder(null)}
        />
      )}

      {locationFormOpen && (
        <StorageLocationFormModal
          key={
            editingLocation?.id ??
            (locationPrefill ? `duplicate-${locationPrefill.label}` : 'new-storage-location')
          }
          location={editingLocation}
          prefill={locationPrefill}
          onClose={() => {
            setLocationFormOpen(false);
            setEditingLocation(null);
            setLocationPrefill(null);
          }}
        />
      )}

      {seriesModalOpen && (
        <StorageLocationSeriesModal onClose={() => setSeriesModalOpen(false)} />
      )}

      {clearingOrder && (
        <ConfirmModal
          title="Retirer cet emplacement ?"
          description={
            <>
              <strong>{clearingOrder.ticketNumber}</strong> repassera dans la file « À ranger » et
              libérera {getOrderStorageLabel(clearingOrder) ?? 'son repère actuel'}. Utilisez cette
              action si les paquets ont été sortis du casier ou si le repère est erroné.
            </>
          }
          confirmLabel="Oui, retirer"
          cancelLabel="Garder l’emplacement"
          onConfirm={() => {
            const result = clearOrderStorage(clearingOrder.id);
            if (!result.ok) showToast(result.error);
            setClearingOrder(null);
          }}
          onCancel={() => setClearingOrder(null)}
        />
      )}

      {deletingLocation && (
        <ConfirmModal
          title="Supprimer cet emplacement ?"
          description={
            <>
              <strong>
                {deletingLocation.code} — {deletingLocation.label}
              </strong>{' '}
              n’a jamais été utilisé par une commande. Il peut donc disparaître du plan sans
              casser l’historique. Si le casier physique existe encore, retirez aussi son étiquette.
            </>
          }
          confirmLabel="Oui, supprimer"
          cancelLabel="Garder l’emplacement"
          onConfirm={() => {
            const result = deleteStorageLocation(deletingLocation.id);
            if (!result.ok) showToast(result.error);
            else if (locationFilter === deletingLocation.id) setLocationFilter('all');
            setDeletingLocation(null);
          }}
          onCancel={() => setDeletingLocation(null)}
        />
      )}
    </div>
  );
};
