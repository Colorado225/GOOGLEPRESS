/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { CustomerPortalApp } from './components/customer/CustomerPortalApp';
import {
  getCanonicalCustomerPath,
  isCustomerPath,
  parseCustomerRoute,
} from './lib/customerAuth';
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
import { PWA_UPDATE_EVENT } from './lib/pwa';

const MainLayout: React.FC = () => {
  const { activeScreen, isSidebarCollapsed, isMobileMenuOpen, setMobileMenuOpen, showToast } = useApp();

  // Fermer le tiroir de navigation mobile avec la touche Échap
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen, setMobileMenuOpen]);

  // Refermer automatiquement le tiroir quand la fenêtre repasse en largeur tablette/bureau
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileMenuOpen(false);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [setMobileMenuOpen]);

  // Mise à jour PWA téléchargée : prévenir sans interrompre le travail en cours
  useEffect(() => {
    const onPwaUpdate = () =>
      showToast('Nouvelle version de l’application disponible : rechargez la page pour l’appliquer');
    window.addEventListener(PWA_UPDATE_EVENT, onPwaUpdate);
    return () => window.removeEventListener(PWA_UPDATE_EVENT, onPwaUpdate);
  }, [showToast]);

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans antialiased selection:bg-blue-600 selection:text-white flex flex-col">
      {/* Main Layout Header (contains Desktop Sidebar Toggle Trigger, Breadcrumbs, Shortcuts & Profile) */}
      <MainLayoutHeader />

      {/* Main Container */}
      <div className="max-w-[1366px] w-full mx-auto flex-1 flex flex-col md:flex-row relative items-stretch">
        {/* Fond assombri du tiroir mobile : un appui dessus referme la navigation */}
        {isMobileMenuOpen && (
          <div
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 z-30 md:hidden animate-in fade-in duration-150"
          />
        )}

        {/* Barre latérale : coulissante/repliable sur bureau, tiroir par-dessus le contenu sur mobile */}
        <div
          id="app-sidebar-nav"
          className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out self-stretch flex-col ${
            isMobileMenuOpen
              ? 'flex fixed inset-y-0 left-0 z-40 w-[255px] opacity-100 translate-x-0 animate-in slide-in-from-left duration-200'
              : 'hidden md:flex'
          } md:static md:z-auto ${
            isSidebarCollapsed
              ? 'md:w-0 md:opacity-0 md:-translate-x-full md:pointer-events-none'
              : 'md:w-[255px] md:opacity-100 md:translate-x-0'
          }`}
        >
          <AppSidebar />
        </div>

        {/* Dynamic Screen View with smooth expand */}
        <main className="flex-1 w-full min-w-0 flex flex-col transition-all duration-300 ease-in-out">
          {/* Transition d'écran : fondu + légère montée à chaque changement de page */}
          <div key={activeScreen} className="screen-enter flex-1 flex flex-col min-h-0">
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
          </div>
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
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    if (options?.replace) window.history.replaceState({}, '', path);
    else window.history.pushState({}, '', path);
    setPathname(window.location.pathname);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const canonicalPath = getCanonicalCustomerPath(pathname);
    if (canonicalPath !== pathname) {
      navigate(
        `${canonicalPath}${window.location.search}${window.location.hash}`,
        { replace: true }
      );
    }
  }, [navigate, pathname]);

  // L'espace client est volontairement hors du shell ERP et de son contexte
  // local : un client ne doit ni voir la navigation métier ni charger les
  // données de démonstration du poste du pressing.
  if (isCustomerPath(pathname)) {
    return (
      <CustomerPortalApp
        route={parseCustomerRoute(pathname)}
        onNavigate={navigate}
      />
    );
  }

  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
