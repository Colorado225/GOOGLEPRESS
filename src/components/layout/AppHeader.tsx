import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, Calendar, ChevronDown, Plus, Sparkles, Keyboard, PanelLeft } from 'lucide-react';
import { formatShortDate } from '../../lib/dates';
import { PressingAlertsButton } from './PressingAlertsButton';
import { getWorkspaceLabel } from '../../lib/workspaceScope';

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
  const {
    setActiveScreen,
    showToast,
    toggleSidebar,
    isSidebarCollapsed,
    setShortcutHelpOpen,
    workspace,
  } = useApp();
  const workspaceLabel = getWorkspaceLabel(workspace);
  const [searchTerm, setSearchTerm] = useState('');

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
              <span
                className="hidden sm:inline-block max-w-[220px] truncate px-2 py-0.5 text-[11px] font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md"
                title={workspaceLabel}
              >
                {workspaceLabel}
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
          <PressingAlertsButton
            title="Notifications pressing"
            buttonClassName="relative p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
            dotClassName="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white"
          />

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
