import { useState } from 'react';
import type { NotifyFn, ScreenId, SettingsTab, WorkshopTab } from './types';

export interface NavigationDeps {
  notify: NotifyFn;
}

export interface NavigationStore {
  activeScreen: ScreenId;
  setActiveScreen: (screen: ScreenId) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  workshopTabRequest: WorkshopTab | null;
  requestWorkshopTab: (tab: WorkshopTab) => void;
  clearWorkshopTabRequest: () => void;
  activeWorkshopTab: WorkshopTab;
  setActiveWorkshopTab: (tab: WorkshopTab) => void;
  settingsTabRequest: SettingsTab | null;
  requestSettingsTab: (tab: SettingsTab) => void;
  clearSettingsTabRequest: () => void;
}

/**
 * Navigation du shell ERP : écran actif, barre latérale, tiroir mobile et
 * demandes ponctuelles d'ouverture d'un onglet précis (atelier, paramètres).
 */
export const useNavigation = ({ notify }: NavigationDeps): NavigationStore => {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [workshopTabRequest, setWorkshopTabRequest] = useState<WorkshopTab | null>(null);
  // Onglet courant de l'atelier : la barre latérale le lit pour surligner le
  // bon sous-onglet, et l'écran Atelier l'écrit quand l'utilisateur navigue.
  const [activeWorkshopTab, setActiveWorkshopTab] = useState<WorkshopTab>('production');
  const [settingsTabRequest, setSettingsTabRequest] = useState<SettingsTab | null>(null);

  const requestWorkshopTab = (tab: WorkshopTab) => {
    setWorkshopTabRequest(tab);
    // Mémorisé tout de suite : la barre latérale surligne le sous-onglet sans
    // attendre le montage de l'écran Atelier.
    setActiveWorkshopTab(tab);
    setActiveScreen('workshop');
  };
  const clearWorkshopTabRequest = () => setWorkshopTabRequest(null);
  const requestSettingsTab = (tab: SettingsTab) => {
    setSettingsTabRequest(tab);
    setActiveScreen('settings');
  };
  const clearSettingsTabRequest = () => setSettingsTabRequest(null);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      notify(next ? 'Barre latérale repliée (Alt+S)' : 'Barre latérale déployée (Alt+S)');
      return next;
    });
  };

  // Tiroir de navigation mobile (< 768 px) : la barre latérale devient un panneau coulissant
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  return {
    activeScreen,
    setActiveScreen,
    isSidebarCollapsed,
    toggleSidebar,
    isMobileMenuOpen,
    setMobileMenuOpen: setIsMobileMenuOpen,
    toggleMobileMenu,
    workshopTabRequest,
    requestWorkshopTab,
    clearWorkshopTabRequest,
    activeWorkshopTab,
    setActiveWorkshopTab,
    settingsTabRequest,
    requestSettingsTab,
    clearSettingsTabRequest,
  };
};
