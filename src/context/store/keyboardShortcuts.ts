import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { LaundryOrder } from '../../types';
import type { NotifyFn, ScreenId } from './types';

export interface KeyboardShortcutsDeps {
  setActiveScreen: (screen: ScreenId) => void;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  previewTicket: LaundryOrder | null;
  setPreviewTicket: (order: LaundryOrder | null) => void;
  closingZModalOpen: boolean;
  setClosingZModalOpen: (open: boolean) => void;
  newCustomerModalOpen: boolean;
  setNewCustomerModalOpen: (open: boolean) => void;
  shortcutHelpOpen: boolean;
  setShortcutHelpOpen: Dispatch<SetStateAction<boolean>>;
  notify: NotifyFn;
}

/**
 * Raccourcis clavier globaux façon logiciel de caisse : F1–F4, Alt+chiffres,
 * Alt+S (barre latérale), Alt+T (thème), F9 / ? (aide), Échap (fermeture) et
 * touches simples hors champs de saisie.
 */
export const useKeyboardShortcuts = ({
  setActiveScreen,
  toggleSidebar,
  toggleTheme,
  previewTicket,
  setPreviewTicket,
  closingZModalOpen,
  setClosingZModalOpen,
  newCustomerModalOpen,
  setNewCustomerModalOpen,
  shortcutHelpOpen,
  setShortcutHelpOpen,
  notify,
}: KeyboardShortcutsDeps): void => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl && activeEl.getAttribute('contenteditable') === 'true');

      // Global F-keys & Alt combinations (always active)
      if (e.key === 'F1' || (e.altKey && e.key === '1')) {
        e.preventDefault();
        setActiveScreen('dashboard');
        notify('Tableau de bord (F1)');
        return;
      }
      if (e.key === 'F2' || (e.altKey && e.key === '2')) {
        e.preventDefault();
        setActiveScreen('pos');
        notify('Réception comptoir POS (F2)');
        return;
      }
      if (e.key === 'F3' || (e.altKey && e.key === '3')) {
        e.preventDefault();
        setActiveScreen('workshop');
        notify('Atelier de production (F3)');
        return;
      }
      if (e.key === 'F4' || (e.altKey && e.key === '4')) {
        e.preventDefault();
        setClosingZModalOpen(true);
        return;
      }
      if (e.altKey && (e.key === '5' || e.key.toLowerCase() === 'u')) {
        e.preventDefault();
        setActiveScreen('clients');
        notify('Fichier clients (Alt+5)');
        return;
      }
      if (e.altKey && (e.key === '6' || e.key.toLowerCase() === 'o')) {
        e.preventDefault();
        setActiveScreen('orders');
        notify('Commandes récentes (Alt+6)');
        return;
      }
      if (e.altKey && e.key === '7') {
        e.preventDefault();
        setActiveScreen('employees');
        notify('Personnel (Alt+7)');
        return;
      }
      if (e.altKey && e.key === '8') {
        e.preventDefault();
        setActiveScreen('inventory');
        notify('Stocks (Alt+8)');
        return;
      }
      if (e.altKey && e.key === '9') {
        e.preventDefault();
        setActiveScreen('expenses');
        notify('Dépenses (Alt+9)');
        return;
      }
      if (e.altKey && e.key === '0') {
        e.preventDefault();
        setActiveScreen('reports');
        notify('Rapports (Alt+0)');
        return;
      }
      if (e.altKey && (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        toggleTheme();
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        setShortcutHelpOpen((prev) => !prev);
        return;
      }

      // Escape closes any open modal
      if (e.key === 'Escape') {
        if (previewTicket) setPreviewTicket(null);
        if (closingZModalOpen) setClosingZModalOpen(false);
        if (newCustomerModalOpen) setNewCustomerModalOpen(false);
        if (shortcutHelpOpen) setShortcutHelpOpen(false);
        return;
      }

      // Single-key shortcuts when not typing in form fields
      if (!isInputFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key.toLowerCase() === 'd') {
          setActiveScreen('dashboard');
          notify('Tableau de bord [D]');
        } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'r') {
          setActiveScreen('pos');
          notify('Réception [N]');
        } else if (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'w') {
          setActiveScreen('workshop');
          notify('Atelier [A]');
        } else if (e.key.toLowerCase() === 'b') {
          toggleSidebar();
        } else if (e.key === '?') {
          setShortcutHelpOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewTicket, closingZModalOpen, newCustomerModalOpen, shortcutHelpOpen]);
};
