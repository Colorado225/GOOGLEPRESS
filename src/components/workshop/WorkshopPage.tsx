import React, { useEffect, useState } from 'react';
import { useApp, type WorkshopTab } from '../../context/AppContext';
import { KanbanColumn } from './KanbanColumn';
import { Tabs } from '../common/Tabs';
import { formatFCFA } from '../../data/demoData';
import { HandoverSection } from './HandoverSection';
import { DailyClosingCard } from './DailyClosingCard';
import { LogisticsPanel } from '../logistics/LogisticsPanel';
import { StoragePanel } from './StoragePanel';
import { RemoteOrderTrackingPanel } from './RemoteOrderTrackingPanel';
import { StorageAssignmentModal, type StorageAssignmentMode } from './StorageAssignmentModal';
import type { LaundryOrder, OrderStatus } from '../../types';
import { isHomeDeliveryOrder, isLogisticsTaskActionable } from '../../lib/logistics';
import {
  getOrderStorageCode,
  getOrderStorageSearchText,
  getOrdersOutForDeliveryIds,
  hasStructuredStorage,
} from '../../lib/storage';
import { normalizeText } from '../../lib/utils';
import { getReadyOrdersToMarkNotified } from '../../lib/alerts';
import { Search, Smartphone, ArrowLeft, WashingMachine, PackageCheck, Wallet, Truck, Archive, RadioTower } from 'lucide-react';

