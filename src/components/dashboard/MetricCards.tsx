import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../data/demoData';
import { parseStoredDateTime } from '../../lib/dates';
import { getPressingAlerts, getReadyOrdersToMarkNotified } from '../../lib/alerts';
import { toFiniteNumber } from '../../lib/numbers';

const isToday = (value: string): boolean => {
  const date = parseStoredDateTime(value);
  if (!date) return false;
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

export const MetricCards: React.FC = () => {
  const { cashRegister, orders, products } = useApp();

  const todayOrders = orders.filter((order) => isToday(order.receivedAt));
  const todayOrdersTotal = todayOrders.reduce(
    (sum, order) => sum + toFiniteNumber(order.total),
    0
  );
  const averageTodayTicket =
    todayOrders.length > 0 ? Math.round(todayOrdersTotal / todayOrders.length) : null;

  const activeOrders = orders.filter((order) => order.status !== 'delivered');
  const activeArticles = activeOrders.reduce(
    (sum, order) =>
      sum +
      (Array.isArray(order.lines) ? order.lines : []).reduce(
        (lineSum, line) => lineSum + toFiniteNumber(line.quantity),
        0
      ),
    0
  );
  const lateOrdersCount = activeOrders.filter((order) => order.isLate).length;

  const readyOrders = orders.filter((order) => order.status === 'ready');
  const readyBalanceToCollect = readyOrders.reduce(
    (sum, order) => sum + toFiniteNumber(order.remainingBalance),
    0
  );
  const readyToNotifyCount = getReadyOrdersToMarkNotified(orders).length;
  const readyMarkedCount = readyOrders.length - readyToNotifyCount;

  const alerts = getPressingAlerts(orders, products);
  const firstAlert = alerts[0];
  const alertDotClass = !firstAlert
    ? 'bg-emerald-500'
    : firstAlert.severity === 'critical'
      ? 'bg-red-600 animate-pulse'
      : 'bg-amber-500 animate-pulse';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {/* KPI 1: CA du jour */}
      <div className="card-3d hover-lift rounded-xl p-4">
        <div className="flex justify-between items-start">
          <p className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            CA du jour
          </p>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 tabular-nums">
            {todayOrders.length} réception(s)
          </span>
        </div>
        <p className="text-[24px] font-extrabold text-zinc-900 dark:text-zinc-100 mt-1 tracking-tight tabular-nums">
          {formatFCFA(toFiniteNumber(cashRegister.totalAmount))}
        </p>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
          {averageTodayTicket === null
            ? 'Aucune réception enregistrée aujourd’hui'
            : `Panier moyen du jour : ${formatFCFA(averageTodayTicket)}`}
        </p>
      </div>

      {/* KPI 2: Commandes en cours */}
      <div className="card-3d hover-lift rounded-xl p-4">
        <div className="flex justify-between items-start">
          <p className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Commandes en cours
          </p>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
            {activeOrders.length} active(s)
          </span>
        </div>
        <p className="text-[24px] font-extrabold text-zinc-900 dark:text-zinc-100 mt-1 tracking-tight tabular-nums">
          {activeArticles}{' '}
          <span className="text-[14px] font-semibold text-zinc-500 dark:text-zinc-400">articles/kg</span>
        </p>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
          {lateOrdersCount > 0 ? (
            <>
              dont{' '}
              <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                {lateOrdersCount} en retard
              </span>{' '}
              à relancer
            </>
          ) : (
            'Aucun retard marqué'
          )}
        </p>
      </div>

      {/* KPI 3: Prêts à remettre */}
      <div className="card-3d hover-lift rounded-xl p-4">
        <div className="flex justify-between items-start">
          <p className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Prêts à remettre
          </p>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
            À encaisser
          </span>
        </div>
        <p className="text-[24px] font-extrabold text-zinc-900 dark:text-zinc-100 mt-1 tracking-tight tabular-nums">
          {readyOrders.length > 0 ? formatFCFA(readyBalanceToCollect) : '—'}
        </p>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
          {readyOrders.length === 0
            ? 'Aucune commande prête'
            : `${readyOrders.length} commande(s) prête(s) • ${readyMarkedCount} marquée(s) notifiée(s) localement`}
        </p>
      </div>

      {/* KPI 4: Alertes calculées */}
      <div className="card-3d hover-lift rounded-xl p-4 border-l-4 border-l-amber-500">
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            Alertes
          </p>
          <span className={`w-2 h-2 rounded-full ${alertDotClass}`} />
        </div>
        <p className="text-[14.5px] font-bold text-zinc-900 dark:text-zinc-100 mt-1 leading-snug">
          {firstAlert ? firstAlert.title : 'Aucune alerte active'}
        </p>
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">
          {firstAlert ? firstAlert.detail : 'Retards, stock et notifications locales sont à jour'}
        </p>
      </div>
    </div>
  );
};
