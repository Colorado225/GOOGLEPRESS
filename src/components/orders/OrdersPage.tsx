import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { Search, Eye, Filter, ArrowLeft, ArrowUpDown, List, WashingMachine, PackageCheck, Clock, CheckCircle2, Inbox, Shirt, Truck, MapPin } from 'lucide-react';
import { Tabs } from '../common/Tabs';
import { Frame, FramePanel, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Avatar, AvatarFallback, TablePaginationFooter, type BadgeVariant } from '../common/DataTable';
import { usePagination } from '../../lib/pagination';
import { getInitials, normalizeText } from '../../lib/utils';
import { isOrderLate } from '../../lib/reports';
import { formatLogisticsSchedule, isHomeDeliveryOrder, isHomePickupOrder } from '../../lib/logistics';
import {
  formatPackageCount,
  getOrderStorageCode,
  getOrderStorageSearchText,
  getOrdersOutForDeliveryIds,
  hasStructuredStorage,
} from '../../lib/storage';
import { LaundryOrder } from '../../types';

const ORDER_STATUS_BADGE_VARIANT: Record<LaundryOrder['status'], BadgeVariant> = {
  received: 'secondary',
  washing: 'info',
  ironing: 'warning',
  ready: 'purple',
  delivered: 'success',
};

const ORDER_STATUS_LABEL: Record<LaundryOrder['status'], string> = {
  received: 'Réceptionné',
  washing: 'Lavage',
  ironing: 'Repassage',
  ready: 'Prêt ✓',
  delivered: 'Remis ✓',
};

const getOrderStatusLabel = (order: LaundryOrder): string =>
  order.status === 'delivered' && isHomeDeliveryOrder(order)
    ? 'Livré ✓'
    : ORDER_STATUS_LABEL[order.status];

