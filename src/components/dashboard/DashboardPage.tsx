import React from 'react';
import { useApp } from '../../context/AppContext';
import { AppHeader } from '../layout/AppHeader';
import { MetricCards } from './MetricCards';
import { RevenueChart } from './RevenueChart';
import { QuickActionsAndAlerts } from './QuickActionsAndAlerts';
import { RecentOrdersTable } from './RecentOrdersTable';
import { Plus, ShoppingBag } from 'lucide-react';
import { capitalize, formatLongDate } from '../../lib/dates';
import { getWorkspaceLabel, isLiveWorkspace } from '../../lib/workspaceScope';
import { Reveal } from '../common/Reveal';

export const DashboardPage: React.FC = () => {
  const { setActiveScreen, workspace, orders, customers } = useApp();
  const workspaceLabel = getWorkspaceLabel(workspace);

  // Un pressing réellement créé démarre sans aucune donnée : le tableau de
  // bord affiche des zéros et un message d'accueil, jamais des chiffres
  // empruntés à la démonstration.
  const isEmptyWorkspace = isLiveWorkspace(workspace) && orders.length === 0;

  return (
    <div className="flex-1 p-3 sm:p-5 pl-2 sm:pl-4 max-w-[1366px]">
      <AppHeader
        title="Tableau de bord"
        subtitle={`${capitalize(formatLongDate(new Date()))} • ${workspaceLabel}`}
        primaryAction={{
          label: '+ Nouvelle réception',
          onClick: () => setActiveScreen('pos'),
        }}
      />

      {isEmptyWorkspace && (
        <Reveal>
          <section className="mb-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-4 sm:px-5 shadow-2xs">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">
                  Votre espace démarre vide
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {customers.length === 0
                    ? 'Aucune donnée de démonstration n’a été reprise : pas de client, pas de commande, pas d’employé. Les indicateurs ci-dessous resteront à zéro jusqu’à votre première réception.'
                    : 'Aucune réception enregistrée pour le moment. Les indicateurs se rempliront dès la première commande.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveScreen('pos')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#09090b] px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Enregistrer une réception
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveScreen('clients')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Ouvrir les clients
                  </button>
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      )}

      <Reveal>
        <MetricCards />
      </Reveal>

      <Reveal delay={90}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div>
          <QuickActionsAndAlerts />
        </div>
        </div>
      </Reveal>

      <Reveal delay={160}>
        <RecentOrdersTable />
      </Reveal>
    </div>
  );
};
