import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getAlertProducts, getStockStatus } from '../../lib/inventory';
import { getPeriodRange, isISOInRange } from '../../lib/periods';
import { todayISO } from '../../lib/dates';
import { formatFCFA } from '../../data/demoData';
import { Tabs } from '../common/Tabs';
import { Zap, Bell, Activity } from 'lucide-react';

export const QuickActionsAndAlerts: React.FC = () => {
  const {
    setActiveScreen, setClosingZModalOpen, notifyAllSms, setPreviewTicket, orders,
    products, attendanceRecords, employees, expenses,
  } = useApp();

  // Signaux calculés en direct depuis les modules Personnel / Stocks / Dépenses
  const stockAlerts = getAlertProducts(products);
  const stockOutCount = stockAlerts.filter(
    (p) => getStockStatus(p.currentQuantity, p.alertThreshold) === 'out'
  ).length;
  const today = todayISO();
  const presentTodayCount = attendanceRecords.filter(
    (r) => r.date === today && (r.status === 'present' || r.status === 'late')
  ).length;
  const monthRange = getPeriodRange('month');
  const monthExpensesTotal = expenses
    .filter((e) => e.status === 'recorded' && isISOInRange(e.date, monthRange))
    .reduce((sum, e) => sum + e.amountXof, 0);

  const [panel, setPanel] = useState<'actions' | 'alertes' | 'signaux'>('actions');

  const handleTicketClick = (ticketNum: string) => {
    const found = orders.find((o) => o.ticketNumber === ticketNum);
    if (found) {
      setPreviewTicket(found);
    }
  };

  return (
    <div className="bg-white border border-zinc-200/90 rounded-xl p-4 shadow-2xs">
      {/* Sous-onglets compacts : agir (actions) · surveiller (alertes) · suivre les modules (signaux) */}
      <Tabs
        ariaLabel="Raccourcis du tableau de bord"
        size="sm"
        className="mb-3"
        activeId={panel}
        onChange={setPanel}
        tabs={[
          { id: 'actions', label: 'Actions', icon: <Zap className="w-3.5 h-3.5" aria-hidden="true" /> },
          { id: 'alertes', label: 'Alertes', icon: <Bell className="w-3.5 h-3.5" aria-hidden="true" /> },
          {
            id: 'signaux',
            label: 'Signaux',
            icon: <Activity className="w-3.5 h-3.5" aria-hidden="true" />,
            badge: stockAlerts.length > 0 ? stockAlerts.length : undefined,
          },
        ]}
      />

      {panel === 'actions' && (
        <div className="grid grid-cols-2 gap-2 text-[12.5px] font-semibold text-zinc-800">
          <button
            onClick={() => setActiveScreen('pos')}
            className="border border-zinc-200 hover:border-zinc-400 bg-white hover:bg-zinc-50 rounded-lg py-2.5 px-2 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>🧾</span> <span>Réception</span>
          </button>
          <button
            onClick={() => setActiveScreen('workshop')}
            className="border border-zinc-200 hover:border-zinc-400 bg-white hover:bg-zinc-50 rounded-lg py-2.5 px-2 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>💰</span> <span>Encaisser</span>
          </button>
          <button
            onClick={notifyAllSms}
            className="border border-zinc-200 hover:border-zinc-400 bg-white hover:bg-zinc-50 rounded-lg py-2.5 px-2 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>📲</span> <span>Relance SMS</span>
          </button>
          <button
            onClick={() => setClosingZModalOpen(true)}
            className="border border-zinc-200 hover:border-zinc-400 bg-white hover:bg-zinc-50 rounded-lg py-2.5 px-2 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>📊</span> <span>Clôture Z</span>
          </button>
        </div>
      )}

      {panel === 'alertes' && (
        <div className="space-y-2 text-[12.5px]">
          {/* Item 1 */}
          <div
            onClick={() => handleTicketClick('#TK-2841')}
            className="flex justify-between items-center border border-zinc-200 hover:border-zinc-300 rounded-lg px-2.5 py-2 cursor-pointer hover:bg-zinc-50 transition-colors"
          >
            <div>
              <p className="font-bold text-zinc-900">#TK-2841 • Yao Kouassi</p>
              <p className="text-zinc-500 text-[11.5px]">2 costumes • promis hier 17h</p>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">
              J+1
            </span>
          </div>

          {/* Item 2 */}
          <div
            onClick={() => handleTicketClick('#TK-2836')}
            className="flex justify-between items-center border border-zinc-200 hover:border-zinc-300 rounded-lg px-2.5 py-2 cursor-pointer hover:bg-zinc-50 transition-colors"
          >
            <div>
              <p className="font-bold text-zinc-900">#TK-2836 • Aïcha Koné</p>
              <p className="text-zinc-500 text-[11.5px]">Boubou bazin • 4 500 FCFA</p>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Jour J
            </span>
          </div>

          {/* Item 3 */}
          <div
            onClick={() => handleTicketClick('#TK-2831')}
            className="flex justify-between items-center border border-zinc-200 hover:border-zinc-300 rounded-lg px-2.5 py-2 cursor-pointer hover:bg-zinc-50 transition-colors"
          >
            <div>
              <p className="font-bold text-zinc-900">#TK-2831 • Marc Yao</p>
              <p className="text-zinc-500 text-[11.5px]">Hôtel — 35 draps / housses</p>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Jour J
            </span>
          </div>
        </div>
      )}

      {panel === 'signaux' && (
        <div className="space-y-2 text-[12.5px]">
          <button
            type="button"
            onClick={() => setActiveScreen('inventory')}
            className="w-full flex justify-between items-center border border-zinc-200 hover:border-zinc-300 rounded-lg px-2.5 py-2 hover:bg-zinc-50 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <span>
              <span className="font-bold text-zinc-900 block">Alertes de stock</span>
              <span className="text-zinc-500 text-[11.5px]">
                {stockAlerts.length === 0
                  ? 'Aucun produit sous son seuil'
                  : `${stockAlerts.length} produit(s) à surveiller · ${stockOutCount} en rupture`}
              </span>
            </span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                stockOutCount > 0
                  ? 'bg-red-100 text-red-700'
                  : stockAlerts.length > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {stockAlerts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('employees')}
            className="w-full flex justify-between items-center border border-zinc-200 hover:border-zinc-300 rounded-lg px-2.5 py-2 hover:bg-zinc-50 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <span>
              <span className="font-bold text-zinc-900 block">Présences du jour</span>
              <span className="text-zinc-500 text-[11.5px]">
                {presentTodayCount} présent(s) saisi(s) · {employees.filter((e) => e.status === 'active').length} employés actifs
              </span>
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 tabular-nums">
              {presentTodayCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('expenses')}
            className="w-full flex justify-between items-center border border-zinc-200 hover:border-zinc-300 rounded-lg px-2.5 py-2 hover:bg-zinc-50 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <span>
              <span className="font-bold text-zinc-900 block">Dépenses du mois</span>
              <span className="text-zinc-500 text-[11.5px]">enregistrées, hors annulées</span>
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-800 tabular-nums">
              {formatFCFA(monthExpensesTotal)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