export const WorkshopPage: React.FC = () => {
  const {
    orders,
    moveOrderStatus,
    activeHandoverOrder,
    setActiveHandoverOrder,
    markReadyOrdersAsNotifiedLocally,
    setActiveScreen,
    showToast,
    logisticsTasks,
    focusedLogisticsTaskId,
    focusLogisticsTask,
    focusedStorageOrderId,
    workshopTabRequest,
    clearWorkshopTabRequest,
    activeWorkshopTab: tab,
    setActiveWorkshopTab: setTab,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  // L'onglet courant vit dans le contexte : la barre latérale le surligne et
  // les raccourcis de navigation peuvent le changer depuis n'importe où.
  const [storageRequest, setStorageRequest] = useState<{
    order: LaundryOrder;
    mode: StorageAssignmentMode;
  } | null>(null);

  // Une demande d’ouverture ciblée (carte Kanban « Prêts ») bascule l’atelier
  // sur les Tournées ; le panneau se charge ensuite du défilement.
  useEffect(() => {
    if (focusedLogisticsTaskId) setTab('logistics');
  }, [focusedLogisticsTaskId]);

  useEffect(() => {
    if (focusedStorageOrderId) setTab('storage');
  }, [focusedStorageOrderId]);

  useEffect(() => {
    if (!workshopTabRequest) return;
    setTab(workshopTabRequest);
    clearWorkshopTabRequest();
  }, [workshopTabRequest, clearWorkshopTabRequest]);

  const needle = normalizeText(searchTerm);
  const filteredOrders = orders.filter((o) => {
    if (!needle) return true;
    const haystack = normalizeText(
      [
        o.ticketNumber,
        o.customerName,
        o.customerPhone,
        getOrderStorageSearchText(o),
        ...o.lines.map((line) => `${line.name} ${line.color ?? ''}`),
      ].join(' ')
    );
    return haystack.includes(needle);
  });

  const receivedOrders = filteredOrders.filter((o) => o.status === 'received');
  const washingOrders = filteredOrders.filter((o) => o.status === 'washing');
  const ironingOrders = filteredOrders.filter((o) => o.status === 'ironing');
  const readyOrders = filteredOrders.filter((o) => o.status === 'ready');
  const readyToNotifyCount = getReadyOrdersToMarkNotified(orders).length;
  const counterReadyOrders = readyOrders.filter((o) => !isHomeDeliveryOrder(o));
  const outForDeliveryIds = getOrdersOutForDeliveryIds(logisticsTasks);
  const readyToStoreCount = orders.filter(
    (o) =>
      o.status === 'ready' &&
      !outForDeliveryIds.has(o.id) &&
      !hasStructuredStorage(o)
  ).length;
  const readyInShopCount = orders.filter(
    (o) => o.status === 'ready' && !outForDeliveryIds.has(o.id)
  ).length;
  const actionableLogisticsCount = logisticsTasks.filter(isLogisticsTaskActionable).length;

  const handleMoveOrder = (orderId: string, targetStatus: OrderStatus) => {
    if (targetStatus === 'ready') {
      const order = orders.find((item) => item.id === orderId);
      if (order) {
        setStorageRequest({ order, mode: 'mark_ready' });
        return;
      }
    }
    moveOrderStatus(orderId, targetStatus);
  };

  const handleAssignStorage = (order: LaundryOrder) => {
    setStorageRequest({ order, mode: 'assign' });
  };

  return (
    <div className="flex-1 p-3 sm:p-5 pl-2 sm:pl-4 max-w-none">
      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveScreen('dashboard')}
              className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 transition-colors"
              title="Retour au tableau de bord"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Production & remises
            </h1>
          </div>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 ml-7">
            Suivi atelier • rangement des commandes prêtes • tournées et remises au comptoir
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ticket / client / casier…"
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 shadow-2xs w-36 sm:w-44"
            />
          </div>

          <button
            type="button"
            onClick={markReadyOrdersAsNotifiedLocally}
            disabled={readyToNotifyCount === 0}
            title="Marque les commandes prêtes comme notifiées dans l’application. Aucun SMS externe n’est envoyé."
            className="px-4 py-1.5 rounded-lg bg-[#09090b] dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
            <span>Marquer {readyToNotifyCount} prête(s) comme notifiée(s)</span>
          </button>
        </div>
      </div>

      {/* Onglets par moment du workflow : produire · remettre · encaisser/clôturer */}
      <Tabs
        ariaLabel="Sections de l'atelier"
        className="mb-4"
        activeId={tab}
        onChange={setTab}
        tabs={[
          {
            id: 'production',
            label: 'Production',
            icon: <WashingMachine className="w-4 h-4" aria-hidden="true" />,
            badge: receivedOrders.length + washingOrders.length + ironingOrders.length,
          },
          {
            id: 'storage',
            label: 'Rangement',
            icon: <Archive className="w-4 h-4" aria-hidden="true" />,
            badge: readyToStoreCount > 0 ? `${readyToStoreCount} à ranger` : readyInShopCount > 0 ? `${readyInShopCount} prête(s)` : undefined,
          },
          {
            id: 'logistics',
            label: 'Tournées',
            icon: <Truck className="w-4 h-4" aria-hidden="true" />,
            badge: actionableLogisticsCount > 0 ? actionableLogisticsCount : undefined,
          },
          {
            id: 'handover',
            label: 'Remises comptoir',
            icon: <PackageCheck className="w-4 h-4" aria-hidden="true" />,
            badge: counterReadyOrders.length > 0 ? `${counterReadyOrders.length} prête(s)` : undefined,
          },
          {
            id: 'cash',
            label: 'Caisse & clôture',
            icon: <Wallet className="w-4 h-4" aria-hidden="true" />,
          },
          {
            id: 'remote',
            label: 'Suivi distant',
            icon: <RadioTower className="w-4 h-4" aria-hidden="true" />,
            badge: 'Supabase',
          },
        ]}
      />

      {tab === 'production' && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 overflow-x-auto pb-1">
        {/* Column 1 */}
        <KanbanColumn
          title="① Réceptionnés"
          count={receivedOrders.length}
          headerClass="bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
          badgeClass="bg-zinc-800 text-white"
          orders={receivedOrders}
          status="received"
          nextStatus="washing"
          onMoveOrder={handleMoveOrder}
        />

        {/* Column 2 */}
        <KanbanColumn
          title="② Lavage"
          count={washingOrders.length}
          headerClass="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
          badgeClass="bg-blue-600 text-white"
          orders={washingOrders}
          status="washing"
          prevStatus="received"
          nextStatus="ironing"
          onMoveOrder={handleMoveOrder}
        />

        {/* Column 3 */}
        <KanbanColumn
          title="③ Repassage / Finition"
          count={ironingOrders.length}
          headerClass="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
          badgeClass="bg-amber-500 text-white"
          orders={ironingOrders}
          status="ironing"
          prevStatus="washing"
          nextStatus="ready"
          onMoveOrder={handleMoveOrder}
        />

        {/* Column 4 */}
        <KanbanColumn
          title="④ Prêts"
          count={readyOrders.length}
          headerClass="bg-purple-600 text-white"
          badgeClass="bg-white dark:bg-zinc-900 text-purple-700 dark:text-purple-300"
          orders={readyOrders}
          status="ready"
          prevStatus="ironing"
          onMoveOrder={handleMoveOrder}
          onAssignStorage={handleAssignStorage}
          onSelectForHandover={(order) => {
            if (isHomeDeliveryOrder(order)) {
              if (order.deliveryTaskId) focusLogisticsTask(order.deliveryTaskId);
              else setTab('logistics');
              showToast(`Commande ${order.ticketNumber} à livrer depuis l'onglet Tournées`);
              return;
            }
            setActiveHandoverOrder(order);
            setTab('handover');
            showToast(`Commande ${order.ticketNumber} ouverte dans l'onglet Remises comptoir`);
          }}
        />
      </div>

      )}

      {tab === 'storage' && <StoragePanel />}

      {tab === 'logistics' && <LogisticsPanel />}

      {tab === 'handover' && (
        <div className="space-y-3">
          {/* Sélection rapide parmi les commandes prêtes */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-3.5 shadow-2xs">
            <h2 className="font-bold text-[13.5px] text-zinc-900 dark:text-zinc-100">
              Commandes prêtes à remettre au comptoir
              <span className="text-zinc-500 dark:text-zinc-400 font-semibold"> · {counterReadyOrders.length} en attente de retrait</span>
            </h2>
            {counterReadyOrders.length === 0 ? (
              <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                {readyOrders.length > 0
                  ? 'Les commandes actuellement prêtes sont en livraison à domicile : gérez leur départ et leur encaissement depuis l’onglet Tournées.'
                  : "Aucune commande n'est prête pour le moment. Les commandes terminées apparaîtront ici depuis l'onglet Production (colonne « Prêts »)."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2.5">
                {counterReadyOrders.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setActiveHandoverOrder(o)}
                    aria-pressed={activeHandoverOrder?.id === o.id}
                    className={`text-left border rounded-xl px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${
                      activeHandoverOrder?.id === o.id
                        ? 'bg-[#09090b] dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 dark:border-zinc-100'
                        : 'bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <span className="block font-bold text-[12.5px]">{o.ticketNumber} • {o.customerName}</span>
                    <span className={`block text-[11.5px] tabular-nums ${activeHandoverOrder?.id === o.id ? 'text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {o.remainingBalance > 0 ? `Reste à payer : ${formatFCFA(o.remainingBalance)}` : 'Déjà soldée'}
                    </span>
                    <span className={`block text-[11px] font-bold ${activeHandoverOrder?.id === o.id ? 'text-teal-300' : getOrderStorageCode(o) ? 'text-teal-700 dark:text-teal-300' : 'text-amber-700 dark:text-amber-300'}`}>
                      {getOrderStorageCode(o) ? `Casier ${getOrderStorageCode(o)}` : 'Non rangée'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <HandoverSection />
        </div>
      )}

      {tab === 'cash' && (
        <div className="max-w-xl">
          <DailyClosingCard />
        </div>
      )}

      {tab === 'remote' && <RemoteOrderTrackingPanel />}

      {storageRequest && (
        <StorageAssignmentModal
          key={`${storageRequest.mode}-${storageRequest.order.id}`}
          order={storageRequest.order}
          mode={storageRequest.mode}
          onClose={() => setStorageRequest(null)}
        />
      )}

      <p className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl mt-3 px-4 py-2 text-[11.5px] text-zinc-500 dark:text-zinc-400 shadow-2xs">
        Kanban atelier + rangement par casier + tournées domicile + remise comptoir + caisse Mobile Money (Wave, MTN, Orange) • Données locales, sauf l’onglet séparé Suivi distant Supabase • FCFA
      </p>
    </div>
  );
};
