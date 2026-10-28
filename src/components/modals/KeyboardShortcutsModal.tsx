import React from 'react';
import { useApp } from '../../context/AppContext';
import { X, Keyboard, Command, Sparkles } from 'lucide-react';

export const KeyboardShortcutsModal: React.FC = () => {
  const { shortcutHelpOpen, setShortcutHelpOpen, setActiveScreen, setClosingZModalOpen, toggleSidebar, toggleTheme } = useApp();

  if (!shortcutHelpOpen) return null;

  const categories = [
    {
      title: 'Navigation & Recherche Rapide',
      shortcuts: [
        { key: '⌘ + K', alt: 'Ctrl + K', single: '', label: 'Recherche rapide (ticket, client, vêtement)', action: () => {} },
        { key: 'F1', alt: 'Alt + 1', single: 'D', label: 'Tableau de bord', action: () => setActiveScreen('dashboard') },
        { key: 'F2', alt: 'Alt + 2', single: 'N / R', label: 'Réception comptoir (POS)', action: () => setActiveScreen('pos') },
        { key: 'F3', alt: 'Alt + 3', single: 'A / W', label: 'Atelier de production (Kanban)', action: () => setActiveScreen('workshop') },
        { key: 'F4', alt: 'Alt + 4', single: '', label: 'Caisse & Clôture journalière (Z)', action: () => setClosingZModalOpen(true) },
        { key: 'Alt + 5', alt: 'Alt + U', single: '', label: 'Fichier Clients', action: () => setActiveScreen('clients') },
        { key: 'Alt + 6', alt: 'Alt + O', single: '', label: 'Toutes les Commandes', action: () => setActiveScreen('orders') },
        { key: 'Alt + 7', alt: '', single: '', label: 'Personnel & présences', action: () => setActiveScreen('employees') },
        { key: 'Alt + 8', alt: '', single: '', label: 'Stocks & inventaire', action: () => setActiveScreen('inventory') },
        { key: 'Alt + 9', alt: '', single: '', label: 'Dépenses', action: () => setActiveScreen('expenses') },
        { key: 'Alt + 0', alt: '', single: '', label: 'Rapports', action: () => setActiveScreen('reports') },
      ],
    },
    {
      title: 'Interface & Fenêtres',
      shortcuts: [
        { key: 'Alt + S', alt: 'B', single: '', label: 'Coulisser / Replier la barre latérale', action: toggleSidebar },
        { key: 'Alt + T', alt: '', single: '', label: 'Basculer le thème clair / sombre', action: toggleTheme },
        { key: 'Echap', alt: 'Esc', single: '', label: 'Fermer toute boîte de dialogue / ticket', action: () => setShortcutHelpOpen(false) },
        { key: 'F9', alt: '?', single: '', label: 'Afficher ce guide des raccourcis', action: () => {} },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#09090b] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[15.5px]">Raccourcis Clavier Express</h3>
              <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500">Optimisé pour la vitesse de saisie au comptoir</p>
            </div>
          </div>
          <button
            onClick={() => setShortcutHelpOpen(false)}
            className="text-zinc-400 dark:text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-[13px] max-h-[75vh] overflow-y-auto">
          <p className="text-zinc-600 dark:text-zinc-400 text-[12px] bg-blue-50/80 dark:bg-blue-950/80 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              Les touches directes (<strong>D</strong>, <strong>N</strong>, <strong>A</strong>, <strong>B</strong>) fonctionnent lorsque le curseur n'est pas dans un champ texte.
            </span>
          </p>

          {categories.map((cat, i) => (
            <div key={i} className="space-y-2">
              <h4 className="text-[11.5px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                {cat.title}
              </h4>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-zinc-50/50 dark:bg-zinc-800/50">
                {cat.shortcuts.map((sc, j) => (
                  <div
                    key={j}
                    onClick={() => {
                      sc.action();
                      setShortcutHelpOpen(false);
                    }}
                    className="p-2.5 flex items-center justify-between hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 cursor-pointer transition-colors"
                  >
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-[12.5px]">{sc.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <kbd className="px-2 py-1 text-[11px] font-bold bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-600 rounded shadow-2xs tabular-nums">
                        {sc.key}
                      </kbd>
                      {sc.alt && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">ou</span>
                      )}
                      {sc.alt && (
                        <kbd className="px-1.5 py-1 text-[10.5px] font-semibold bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded shadow-2xs">
                          {sc.alt}
                        </kbd>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-zinc-50 dark:bg-zinc-800 px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 flex justify-between items-center text-[11.5px] text-zinc-500 dark:text-zinc-400">
          <span>Appuyez sur <kbd className="font-bold border px-1 py-0.5 rounded bg-white dark:bg-zinc-900">Echap</kbd> pour fermer</span>
          <button
            onClick={() => setShortcutHelpOpen(false)}
            className="bg-[#09090b] dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold px-4 py-1.5 rounded-lg text-xs hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Compris
          </button>
        </div>
      </div>
    </div>
  );
};
