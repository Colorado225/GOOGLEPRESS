import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { parseStoredDateTime, toISODate } from '../../lib/dates';

interface RevenueBucket {
  key: string;
  label: string;
  tooltip: string;
  value: number;
  ordersCount: number;
  isToday?: boolean;
}

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
};

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const formatCompactXof = (value: number): string => {
  if (value >= 1000) return `${Math.round(value / 1000)} k`;
  return String(value);
};

export const RevenueChart: React.FC = () => {
  const { orders } = useApp();
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const totalsByDay = useMemo(() => {
    const map = new Map<string, { value: number; ordersCount: number }>();
    for (const order of orders) {
      const received = parseStoredDateTime(order.receivedAt);
      if (!received) continue;
      const key = toISODate(received);
      const current = map.get(key) ?? { value: 0, ordersCount: 0 };
      current.value += order.total;
      current.ordersCount += 1;
      map.set(key, current);
    }
    return map;
  }, [orders]);

  const buckets = useMemo<RevenueBucket[]>(() => {
    const today = startOfDay(new Date());
    const todayKey = toISODate(today);

    if (viewMode === 'week') {
      return Array.from({ length: 7 }, (_, index) => {
        const date = addDays(today, index - 6);
        const key = toISODate(date);
        const total = totalsByDay.get(key) ?? { value: 0, ordersCount: 0 };
        return {
          key,
          label: new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(date),
          tooltip: new Intl.DateTimeFormat('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }).format(date),
          value: total.value,
          ordersCount: total.ordersCount,
          isToday: key === todayKey,
        };
      });
    }

    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(today);

    return [1, 8, 15, 22, 29]
      .filter((start) => start <= Math.min(today.getDate(), lastDay))
      .map((start) => {
        const end = Math.min(start + 6, lastDay, today.getDate());
        let value = 0;
        let ordersCount = 0;
        for (let day = start; day <= end; day += 1) {
          const key = toISODate(new Date(year, month, day, 12));
          const total = totalsByDay.get(key);
          if (total) {
            value += total.value;
            ordersCount += total.ordersCount;
          }
        }
        return {
          key: `month-${start}-${end}`,
          label: `${start}–${end}`,
          tooltip: `Du ${start} au ${end} ${monthLabel}`,
          value,
          ordersCount,
        };
      });
  }, [totalsByDay, viewMode]);

  const maxValue = Math.max(0, ...buckets.map((bucket) => bucket.value));
  const periodTotal = buckets.reduce((sum, bucket) => sum + bucket.value, 0);
  const periodOrdersCount = buckets.reduce((sum, bucket) => sum + bucket.ordersCount, 0);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="font-bold text-[14.5px] text-zinc-900 dark:text-zinc-100 tracking-tight">
            Chiffre d'affaires — {viewMode === 'week' ? '7 derniers jours' : 'Mois en cours'}
          </h2>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
            Calculé depuis les commandes reçues • en FCFA
          </p>
        </div>
        <div className="flex gap-1.5 text-[11.5px]">
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              viewMode === 'week'
                ? 'bg-black text-white shadow-2xs'
                : 'border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            Semaine
          </button>
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              viewMode === 'month'
                ? 'bg-black text-white shadow-2xs'
                : 'border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            Mois
          </button>
        </div>
      </div>

      {/* Chart Bars */}
      <div className="flex items-end gap-2 sm:gap-3 h-[155px] px-2 pt-4 relative">
        {buckets.map((item) => {
          const isHovered = hoveredKey === item.key;
          const isPeak = maxValue > 0 && item.value === maxValue;
          const height = maxValue > 0 ? 12 + (item.value / maxValue) * 95 : 8;
          return (
            <div
              key={item.key}
              onMouseEnter={() => setHoveredKey(item.key)}
              onMouseLeave={() => setHoveredKey(null)}
              className="flex-1 flex flex-col items-center gap-1 group cursor-pointer relative h-full justify-end"
            >
              {isHovered && (
                <div className="absolute -top-12 z-30 bg-[#09090b] text-white text-[11px] py-1 px-2.5 rounded-md whitespace-nowrap shadow-lg pointer-events-none">
                  <p className="font-bold">
                    {item.tooltip} : {formatFCFA(item.value)}
                  </p>
                  <p className="text-zinc-300 text-[10px]">
                    {item.ordersCount} commande(s) reçue(s)
                  </p>
                </div>
              )}

              <span
                className={`text-[11px] font-semibold tabular-nums transition-colors ${
                  isPeak
                    ? 'text-blue-700 dark:text-blue-300 font-bold'
                    : item.isToday
                      ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100'
                }`}
              >
                {formatCompactXof(item.value)}
              </span>

              <div
                style={{ height: `${height}px` }}
                className={`w-full rounded-t-md transition-all duration-300 ${
                  isPeak
                    ? 'bg-blue-600 group-hover:bg-blue-700 shadow-sm'
                    : item.isToday
                      ? 'border-2 border-dashed border-zinc-800 bg-blue-50 dark:bg-blue-950 group-hover:bg-blue-100 dark:group-hover:bg-blue-900'
                      : 'bg-zinc-200 dark:bg-zinc-700 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-600'
                }`}
              />

              <span
                className={`text-[11px] transition-colors ${
                  isPeak || item.isToday
                    ? 'text-zinc-900 dark:text-zinc-100 font-bold'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer legend */}
      <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-[12px] text-zinc-600 dark:text-zinc-400">
        <span>
          Total période :{' '}
          <strong className="text-zinc-900 dark:text-zinc-100 tabular-nums">{formatFCFA(periodTotal)}</strong>
        </span>
        <span>
          {periodOrdersCount} commande(s) reçue(s) sur la période
        </span>
        {periodOrdersCount === 0 && <span>Aucune réception datée sur cette période</span>}
      </div>
    </div>
  );
};
