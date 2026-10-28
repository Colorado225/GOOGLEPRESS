import React from 'react';
import { LaundryOrder } from '../../types';
import { formatFCFA } from '../../data/demoData';
import { useApp } from '../../context/AppContext';
import { ChevronRight, ChevronLeft, Clock, AlertTriangle, CheckCircle, Smartphone } from 'lucide-react';

interface KanbanCardProps {
  order: LaundryOrder;
  onMoveForward?: () => void;
  onMoveBackward?: () => void;
  onSelectForHandover?: () => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  order,
  onMoveForward,
  onMoveBackward,
  onSelectForHandover,
}) => {
  const { setPreviewTicket, settleAndDeliverOrder } = useApp();

  const isLate = order.isLate;
  const isReady = order.status === 'ready';

  const summaryArticles = order.lines
    .map((l) => `${l.quantity > 1 ? `${l.quantity} ` : ''}${l.name.toLowerCase()}${l.color ? ` (${l.color.toLowerCase()})` : ''}`)
    .join(' + ');

  return (
    <div
      onClick={() => {
        if (isReady && onSelectForHandover) {
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
            {order.ticketNumber === '#TK-2841' ? 'J+1 ⚠' : 'Retard'}
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
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 whitespace-nowrap flex items-center gap-0.5">
            <Smartphone className="w-2.5 h-2.5" /> SMS ✓
          </span>
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
          {order.remainingBalance > 0 ? (
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