export const OrdersPage: React.FC = () => {
  const {
    orders,
    logisticsTasks,
    setPreviewTicket,
    setActiveScreen,
    focusStorageOrder,
    focusLogisticsTask,
  } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [tab, setTab] = useState<'all' | 'received' | 'washing' | 'ironing' | 'ready' | 'late' | 'delivered'>('all');

  const searchedOrders = orders.filter((order) => {
    const needle = normalizeText(searchTerm);
    if (!needle) return true;
    const haystack = normalizeText(
      [
        order.ticketNumber,
        order.customerName,
        order.customerPhone,
        order.customerAddress ?? '',
        order.deliveryAddress ?? '',
        order.collectionAddress ?? '',
        getOrderStorageSearchText(order),
        order.storageNotes ?? '',
        ...order.lines.map((line) => `${line.name} ${line.color ?? ''}`),
      ].join(' ')
    );
    return haystack.includes(needle);
  });

  const outForDeliveryIds = getOrdersOutForDeliveryIds(logisticsTasks);

  // Onglets par statut exact du workflow, plus la file transversale des retards à relancer
  const inTab = (order: LaundryOrder, t: typeof tab): boolean => {
    if (t === 'all') return true;
    if (t === 'late') return isOrderLate(order);
    return order.status === t;
  };
  const countFor = (t: typeof tab) => searchedOrders.filter((o) => inTab(o, t)).length;
  const filteredOrders = searchedOrders.filter((o) => inTab(o, tab));
  const { page, pageCount, setPage, pageItems: pagedOrders, rangeStart, rangeEnd } = usePagination(filteredOrders, 10, [searchTerm, tab]);

  return (
    <div className="flex-1 p-3 sm:p-5 pl-2 sm:pl-4 max-w-none">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveScreen('dashboard')}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Toutes les commandes
            </h1>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
              Historique complet des réceptions, ateliers et remises clients
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveScreen('pos')}
          className="bg-[#09090b] dark:bg-zinc-100 text-white dark:text-zinc-950 rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow"
        >
          + Nouvelle réception
        </button>
      </div>

      {/* Onglets par moment du workflow, avec la taille de chaque file */}
      <Tabs
        ariaLabel="Commandes par étape du workflow"
        className="mb-3"
        activeId={tab}
        onChange={setTab}
        tabs={[
          { id: 'all', label: 'Toutes', icon: <List className="w-4 h-4" aria-hidden="true" />, badge: searchedOrders.length },
          { id: 'received', label: 'Réceptionnées', icon: <Inbox className="w-4 h-4" aria-hidden="true" />, badge: countFor('received') },
          { id: 'washing', label: 'Lavage', icon: <WashingMachine className="w-4 h-4" aria-hidden="true" />, badge: countFor('washing') },
          { id: 'ironing', label: 'Repassage', icon: <Shirt className="w-4 h-4" aria-hidden="true" />, badge: countFor('ironing') },
          { id: 'ready', label: 'Prêtes', icon: <PackageCheck className="w-4 h-4" aria-hidden="true" />, badge: countFor('ready') },
          { id: 'late', label: 'En retard', icon: <Clock className="w-4 h-4" aria-hidden="true" />, badge: countFor('late') },
          { id: 'delivered', label: 'Remises / livrées', icon: <CheckCircle2 className="w-4 h-4" aria-hidden="true" />, badge: countFor('delivered') },
        ]}
      />

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ticket, client, téléphone, casier, vêtement…"
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-[12.5px] w-64 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>
          </div>

          <span className="text-[12px] text-zinc-500 dark:text-zinc-400 font-medium">
            {filteredOrders.length} commandes répertoriées
          </span>
        </div>

        <Frame>
          <FramePanel className="p-0">
          <Table className="text-[12.5px]">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Ticket</TableHead>
                <TableHead className="px-4">Client & Contact</TableHead>
                <TableHead className="px-4">Articles confiés</TableHead>
                <TableHead className="px-4">Montant Total</TableHead>
                <TableHead className="px-4">Acompte / Reste</TableHead>
                <TableHead className="px-4">Promis pour</TableHead>
                <TableHead className="px-4">Statut</TableHead>
                <TableHead className="px-4 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-zinc-200 dark:divide-zinc-700">
              {pagedOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    Aucune commande ne correspond à cette recherche.
                  </TableCell>
                </TableRow>
              )}
              {pagedOrders.map((order) => (
                <TableRow
                  key={order.id}
                  onClick={() => setPreviewTicket(order)}
                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/80 cursor-pointer transition-colors"
                >
                  <TableCell className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{order.ticketNumber}</span>
                      <Badge variant={order.serviceCategory === 'blanchisserie' ? 'teal' : 'info'} size="sm" className="rounded-md px-1.5 text-[9.5px] uppercase">{order.serviceCategory === 'blanchisserie' ? 'Blanch.' : 'Press.'}</Badge>
                    </div>
                    {(isHomePickupOrder(order) || isHomeDeliveryOrder(order)) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {isHomePickupOrder(order) && (
                          <Badge variant="success" size="sm" className="rounded-md px-1.5 text-[9.5px]">
                            <PackageCheck className="h-3 w-3" aria-hidden="true" /> Ramassage
                          </Badge>
                        )}
                        {isHomeDeliveryOrder(order) && (
                          <Badge variant="info" size="sm" className="rounded-md px-1.5 text-[9.5px]">
                            <Truck className="h-3 w-3" aria-hidden="true" /> Livraison
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm" aria-hidden="true">
                        <AvatarFallback>{getInitials(order.customerName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{order.customerName}</p>
                        <p className="text-zinc-500 dark:text-zinc-400 text-[11.5px]">{order.customerPhone}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-zinc-700 dark:text-zinc-300 max-w-[200px] truncate">
                    {order.lines.map((l) => `${l.quantity}× ${l.name}${l.color ? ` (${l.color})` : ''}`).join(', ')}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100 tabular-nums whitespace-nowrap">
                    {formatFCFA(order.total)}
                  </TableCell>
                  <TableCell className="px-4 py-3 tabular-nums whitespace-nowrap text-[12px]">
                    <span className="text-zinc-600 dark:text-zinc-400">Payé {formatFCFA(order.depositPaid)}</span>
                    {order.remainingBalance > 0 && (
                      <p className="text-purple-700 dark:text-purple-300 font-bold">Reste {formatFCFA(order.remainingBalance)}</p>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    <span>{order.promisedAt}</span>
                    {isHomeDeliveryOrder(order) && order.deliveryDate && (
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                        <Truck className="h-3 w-3" aria-hidden="true" />
                        {formatLogisticsSchedule(order.deliveryDate, order.deliveryTimeSlot)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
                      {getOrderStatusLabel(order)}
                    </Badge>
                    {order.status === 'ready' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (outForDeliveryIds.has(order.id) && order.deliveryTaskId) {
                            focusLogisticsTask(order.deliveryTaskId);
                          } else {
                            focusStorageOrder(order.id);
                          }
                        }}
                        className={`mt-1 flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-bold underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${
                          outForDeliveryIds.has(order.id)
                            ? 'text-blue-700 dark:text-blue-300'
                            : hasStructuredStorage(order)
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : getOrderStorageCode(order)
                                ? 'text-zinc-600 dark:text-zinc-400'
                                : 'text-amber-700 dark:text-amber-300'
                        }`}
                        title={
                          outForDeliveryIds.has(order.id)
                            ? 'Ouvrir la tournée en cours'
                            : 'Ouvrir dans le rangement atelier'
                        }
                      >
                        {outForDeliveryIds.has(order.id) ? (
                          <Truck className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                        )}
                        {outForDeliveryIds.has(order.id)
                          ? `En livraison • ${formatPackageCount(order)}`
                          : getOrderStorageCode(order)
                            ? `${getOrderStorageCode(order)}${hasStructuredStorage(order) ? ` • ${formatPackageCount(order)}` : ''}`
                            : 'Non rangée'}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewTicket(order);
                      }}
                      className="px-2.5 py-1 text-[11.5px] font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors inline-flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Ticket</span>
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePaginationFooter
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            total={filteredOrders.length}
            label="commande(s)"
            className="border-t border-zinc-200 dark:border-zinc-700"
          />
          </FramePanel>
        </Frame>
      </div>
    </div>
  );
};
