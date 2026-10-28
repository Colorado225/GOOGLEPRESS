import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getPressingAlerts, type PressingAlert } from '../../lib/alerts';

interface PressingAlertsButtonProps {
  title: string;
  buttonClassName: string;
  dotClassName?: string;
}

const severityClasses: Record<PressingAlert['severity'], string> = {
  critical:
    'bg-red-50/70 dark:bg-red-950/70 border-red-100 dark:border-red-900 text-red-900 dark:text-red-100',
  warning:
    'bg-amber-50/70 dark:bg-amber-950/70 border-amber-100 dark:border-amber-900 text-amber-900 dark:text-amber-100',
  info:
    'bg-blue-50/70 dark:bg-blue-950/70 border-blue-100 dark:border-blue-900 text-blue-900 dark:text-blue-100',
};

export const PressingAlertsButton: React.FC<PressingAlertsButtonProps> = ({
  title,
  buttonClassName,
  dotClassName = 'absolute top-1 right-1 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white',
}) => {
  const { orders, products, setActiveScreen, setPreviewTicket } = useApp();
  const [open, setOpen] = useState(false);
  const alerts = getPressingAlerts(orders, products);

  const handleAlertClick = (alert: PressingAlert) => {
    if (alert.orderId) {
      const order = orders.find((item) => item.id === alert.orderId);
      if (order) {
        setPreviewTicket(order);
        setOpen(false);
        return;
      }
    }
    setActiveScreen(alert.screen);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={buttonClassName}
        title="Alertes pressing"
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {alerts.length > 0 && <span className={dotClassName} aria-hidden="true" />}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-3 z-50 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100">{title}</p>
            <span className="text-[10px] bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-semibold">
              {alerts.length} alerte(s)
            </span>
          </div>

          <div className="space-y-2 mt-2 text-[12px]">
            {alerts.length === 0 ? (
              <p className="p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/70 border border-emerald-100 dark:border-emerald-900 text-emerald-900 dark:text-emerald-100">
                Aucune alerte active : retards, stock et notifications locales sont à jour.
              </p>
            ) : (
              alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => handleAlertClick(alert)}
                  className={`w-full p-2 rounded-lg border text-left transition-colors hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 ${severityClasses[alert.severity]}`}
                >
                  <span className="block font-semibold">{alert.title}</span>
                  <span className="block text-[11px] opacity-80">{alert.detail}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
