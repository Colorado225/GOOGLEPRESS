/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { StaffAccessGate } from './components/auth/StaffAccessGate';

const CustomerPortalApp = lazy(() =>
  import('./components/customer/CustomerPortalApp').then((module) => ({
    default: module.CustomerPortalApp,
  }))
);
const StaffLoginPage = lazy(() =>
  import('./components/auth/StaffLoginPage').then((module) => ({
    default: module.StaffLoginPage,
  }))
);
const StaffRegisterPage = lazy(() =>
  import('./components/auth/StaffRegisterPage').then((module) => ({
    default: module.StaffRegisterPage,
  }))
);
const StaffOnboardingPage = lazy(() =>
  import('./components/auth/StaffOnboardingPage').then((module) => ({
    default: module.StaffOnboardingPage,
  }))
);
const LegalPage = lazy(() =>
  import('./components/auth/LegalPage').then((module) => ({
    default: module.LegalPage,
  }))
);
const PlatformAdminGate = lazy(() =>
  import('./components/platform-admin/PlatformAdminGate').then((module) => ({
    default: module.PlatformAdminGate,
  }))
);
const PlatformAdminPage = lazy(() =>
  import('./components/platform-admin/PlatformAdminPage').then((module) => ({
    default: module.PlatformAdminPage,
  }))
);
import { getCanonicalCustomerPath } from './lib/customerAuth';
import { resolveAppRoute } from './lib/routes';
import { useErpRouteSync } from './components/layout/useErpRouteSync';
import { AppSidebar } from './components/layout/AppSidebar';

