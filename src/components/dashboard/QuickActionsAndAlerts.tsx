import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getAlertProducts, getStockStatus } from '../../lib/inventory';
import { getPeriodRange, isISOInRange } from '../../lib/periods';
import { todayISO } from '../../lib/dates';
import { formatFCFA } from '../../data/demoData';
import { getPressingAlerts, getReadyOrdersToMarkNotified, type PressingAlert } from '../../lib/alerts';
import { Tabs } from '../common/Tabs';
import { Zap, Bell, Activity } from 'lucide-react';

export const QuickActionsAndAlerts: React.FC = () => {
  const {
    setActiveScreen, setClosingZModalOpen, markReadyOrdersAsNotifiedLocally, setPreviewTicket, orders,
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
  const alerts = getPressingAlerts(orders, products);
  const readyToNotifyCount = getReadyOrdersToMarkNotified(orders).length;

  const [panel, setPanel] = useState<'actions' | 'alertes' | 'signaux'>('actions');

  const handleAlertClick = (alert: PressingAlert) => {
    if (alert.orderId) {
      const found = orders.find((o) => o.id === alert.orderId);
      if (found) {
        setPreviewTicket(found);
        return;
      }
    }
    setActiveScreen(alert.screen);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-700/90 rounded-xl p-4 shadow-2xs">
      {/* Sous-onglets compacts : agir (actions) · surveiller (alertes) · suivre les modules (signaux) */}
      <Tabs
        ariaLabel="Raccourcis du tableau de bord"
        size="sm"
        className="mb-3"
        activeId={panel}
        onChange={setPanel}
        tabs={[
          { id: 'actions', label: 'Actions', icon: <Zap className="w-3.5 h-3.5" aria-hidden="true" /> },
          {
            id: 'alertes',
            label: 'Alertes',
            icon: <Bell className="w-3.5 h-3.5" aria-hidden="true" />,
            badge: alerts.length > 0 ? alerts.length : undefined,
          },
          {
            id: 'signaux',
            label: 'Signaux',
            icon: <Activity className="w-3.5 h-3.5" aria-hidden="true" />,
            badge: stockAlerts.length > 0 ? stockAlerts.length : undefined,
          },
        ]}
      />

      {panel === 'actions' && (
        <div className="grid grid-cols-2 gap-2 text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-200">
          <button
            onClick={() => setActiveScreen('pos')}
            className="border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg py-2.5 px-2 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>🧾</span> <span>Réception</span>
          </button>
          <button
            onClick={() => setActiveScreen('workshop')}
            className="border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg py-2.5 px-2 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>💰</span> <span>Encaisser</span>
          </button>
          <button
            type="button"
            onClick={markReadyOrdersAsNotifiedLocally}
            disabled={readyToNotifyCount === 0}
            title="Marque les commandes prêtes comme notifiées dans l’application. Aucun SMS externe n’est envoyé."
            className="border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg py-2.5 px-2 transition-all flex items-center justify-center gap-1.5 shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>✓</span> <span>Marquer prêtes ({readyToNotifyCount})</span>
          </button>
          <button
            onClick={() => setClosingZModalOpen(true)}
            className="border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg py-2.5 px-2 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>📊</span> <span>Clôture Z</span>
          </button>
        </div>
      )}

      {panel === 'alertes' && (
        <div className="space-y-2 text-[12.5px]">
          {alerts.length === 0 ? (
            <div className="border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/40 rounded-lg px-2.5 py-2">
              <p className="font-bold text-emerald-900 dark:text-emerald-100">Aucune alerte active</p>
              <p className="text-emerald-700 dark:text-emerald-300 text-[11.5px]">
                Retards, stock et notifications locales sont à jour.
              </p>
            </div>
          ) : (
            alerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => handleAlertClick(alert)}
                className="w-full flex justify-between items-center gap-2 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 rounded-lg px-2.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              >
                <span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 block">{alert.title}</span>
                  <span className="text-zinc-500 dark:text-zinc-400 text-[11.5px] block">{alert.detail}</span>
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    alert.severity === 'critical'
                      ? 'bg-red-600 text-white'
                      : alert.severity === 'warning'
                        ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                        : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                  }`}
                >
                  {alert.severity === 'critical' ? 'Critique' : alert.severity === 'warning' ? 'À suivre' : 'Info'}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {panel === 'signaux' && (
        <div className="space-y-2 text-[12.5px]">
          <button
            type="button"
            onClick={() => setActiveScreen('inventory')}
            className="w-full flex justify-between items-center border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 rounded-lg px-2.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100 block">Alertes de stock</span>
              <span className="text-zinc-500 dark:text-zinc-400 text-[11.5px]">
                {stockAlerts.length === 0
                  ? 'Aucun produit sous son seuil'
                  : `${stockAlerts.length} produit(s) à surveiller · ${stockOutCount} en rupture`}
              </span>
            </span>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                stockOutCount > 0
                  ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                  : stockAlerts.length > 0
                  ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                  : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {stockAlerts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('employees')}
            className="w-full flex justify-between items-center border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 rounded-lg px-2.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100 block">Présences du jour</span>
              <span className="text-zinc-500 dark:text-zinc-400 text-[11.5px]">
                {presentTodayCount} présent(s) saisi(s) · {employees.filter((e) => e.status === 'active').length} employés actifs
              </span>
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900 tabular-nums">
              {presentTodayCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen('expenses')}
            className="w-full flex justify-between items-center border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 rounded-lg px-2.5 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          >
            <span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100 block">Dépenses du mois</span>
              <span className="text-zinc-500 dark:text-zinc-400 text-[11.5px]">enregistrées, hors annulées</span>
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 tabular-nums">
              {formatFCFA(monthExpensesTotal)}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
