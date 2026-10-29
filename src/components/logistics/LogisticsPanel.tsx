import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ClipboardList, History, Info, List, Map as MapIcon, PackageCheck, Plus, Search, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Tabs } from '../common/Tabs';
import { SegmentedControl } from '../common/SegmentedControl';
import { EmptyState, KpiCard, ResetFiltersButton } from '../common/ModuleCommon';
import { TablePaginationFooter } from '../common/DataTable';
import { usePagination } from '../../lib/pagination';
import { normalizeText } from '../../lib/utils';
import { formatISODateLongFr, todayISO } from '../../lib/dates';
import {
  LOGISTICS_STATUS_LABELS,
  LOGISTICS_TIME_SLOTS,
  compareLogisticsTasks,
  isLogisticsTaskActionable,
} from '../../lib/logistics';
import type { LogisticsTask, LogisticsTaskKind, LogisticsTaskStatus } from '../../types';
import { LogisticsTaskCard } from './LogisticsTaskCard';
import { LogisticsTaskFormModal } from './LogisticsTaskFormModal';
import { LogisticsActionModal, type LogisticsActionRequest } from './LogisticsActionModal';
import { TourMapPanel } from './TourMapPanel';
import { PlanLockPanel, usePlanFeature } from '../subscription/PlanLockPanel';

type LogisticsView = 'day' | 'action' | 'history';
type KindFilter = 'all' | LogisticsTaskKind;
type StatusFilter = 'all' | LogisticsTaskStatus;

const isHistoryTask = (task: LogisticsTask): boolean =>
  task.status === 'cancelled' ||
  (task.status === 'completed' && (task.kind === 'delivery' || Boolean(task.orderId)));