// Les écrans métier sont chargés à la demande : ouvrir le tableau de bord ne
// doit plus télécharger d'emblée le POS, les rapports et les paramètres.
const DashboardPage = lazy(() =>
  import('./components/dashboard/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  }))
);
const PosPage = lazy(() =>
  import('./components/pos/PosPage').then((module) => ({ default: module.PosPage }))
);
const WorkshopPage = lazy(() =>
  import('./components/workshop/WorkshopPage').then((module) => ({
    default: module.WorkshopPage,
  }))
);
const CourierPage = lazy(() =>
  import('./components/courier/CourierPage').then((module) => ({
    default: module.CourierPage,
  }))
);
const OrdersPage = lazy(() =>
  import('./components/orders/OrdersPage').then((module) => ({
    default: module.OrdersPage,
  }))
);
const ClientsPage = lazy(() =>
  import('./components/clients/ClientsPage').then((module) => ({
    default: module.ClientsPage,
  }))
);
const EmployeesPage = lazy(() =>
  import('./components/employees/EmployeesPage').then((module) => ({
    default: module.EmployeesPage,
  }))
);
const InventoryPage = lazy(() =>
  import('./components/inventory/InventoryPage').then((module) => ({
    default: module.InventoryPage,
  }))
);
const ExpensesPage = lazy(() =>
  import('./components/expenses/ExpensesPage').then((module) => ({
    default: module.ExpensesPage,
  }))
);
const ReportsPage = lazy(() =>
  import('./components/reports/ReportsPage').then((module) => ({
    default: module.ReportsPage,
  }))
);
const SettingsPage = lazy(() =>
  import('./components/settings/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  }))
);
import { TicketPreviewModal } from './components/modals/TicketPreviewModal';
import { DailyClosingModal } from './components/modals/DailyClosingModal';
import { NewCustomerModal } from './components/pos/NewCustomerModal';
import { KeyboardShortcutsModal } from './components/modals/KeyboardShortcutsModal';
import { ToastNotification } from './components/common/ToastNotification';
import { MainLayoutHeader } from './components/layout/MainLayoutHeader';
import { PlatformAnnouncement } from './components/layout/PlatformAnnouncement';
import { PWA_UPDATE_EVENT } from './lib/pwa';

const ScreenLoadingFallback: React.FC = () => (
  <div
    role="status"
    className="flex flex-1 items-center justify-center px-6 py-16 text-[13.5px] font-semibold text-zinc-500 dark:text-zinc-400"
  >
    Chargement de l’écran…
  </div>
);

/** Route ERP inconnue : explicite, dans le shell, avec retour au pilotage. */
const ErpNotFound: React.FC<{ path: string; onGoHome: () => void }> = ({
  path,
  onGoHome,
}) => (
  <section className="flex flex-1 items-center justify-center px-6 py-16">
    <div className="w-full max-w-md text-center">
      <p className="text-5xl font-black tracking-tight text-zinc-300 dark:text-zinc-700">
        404
      </p>
      <h1 className="mt-4 text-2xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">
        Page introuvable
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        L’adresse « {path} » ne correspond à aucun écran de l’application.
        Vérifiez le lien utilisé, ou reprenez depuis le tableau de bord.
      </p>
      <button
        type="button"
        onClick={onGoHome}
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-zinc-950 px-5 py-3 text-[13.5px] font-black text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-900/20 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Retour au tableau de bord
      </button>
    </div>
  </section>
);

const MainLayout: React.FC = () => {
  const { activeScreen, isSidebarCollapsed, isMobileMenuOpen, setMobileMenuOpen, showToast } = useApp();
  const { unknownPath, goToScreen } = useErpRouteSync();

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
      showToast('Nouvelle version disponible : cliquez sur Actualiser quand vous souhaitez l’appliquer');
    window.addEventListener(PWA_UPDATE_EVENT, onPwaUpdate);
    return () => window.removeEventListener(PWA_UPDATE_EVENT, onPwaUpdate);
  }, [showToast]);

  return (
    <div className="min-h-screen bg-[#f4f4f5] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans antialiased selection:bg-blue-600 selection:text-white flex flex-col">
      {/* Main Layout Header (contains Desktop Sidebar Toggle Trigger, Breadcrumbs, Shortcuts & Profile) */}
      <MainLayoutHeader />
      <PlatformAnnouncement />

      {/* Main Container */}
      <div className="max-w-none w-full mx-auto flex-1 flex flex-col md:flex-row relative items-stretch">
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
          <div
            key={unknownPath ? 'not-found' : activeScreen}
            className="screen-enter flex-1 flex flex-col min-h-0"
          >
            <Suspense fallback={<ScreenLoadingFallback />}>
              {unknownPath ? (
                <ErpNotFound
                  path={unknownPath}
                  onGoHome={() => goToScreen('dashboard')}
                />
              ) : (
                <>
                  {activeScreen === 'dashboard' && <DashboardPage />}
                  {activeScreen === 'pos' && <PosPage />}
                  {activeScreen === 'workshop' && <WorkshopPage />}
                  {activeScreen === 'courier' && <CourierPage />}
                  {activeScreen === 'orders' && <OrdersPage />}
                  {activeScreen === 'clients' && <ClientsPage />}
                  {activeScreen === 'employees' && <EmployeesPage />}
                  {activeScreen === 'inventory' && <InventoryPage />}
                  {activeScreen === 'expenses' && <ExpensesPage />}
                  {activeScreen === 'reports' && <ReportsPage />}
                  {activeScreen === 'settings' && <SettingsPage />}
                </>
              )}
            </Suspense>
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

  // Contexte d'implémentation du chemin demandé (voir `lib/routes.ts`) :
  // espace client, pages légales et accès du personnel vivent hors du
  // shell ERP ; tout le reste relève de l'ERP protégé par la garde.
  const appRoute = resolveAppRoute(pathname);

  // Administration de l'éditeur : frontière et contexte totalement séparés de
  // l'ERP. Aucun état métier local d'un pressing n'est monté sur cette route.
  if (appRoute.context === 'platform-admin') {
    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        <PlatformAdminGate>
          <PlatformAdminPage onNavigate={navigate} />
        </PlatformAdminGate>
      </Suspense>
    );
  }

  // L'espace client est volontairement hors du shell ERP et de son contexte
  // local : un client ne doit ni voir la navigation métier ni charger les
  // données de démonstration du poste du pressing.
  if (appRoute.context === 'customer') {
    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        <CustomerPortalApp route={appRoute.route} onNavigate={navigate} />
      </Suspense>
    );
  }

  // Pages d'information légale : publiques et statiques, liées depuis
  // l'inscription sans charger l'état métier.
  if (appRoute.context === 'legal') {
    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        <LegalPage kind={appRoute.route} onNavigate={navigate} />
      </Suspense>
    );
  }

  // Pages publiques du personnel : également hors AppProvider, pour ne
  // charger ni l'état local ni les données de démonstration avant connexion.
  if (appRoute.context === 'staff') {
    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        {appRoute.route === 'login' && <StaffLoginPage onNavigate={navigate} />}
        {appRoute.route === 'register' && (
          <StaffRegisterPage onNavigate={navigate} />
        )}
        {appRoute.route === 'onboarding' && (
          <StaffOnboardingPage onNavigate={navigate} />
        )}
      </Suspense>
    );
  }

  return (
    <StaffAccessGate>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </StaffAccessGate>
  );
}
