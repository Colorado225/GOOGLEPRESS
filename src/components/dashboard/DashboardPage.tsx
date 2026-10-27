import React from 'react';
import { useApp } from '../../context/AppContext';
import { AppHeader } from '../layout/AppHeader';
import { MetricCards } from './MetricCards';
import { RevenueChart } from './RevenueChart';
import { QuickActionsAndAlerts } from './QuickActionsAndAlerts';
import { RecentOrdersTable } from './RecentOrdersTable';
import { Plus } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { setActiveScreen } = useApp();

  return (
    <div className="flex-1 p-3 sm:p-5 pl-2 sm:pl-4 max-w-[1366px]">
      <AppHeader
        title="Tableau de bord"
        subtitle="Mardi 27 octobre 2026 • Presse Cocody — Vue ERP Pro"
        primaryAction={{
          label: '+ Nouvelle réception',
          onClick: () => setActiveScreen('pos'),
        }}
      />

      <MetricCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div>
          <QuickActionsAndAlerts />
        </div>
      </div>

      <RecentOrdersTable />
    </div>
  );
};
