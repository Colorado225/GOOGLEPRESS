import React from 'react';
import { LaundryOrder } from '../../types';
import { formatFCFA } from '../../data/demoData';
import { useApp } from '../../context/AppContext';
import { formatLogisticsSchedule, isHomeDeliveryOrder, isHomePickupOrder } from '../../lib/logistics';
import {
  formatPackageCount,
  getOrderStorageCode,
  hasLegacyStorage,
  hasStructuredStorage,
} from '../../lib/storage';
import { ChevronRight, ChevronLeft, Clock, AlertTriangle, CheckCircle, Smartphone, Truck, PackageCheck, Archive, MapPin } from 'lucide-react';

interface KanbanCardProps {
  order: LaundryOrder;
  onMoveForward?: () => void;
  onMoveBackward?: () => void;
  onSelectForHandover?: () => void;
  onAssignStorage?: () => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  order,
  onMoveForward,
  onMoveBackward,
  onSelectForHandover,
  onAssignStorage,
}) => {
  const { setPreviewTicket, settleAndDeliverOrder, focusLogisticsTask, logisticsTasks } = useApp();

  const isLate = order.isLate;
  const isReady = order.status === 'ready';
  const isHomePickup = isHomePickupOrder(order);
  const isHomeDelivery = isHomeDeliveryOrder(order);
  const isOutForDelivery = logisticsTasks.some(
    (task) => task.kind === 'delivery' && task.orderId === order.id && task.status === 'en_route'
  );

  const openDeliveryTask = () => {
    if (order.deliveryTaskId) focusLogisticsTask(order.deliveryTaskId);
    else setPreviewTicket(order);
  };

  const summaryArticles = order.lines
    .map((l) => `${l.quantity > 1 ? `${l.quantity} ` : ''}${l.name.toLowerCase()}${l.color ? ` (${l.color.toLowerCase()})` : ''}`)
    .join(' + ');

  return (
    <div
      onClick={() => {
        if (isReady && isHomeDelivery) {
          openDeliveryTask();
        } else if (isReady && onSelectForHandover) {
          onSelectForHandover();
        } else {
          setPreviewTicket(order);
        }
      }}
      className={`bg-white dark:bg-zinc-900 border rounded-xl p-3 mb-2.5 shadow-2xs hover:shadow-xs transition-all cursor-pointer relative group ${
        isLate
          ? 'border-l-4 border-l-red-600 border-zinc-200 dark:border-zinc-700'
          : isReady
          ? 'border-l-4 border-l-purple-600 border-zinc-200 dark:border-zinc-700'
          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
      }`}
    >
      {/* Top row */}
      <div className="flex justify-between items-start gap-1">
        <p className="font-bold text-[13px] text-zinc-900 dark:text-zinc-100 leading-tight">
          {order.ticketNumber} • {order.customerName.split(' ')[0]} {order.customerName.split(' ')[1]?.[0] ? `${order.customerName.split(' ')[1][0]}.` : ''}
        </p>

        {isLate ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white whitespace-nowrap">
            Retard
          </span>
        ) : order.isUrgent ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white whitespace-nowrap">
            Prioritaire
          </span>
        ) : order.machineAssigned ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 whitespace-nowrap">
            {order.machineAssigned}
          </span>
        ) : isReady ? (
          order.smsSent ? (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 whitespace-nowrap flex items-center gap-0.5"
              title="Notification marquée dans l’application — aucun SMS externe confirmé"
            >
              <Smartphone className="w-2.5 h-2.5" aria-hidden="true" /> Notif. locale ✓
            </span>
          ) : (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 whitespace-nowrap flex items-center gap-0.5">
              <Smartphone className="w-2.5 h-2.5" aria-hidden="true" /> À notifier
            </span>
          )
        ) : null}
      </div>

      {/* Articles & amount */}
      <p className="text-[12px] text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-1">
        {summaryArticles} • <b className="text-zinc-900 dark:text-zinc-100 tabular-nums">{formatFCFA(order.total)}</b>
        {order.remainingBalance > 0 && isReady && (
          <span className="text-purple-700 dark:text-purple-300 font-semibold ml-1">
            • Reste {formatFCFA(order.remainingBalance)}
          </span>
        )}
      </p>

      {(isHomePickup || isHomeDelivery) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px] font-bold">
          {isHomePickup && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <PackageCheck className="h-3 w-3" aria-hidden="true" /> Ramassage
            </span>
          )}
          {isHomeDelivery && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Truck className="h-3 w-3" aria-hidden="true" />
              Livraison{order.deliveryDate ? ` • ${formatLogisticsSchedule(order.deliveryDate, order.deliveryTimeSlot)}` : ''}
            </span>
          )}
        </div>
      )}

      {isReady && (
        <div
          className="mt-2 flex items-center justify-between gap-2 text-[11px]"
          onClick={(e) => e.stopPropagation()}
        >
          {isOutForDelivery ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950 px-2 py-0.5 font-black text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Truck className="h-3 w-3" aria-hidden="true" />
              En livraison • {formatPackageCount(order)}
            </span>
          ) : hasStructuredStorage(order) ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 font-black text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {getOrderStorageCode(order)} • {formatPackageCount(order)}
            </span>
          ) : hasLegacyStorage(order) ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {getOrderStorageCode(order)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950 px-2 py-0.5 font-black text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Non rangée
            </span>
          )}

          {onAssignStorage && !isOutForDelivery && (
            <button
              type="button"
              onClick={onAssignStorage}
              className="inline-flex items-center gap-1 font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 rounded px-1 py-0.5"
            >
              <Archive className="h-3 w-3" aria-hidden="true" />
              {hasStructuredStorage(order) ? 'Déplacer' : 'Ranger'}
            </button>
          )}
        </div>
      )}

      {/* Progress bar for washing machines */}
      {order.status === 'washing' && order.progressPercent && (
        <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-2 overflow-hidden">
          <div
            className="h-1.5 bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${order.progressPercent}%` }}
          />
        </div>
      )}

      {/* Promised date / note */}
      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1 truncate">
          <Clock className="w-3 h-3 text-zinc-400 dark:text-zinc-500 shrink-0" />
          <span>{order.promisedAt}</span>
        </span>

        {/* Navigation arrows */}
        <div
          className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {onMoveBackward && (
            <button
              type="button"
              onClick={onMoveBackward}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 rounded"
              title="Étape précédente"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          {onMoveForward && (
            <button
              type="button"
              onClick={onMoveForward}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 rounded"
              title="Étape suivante"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Ready column action buttons */}
      {isReady && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          {isHomeDelivery ? (
            <button
              type="button"
              onClick={openDeliveryTask}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-lg py-2 transition-all shadow-2xs flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{order.remainingBalance > 0 ? 'Gérer la livraison & l’encaissement' : 'Gérer la livraison'}</span>
            </button>
          ) : order.remainingBalance > 0 ? (
            <button
              type="button"
              onClick={() => {
                if (onSelectForHandover) {
                  onSelectForHandover();
                } else {
                  settleAndDeliverOrder(order.id, 'wave');
                }
              }}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-[12px] font-bold rounded-lg py-2 transition-all shadow-2xs flex items-center justify-center gap-1"
            >
              <span>💰</span> <span>Encaisser & remettre</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => settleAndDeliverOrder(order.id, 'wave')}
              className="w-full border-2 border-purple-600 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950 text-[12px] font-bold rounded-lg py-1.5 transition-all flex items-center justify-center gap-1"
            >
              <span>📦</span> <span>Remettre (soldé)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
