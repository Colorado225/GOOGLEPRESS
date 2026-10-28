import React from 'react';
import { LaundryOrder, OrderStatus } from '../../types';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  title: string;
  count: number;
  headerClass: string;
  badgeClass: string;
  orders: LaundryOrder[];
  status: OrderStatus;
  prevStatus?: OrderStatus;
  nextStatus?: OrderStatus;
  onMoveOrder: (orderId: string, targetStatus: OrderStatus) => void;
  onSelectForHandover?: (order: LaundryOrder) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  count,
  headerClass,
  badgeClass,
  orders,
  status,
  prevStatus,
  nextStatus,
  onMoveOrder,
  onSelectForHandover,
}) => {
  return (
    <div className="flex flex-col min-w-[240px]">
      {/* Column Head */}
      <div className={`text-[12px] font-bold uppercase tracking-wider px-3 py-2.5 rounded-lg mb-2 flex items-center justify-between ${headerClass}`}>
        <span>{title}</span>
        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full tabular-nums ${badgeClass}`}>
          {count}
        </span>
      </div>

      {/* Cards List */}
      <div className="flex-1 space-y-2 min-h-[300px]">
        {orders.length === 0 ? (
          <div className="p-6 text-center text-zinc-400 dark:text-zinc-500 text-[12px] border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl bg-white/40 dark:bg-zinc-900/40">
            Aucun vêtement à cette étape
          </div>
        ) : (
          orders.map((order) => (
            <KanbanCard
              key={order.id}
              order={order}
              onMoveBackward={prevStatus ? () => onMoveOrder(order.id, prevStatus) : undefined}
              onMoveForward={nextStatus ? () => onMoveOrder(order.id, nextStatus) : undefined}
              onSelectForHandover={onSelectForHandover ? () => onSelectForHandover(order) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
};
