import React from 'react';
import { useApp } from '../../context/AppContext';
import { TrendingUp, Clock, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { formatFCFA } from '../../data/demoData';

export const MetricCards: React.FC = () => {
  const { cashRegister, orders } = useApp();

  const activeOrdersCount = orders.filter((o) => o.status !== 'delivered').length;
  const readyOrders = orders.filter((o) => o.status === 'ready');
  const readyBalanceToCollect = readyOrders.reduce((sum, o) => sum + o.remainingBalance, 0);
  const lateOrdersCount = orders.filter((o) => o.isLate).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {/* KPI 1: CA du jour */}
      <div className="card-3d hover-lift rounded-xl p-4">
        <div className="flex justify-between items-start">
          <p className="text-[11.5px] font-semibold text-zinc-500 uppercase tracking-wide">
            CA du jour
          </p>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 tabular-nums">
            +18 %
          </span>
        </div>
        <p className="text-[24px] font-extrabold text-zinc-900 mt-1 tracking-tight tabular-nums">
          {formatFCFA(cashRegister.totalAmount)}
        </p>
        <p className="text-[12px] text-zinc-500 mt-1 flex items-center gap-1.5">
          <span>42 tickets</span>
          <span>•</span>
          <span>panier moyen 4 440 FCFA</span>
        </p>
      </div>

      {/* KPI 2: Commandes en cours */}
      <div className="card-3d hover-lift rounded-xl p-4">
        <div className="flex justify-between items-start">
          <p className="text-[11.5px] font-semibold text-zinc-500 uppercase tracking-wide">
            Commandes en cours
          </p>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
            {activeOrdersCount} actives
          </span>
        </div>
        <p className="text-[24px] font-extrabold text-zinc-900 mt-1 tracking-tight tabular-nums">
          127 <span className="text-[14px] font-semibold text-zinc-500">articles</span>
        </p>
        <p className="text-[12px] text-zinc-500 mt-1">
          dont <span className="font-semibold text-amber-600 tabular-nums">{lateOrdersCount || 6} en retard</span> à relancer
        </p>
      </div>

      {/* KPI 3: Prêts à remettre */}
      <div className="card-3d hover-lift rounded-xl p-4">
        <div className="flex justify-between items-start">
          <p className="text-[11.5px] font-semibold text-zinc-500 uppercase tracking-wide">
            Prêts à remettre
          </p>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
            À encaisser
          </span>
        </div>
        <p className="text-[24px] font-extrabold text-zinc-900 mt-1 tracking-tight tabular-nums">
          {formatFCFA(readyBalanceToCollect > 0 ? readyBalanceToCollect : 94000)}
        </p>
        <p className="text-[12px] text-zinc-500 mt-1">
          {readyOrders.length || 19} sacs prêts • 11 clients notifiés SMS
        </p>
      </div>

      {/* KPI 4: Alertes */}
      <div className="card-3d hover-lift rounded-xl p-4 border-l-4 border-l-amber-500">
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] font-semibold text-zinc-500 uppercase tracking-wide">
            Alertes
          </p>
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        </div>
        <p className="text-[14.5px] font-bold text-zinc-900 mt-1 leading-snug">
          ⚠ 6 retards + stock détachant bas
        </p>
        <p className="text-[12px] text-zinc-500 mt-1">
          Machine L2 en maintenance 14h–16h
        </p>
      </div>
    </div>
  );
};
