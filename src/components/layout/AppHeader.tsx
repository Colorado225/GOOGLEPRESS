import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Bell, Calendar, ChevronDown, Plus, Sparkles, Keyboard, PanelLeft } from 'lucide-react';
import { formatShortDate } from '../../lib/dates';

interface AppHeaderProps {
  title: string;
  subtitle: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  onSearch?: (term: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  onSearch,
}) => {
  const { setActiveScreen, showToast, toggleSidebar, isSidebarCollapsed, setShortcutHelpOpen } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (onSearch) {
      onSearch(term);
    }
  };

  return (
    <header className="mb-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? 'Déployer la barre latérale (Alt+S)' : 'Replier la barre latérale (Alt+S)'}
            className="hidden md:flex p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 rounded-lg transition-colors shadow-2xs"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h1>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md">
                Abidjan Cocody
              </span>
            </div>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 font-normal mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Global Search */}
          <div className="relative min-w-[180px] lg:min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Rechercher ticket, client..."
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-[12.5px] rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            />
          </div>

          {/* Date pill */}
          <div className="hidden sm:flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-[12.5px] font-medium text-zinc-700 dark:text-zinc-300 rounded-lg shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span className="tabular-nums">{formatShortDate(new Date())}</span>
          </div>

          {/* Keyboard shortcut guide button */}
          <button
            type="button"
            onClick={() => setShortcutHelpOpen(true)}
            className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs flex items-center gap-1.5"
            title="Raccourcis clavier (F9 / ?)"
          >
            <Keyboard className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span className="hidden xl:inline text-[11.5px] font-semibold text-zinc-600 dark:text-zinc-400">Raccourcis</span>
            <kbd className="hidden lg:inline px-1 py-0.2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded text-[9.5px] font-mono text-zinc-500 dark:text-zinc-400">
              ?
            </kbd>
          </button>

          {/* Notification Button */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white" />
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-3 z-50 text-left">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100">Notifications pressing</p>
                  <span className="text-[10px] bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-semibold">
                    3 alertes
                  </span>
                </div>
                <div className="space-y-2 mt-2 text-[12px]">
                  <div className="p-2 rounded-lg bg-red-50/70 dark:bg-red-950/70 border border-red-100 dark:border-red-900 text-red-900 dark:text-red-100">
                    <p className="font-semibold">6 commandes en retard</p>
                    <p className="text-[11px] text-red-700 dark:text-red-300">Costumes #TK-2841 promis hier 17h</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/70 border border-amber-100 dark:border-amber-900 text-amber-900 dark:text-amber-100">
                    <p className="font-semibold">Stock détachant bas</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">Reste 1 bidon détachant gras</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50/70 dark:bg-blue-950/70 border border-blue-100 dark:border-blue-900 text-blue-900 dark:text-blue-100">
                    <p className="font-semibold">Maintenance Machine L2</p>
                    <p className="text-[11px] text-blue-700 dark:text-blue-300">Planifiée 14h–16h</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[12.5px] font-semibold rounded-lg transition-colors shadow-2xs flex items-center gap-1.5"
            >
              {secondaryAction.icon}
              <span>{secondaryAction.label}</span>
            </button>
          )}

          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              className="px-3.5 py-1.5 bg-[#09090b] dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-[13px] font-semibold rounded-lg transition-colors shadow flex items-center gap-1.5"
            >
              {primaryAction.icon || <Plus className="w-3.5 h-3.5" />}
              <span>{primaryAction.label}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