export const LogisticsPanel: React.FC = () => {
  const {
    logisticsTasks,
    orders,
    employees,
    shopSettings,
    setActiveScreen,
    focusedLogisticsTaskId,
    setFocusedLogisticsTaskId,
  } = useApp();

  const [view, setView] = useState<LogisticsView>('day');
  const canUseMap = usePlanFeature('deliveryTracking');
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [searchTerm, setSearchTerm] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<LogisticsTask | null>(null);
  const [actionRequest, setActionRequest] = useState<LogisticsActionRequest | null>(null);
  const [displayMode, setDisplayMode] = useState<'list' | 'map'>('list');
  const handledFocusRef = useRef<string | null>(null);

  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);

  const metrics = useMemo(() => {
    const pickupsToDo = logisticsTasks.filter(
      (task) =>
        task.kind === 'pickup' &&
        (task.status === 'scheduled' || task.status === 'en_route' || task.status === 'failed')
    ).length;
    const pickupsToCount = logisticsTasks.filter(
      (task) => task.kind === 'pickup' && task.status === 'completed' && !task.orderId
    ).length;
    const deliveriesReady = logisticsTasks.filter(
      (task) =>
        task.kind === 'delivery' &&
        task.status === 'scheduled' &&
        task.orderId &&
        ordersById.get(task.orderId)?.status === 'ready'
    ).length;
    const enRoute = logisticsTasks.filter((task) => task.status === 'en_route').length;
    return { pickupsToDo, pickupsToCount, deliveriesReady, enRoute };
  }, [logisticsTasks, ordersById]);

  const countForView = (candidate: LogisticsView): number => {
    if (candidate === 'day') return logisticsTasks.filter((t) => t.scheduledDate === selectedDate).length;
    if (candidate === 'action') return logisticsTasks.filter(isLogisticsTaskActionable).length;
    return logisticsTasks.filter(isHistoryTask).length;
  };

  const matchesView = (task: LogisticsTask): boolean => {
    if (view === 'day') return task.scheduledDate === selectedDate;
    if (view === 'action') return isLogisticsTaskActionable(task);
    return isHistoryTask(task);
  };

  const filteredTasks = useMemo(() => {
    const needle = normalizeText(searchTerm);
    return logisticsTasks
      .filter(matchesView)
      .filter((task) => kindFilter === 'all' || task.kind === kindFilter)
      .filter((task) => statusFilter === 'all' || task.status === statusFilter)
      .filter((task) => {
        if (employeeFilter === 'all') return true;
        if (employeeFilter === 'unassigned') return !task.assignedEmployeeId;
        return task.assignedEmployeeId === employeeFilter;
      })
      .filter((task) => {
        if (!needle) return true;
        const haystack = normalizeText(
          [
            task.customerName,
            task.customerPhone,
            task.address,
            task.addressDetails ?? '',
            task.orderTicketNumber ?? '',
            task.assignedEmployeeName ?? '',
          ].join(' ')
        );
        return haystack.includes(needle);
      })
      .sort(compareLogisticsTasks);
    // matchesView dépend de view/selectedDate, déjà présents ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeFilter, kindFilter, logisticsTasks, searchTerm, selectedDate, statusFilter, view]);

  const { page, pageCount, setPage, pageItems, rangeStart, rangeEnd } = usePagination(
    filteredTasks,
    10,
    [view, selectedDate, searchTerm, kindFilter, statusFilter, employeeFilter]
  );

  const resetFilters = () => {
    setSearchTerm('');
    setKindFilter('all');
    setStatusFilter('all');
    setEmployeeFilter('all');
    setSelectedDate(todayISO());
  };

  // Ouverture ciblée depuis une carte Kanban : afficher la bonne file, isoler
  // la tâche par ticket/téléphone puis la faire défiler dans la vue.
  useEffect(() => {
    if (!focusedLogisticsTaskId) {
      handledFocusRef.current = null;
      return;
    }
    if (handledFocusRef.current === focusedLogisticsTaskId) return;
    const task = logisticsTasks.find((t) => t.id === focusedLogisticsTaskId);
    handledFocusRef.current = focusedLogisticsTaskId;
    if (!task) {
      setFocusedLogisticsTaskId(null);
      return;
    }
    setView(isHistoryTask(task) ? 'history' : 'action');
    setKindFilter('all');
    setStatusFilter('all');
    setEmployeeFilter('all');
    setSearchTerm(task.orderTicketNumber ?? task.customerPhone);

    const scrollTimer = window.setTimeout(() => {
      const element = document.getElementById(`logistics-task-${task.id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.focus({ preventScroll: true });
    }, 100);
    const clearTimer = window.setTimeout(() => setFocusedLogisticsTaskId(null), 4000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [focusedLogisticsTaskId, logisticsTasks, setFocusedLogisticsTaskId]);

  const employeeOptions = useMemo(
    () => [...employees].sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr')),
    [employees]
  );

  const newPickupButton = (
    <button
      type="button"
      onClick={() => setCreateOpen(true)}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#09090b] dark:bg-zinc-100 px-4 py-2.5 text-[13px] font-bold text-white dark:text-zinc-950 shadow-sm transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      Nouveau ramassage
    </button>
  );

  const renderTasks = () => {
    if (pageItems.length === 0) {
      return (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xs">
          <EmptyState
            title={
              logisticsTasks.length === 0
                ? 'Aucune tournée pour le moment'
                : 'Aucune tournée ne correspond à ces filtres'
            }
            description={
              logisticsTasks.length === 0
                ? 'Programmez un premier ramassage à domicile. Les livraisons apparaîtront ici automatiquement lorsqu’une commande POS choisit la livraison à domicile.'
                : 'Essayez un autre jour, un autre coursier ou réinitialisez les filtres.'
            }
            action={logisticsTasks.length === 0 ? newPickupButton : <ResetFiltersButton onClick={resetFilters} />}
          />
        </div>
      );
    }

    if (view === 'day') {
      return (
        <div className="space-y-4">
          {LOGISTICS_TIME_SLOTS.map((slot) => {
            const slotTasks = pageItems.filter((task) => task.timeSlot === slot.id);
            if (slotTasks.length === 0) return null;
            return (
              <section key={slot.id} aria-labelledby={`logistics-slot-${slot.id}`}>
                <h3
                  id={`logistics-slot-${slot.id}`}
                  className="mb-2 flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                >
                  <span className="rounded-md bg-zinc-900 px-2 py-1 text-white dark:bg-zinc-100 dark:text-zinc-950">{slot.label}</span>
                  <span>{slotTasks.length} course(s) sur cette page</span>
                </h3>
                <div className="space-y-2.5">
                  {slotTasks.map((task) => (
                    <LogisticsTaskCard
                      key={task.id}
                      task={task}
                      onEdit={setEditingTask}
                      onAction={setActionRequest}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      );
    }

    return (
      <div className="space-y-2.5">
        {pageItems.map((task) => (
          <LogisticsTaskCard
            key={task.id}
            task={task}
            onEdit={setEditingTask}
            onAction={setActionRequest}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200/90 dark:border-zinc-700/90 bg-white dark:bg-zinc-900 p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-zinc-950 dark:text-zinc-50">
            <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            Tournées ramassage &amp; livraison
          </h2>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Collectez le linge chez le client, comptez-le à la boutique, puis livrez la commande
            prête avec encaissement du solde sur place si nécessaire.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveScreen('courier')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-[13px] font-bold text-zinc-700 shadow-2xs transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <Truck className="h-4 w-4" aria-hidden="true" />
            Ma tournée
          </button>
          {newPickupButton}
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/70 px-3 py-2 text-[11.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span>
          Tournées et positions conservées <strong>uniquement dans ce navigateur</strong> pour le
          moment. La carte et le partage de position fonctionnent tant que la page reste ouverte ;
          il n’y a ni réservation en ligne ni synchronisation entre appareils.
        </span>
      </p>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <KpiCard
          label="Ramassages à effectuer"
          value={String(metrics.pickupsToDo)}
          hint="Programmés, en route ou en échec"
        />
        <KpiCard
          label="Linge à compter"
          value={String(metrics.pickupsToCount)}
          hint="Collecté, commande non créée"
          tone={metrics.pickupsToCount > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          label="Livraisons prêtes"
          value={String(metrics.deliveriesReady)}
          hint="Commandes prêtes à partir"
          tone={metrics.deliveriesReady > 0 ? 'success' : 'default'}
        />
        <KpiCard label="En route" value={String(metrics.enRoute)} hint="Courses démarrées" />
      </div>

      <Tabs
        ariaLabel="Files de tournées"
        activeId={view}
        onChange={setView}
        tabs={[
          {
            id: 'day',
            label: 'Tournées du jour',
            icon: <CalendarDays className="h-4 w-4" aria-hidden="true" />,
            badge: countForView('day'),
          },
          {
            id: 'action',
            label: 'À traiter',
            icon: <ClipboardList className="h-4 w-4" aria-hidden="true" />,
            badge: countForView('action'),
          },
          {
            id: 'history',
            label: 'Historique',
            icon: <History className="h-4 w-4" aria-hidden="true" />,
            badge: countForView('history'),
          },
        ]}
      />

      <div className="rounded-xl border border-zinc-200/90 dark:border-zinc-700/90 bg-white dark:bg-zinc-900 p-3 shadow-2xs">
        <div className="flex flex-wrap items-end gap-2.5">
          {view === 'day' && (
            <div>
              <label htmlFor="logistics-selected-date" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Jour de tournée
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="logistics-selected-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-2 text-[12.5px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
                {selectedDate !== todayISO() && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(todayISO())}
                    className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-2 text-[12px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  >
                    Aujourd’hui
                  </button>
                )}
              </div>
              <p className="mt-1 text-[11px] capitalize text-zinc-500 dark:text-zinc-400">
                {formatISODateLongFr(selectedDate)}
              </p>
            </div>
          )}

          <div className="min-w-56 flex-1">
            <label htmlFor="logistics-search" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Rechercher
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
              <input
                id="logistics-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Client, téléphone, quartier, ticket, coursier…"
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 py-2 pl-8 pr-3 text-[12.5px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>
          </div>

          <div>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Type de course
            </span>
            <SegmentedControl<KindFilter>
              ariaLabel="Filtrer par type de course"
              options={[
                { id: 'all', label: 'Toutes' },
                { id: 'pickup', label: 'Ramassages', icon: <PackageCheck className="h-3.5 w-3.5" aria-hidden="true" /> },
                { id: 'delivery', label: 'Livraisons', icon: <Truck className="h-3.5 w-3.5" aria-hidden="true" /> },
              ]}
              value={kindFilter}
              onChange={setKindFilter}
            />
          </div>

          <div>
            <label htmlFor="logistics-status-filter" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Statut
            </label>
            <select
              id="logistics-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-2 text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <option value="all">Tous les statuts</option>
              {(Object.keys(LOGISTICS_STATUS_LABELS) as LogisticsTaskStatus[]).map((status) => (
                <option key={status} value={status}>{LOGISTICS_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="logistics-employee-filter" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Coursier
            </label>
            <select
              id="logistics-employee-filter"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-2 text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <option value="all">Tous</option>
              <option value="unassigned">Non assignées</option>
              {employeeOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.fullName}</option>
              ))}
            </select>
          </div>

          <ResetFiltersButton onClick={resetFilters} />
        </div>
      </div>

      {shopSettings.deliveryGps.enabled && (
        <div className="flex items-center justify-end gap-1.5" role="group" aria-label="Affichage des tournées">
          <button
            type="button"
            onClick={() => setDisplayMode('list')}
            aria-pressed={displayMode === 'list'}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${
              displayMode === 'list'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            <List className="h-3.5 w-3.5" aria-hidden="true" /> Liste
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('map')}
            aria-pressed={displayMode === 'map'}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${
              displayMode === 'map'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            <MapIcon className="h-3.5 w-3.5" aria-hidden="true" /> Carte
            {!canUseMap && (
              <span className="ml-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                Pro
              </span>
            )}
          </button>
        </div>
      )}

      {displayMode === 'map' ? (
        canUseMap ? (
          <TourMapPanel tasks={filteredTasks} />
        ) : (
          <PlanLockPanel feature="deliveryTracking" />
        )
      ) : (
        <>
          {renderTasks()}

          {filteredTasks.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xs">
              <TablePaginationFooter
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                total={filteredTasks.length}
                label="tournée(s)"
              />
            </div>
          )}
        </>
      )}

      {(createOpen || editingTask) && (
        <LogisticsTaskFormModal
          key={editingTask?.id ?? 'new-pickup'}
          task={editingTask}
          onClose={() => {
            setCreateOpen(false);
            setEditingTask(null);
          }}
        />
      )}

      {actionRequest && (
        <LogisticsActionModal
          key={`${actionRequest.type}-${actionRequest.task.id}`}
          action={actionRequest}
          onClose={() => setActionRequest(null)}
        />
      )}
    </div>
  );
};
