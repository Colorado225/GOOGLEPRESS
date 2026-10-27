/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppSidebar } from './components/layout/AppSidebar';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { PosPage } from './components/pos/PosPage';
import { WorkshopPage } from './components/workshop/WorkshopPage';
import { OrdersPage } from './components/orders/OrdersPage';
import { ClientsPage } from './components/clients/ClientsPage';
import { EmployeesPage } from './components/employees/EmployeesPage';
import { InventoryPage } from './components/inventory/InventoryPage';
import { ExpensesPage } from './components/expenses/ExpensesPage';
import { ReportsPage } from './components/reports/ReportsPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { TicketPreviewModal } from './components/modals/TicketPreviewModal';
import { DailyClosingModal } from './components/modals/DailyClosingModal';
import { NewCustomerModal } from './components/pos/NewCustomerModal';
import { KeyboardShortcutsModal } from './components/modals/KeyboardShortcutsModal';
import { ToastNotification } from './components/common/ToastNotification';
import { MainLayoutHeader } from './components/layout/MainLayoutHeader';
import { Menu, X } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeScreen, isSidebarCollapsed } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f4f4f5] text-zinc-900 font-sans antialiased selection:bg-blue-600 selection:text-white flex flex-col">
      {/* Main Layout Header (contains Desktop Sidebar Toggle Trigger, Breadcrumbs, Shortcuts & Profile) */}
      <MainLayoutHeader />

      {/* Main Container */}
      <div className="max-w-[1366px] w-full mx-auto flex-1 flex flex-col md:flex-row relative items-stretch">
        {/* Desktop Collapsible Sliding Sidebar */}
        <div
          className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out self-stretch flex flex-col ${
            isSidebarCollapsed
              ? 'w-0 opacity-0 -translate-x-full pointer-events-none'
              : 'w-[255px] opacity-100 translate-x-0'
          } ${mobileMenuOpen ? 'flex' : 'hidden md:flex'}`}
        >
          <AppSidebar />
        </div>

        {/* Dynamic Screen View with smooth expand */}
        <main className="flex-1 w-full min-w-0 flex flex-col transition-all duration-300 ease-in-out">
          {activeScreen === 'dashboard' && <DashboardPage />}
          {activeScreen === 'pos' && <PosPage />}
          {activeScreen === 'workshop' && <WorkshopPage />}
          {activeScreen === 'orders' && <OrdersPage />}
          {activeScreen === 'clients' && <ClientsPage />}
          {activeScreen === 'employees' && <EmployeesPage />}
          {activeScreen === 'inventory' && <InventoryPage />}
          {activeScreen === 'expenses' && <ExpensesPage />}
          {activeScreen === 'reports' && <ReportsPage />}
          {activeScreen === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Interactive ERP Modals */}
      <TicketPreviewModal />
      <DailyClosingModal />
      <NewCustomerModal />
      <KeyboardShortcutsModal />
      <ToastNotification />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
