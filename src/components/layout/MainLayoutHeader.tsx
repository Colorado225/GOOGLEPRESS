import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Keyboard,
  Bell,
  Calendar,
  Sparkles,
  Plus,
  Lock,
  ChevronRight,
  Search,
  X,
  User,
  FileText,
  Clock,
} from 'lucide-react';
import { formatFCFA } from '../../data/demoData';
import { formatShortDate } from '../../lib/dates';

export const MainLayoutHeader: React.FC = () => {
  const {
    activeScreen,
    setActiveScreen,
    isSidebarCollapsed,
    toggleSidebar,
    isMobileMenuOpen,
    toggleMobileMenu,
    setShortcutHelpOpen,
    orders,
    customers,
    setPreviewTicket,
    setSelectedCustomer,
    showToast,
  } = useApp();

  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Global shortcut: Cmd+K / Ctrl+K to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
          setSearchDropdownOpen(true);
        }
      }

      // Close search dropdown on Escape
      if (e.key === 'Escape' && searchDropdownOpen) {
        setSearchDropdownOpen(false);
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchDropdownOpen]);

  // Handle outside clicks to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getScreenTitle = () => {
    switch (activeScreen) {
      case 'dashboard':
        return 'Tableau de bord';
      case 'pos':
        return 'Nouvelle réception (POS)';
      case 'workshop':
        return 'Production & Atelier (Kanban)';
      case 'orders':
        return 'Commandes';
      case 'clients':
        return 'Fichier clients';
      case 'employees':
        return 'Personnel & présences';
      case 'inventory':
        return 'Stocks & inventaire';
      case 'expenses':
        return 'Dépenses';
      case 'reports':
        return 'Rapports';
      case 'settings':
        return 'Paramètres';
      default:
        return 'Tableau de bord';
    }
  };

  // Filter orders and customers
  const matchingOrders = searchQuery.trim()
    ? orders.filter(
        (o) =>
          o.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.customerPhone.includes(searchQuery) ||
          o.lines.some((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 5)
    : [];

  const matchingCustomers = searchQuery.trim()
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.phone.includes(searchQuery) ||
          c.address.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 3)
    : [];

  const hasResults = matchingOrders.length > 0 || matchingCustomers.length > 0;

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-30 px-3 sm:px-5 py-2 transition-all">
      <div className="flex items-center justify-between gap-3">
        {/* Left Section: Toggle Trigger, Brand & Breadcrumbs */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Bouton Menu mobile : ouvre le tiroir de navigation (visible sous 768 px) */}
          <button
            type="button"
            onClick={toggleMobileMenu}
            aria-expanded={isMobileMenuOpen}
            aria-controls="app-sidebar-nav"
            aria-label={isMobileMenuOpen ? 'Fermer le menu de navigation' : 'Ouvrir le menu de navigation'}
            title="Menu de navigation"
            className="flex md:hidden items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 text-[12px] font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Menu className="w-4 h-4" />
            <span>Menu</span>
          </button>

          {/* Desktop Sliding Sidebar Toggle Trigger */}
          <button
            type="button"
            onClick={toggleSidebar}
            title={
              isSidebarCollapsed
                ? 'Afficher la barre latérale (Alt+S)'
                : 'Masquer la barre latérale (Alt+S)'
            }
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-semibold transition-all shadow-2xs group cursor-pointer ${
              isSidebarCollapsed
                ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-black'
            }`}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-zinc-600 group-hover:scale-110 transition-transform" />
            )}
            <span className="hidden lg:inline">
              {isSidebarCollapsed ? 'Afficher menu' : 'Masquer menu'}
            </span>
            <kbd className="hidden xl:inline text-[9.5px] px-1 py-0.2 rounded bg-zinc-100 border border-zinc-300 text-zinc-500 font-mono">
              Alt+S
            </kbd>
          </button>

          {/* Collapsed Brand Mark */}
          {isSidebarCollapsed && (
            <div className="hidden md:flex items-center gap-2 pl-1 border-l border-zinc-200 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-black text-xs text-white shadow-xs">
                P
              </div>
              <span className="font-bold text-[13.5px] text-zinc-900 tracking-tight">
                PressingPro CI
              </span>
            </div>
          )}

          {/* Breadcrumb Trail */}
          <div className="flex items-center gap-1.5 text-[12.5px] text-zinc-500">
            <span
              className="hidden sm:inline hover:text-zinc-900 cursor-pointer transition-colors"
              onClick={() => setActiveScreen('dashboard')}
            >
              Pressing
            </span>
            <ChevronRight className="hidden sm:inline w-3 h-3 text-zinc-400" />
            <span className="font-bold text-zinc-900 truncate max-w-[140px] sm:max-w-none">
              {getScreenTitle()}
            </span>
          </div>
        </div>

        {/* Center Section: Rapid Search Input with Cmd/Ctrl + K */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-[420px] mx-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchDropdownOpen(true);
              }}
              onFocus={() => setSearchDropdownOpen(true)}
              placeholder="Rechercher ticket, client, habit..."
              className="w-full bg-zinc-50/80 hover:bg-white focus:bg-white border border-zinc-200 text-zinc-900 placeholder-zinc-400 text-[12.5px] rounded-lg pl-8 pr-16 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs"
            />
            {/* Shortcut Badge Cmd+K / Ctrl+K */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-0.5 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd
                  onClick={() => {
                    searchInputRef.current?.focus();
                  }}
                  className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white border border-zinc-300 rounded text-zinc-500 shadow-2xs cursor-pointer hover:bg-zinc-100"
                  title="Raccourci de recherche rapide (Cmd/Ctrl + K)"
                >
                  <span className="text-[9px]">⌘</span>K
                </kbd>
              )}
            </div>
          </div>

          {/* Search Dropdown Results */}
          {searchDropdownOpen && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-zinc-100 text-[12.5px] animate-in fade-in zoom-in-95 duration-100">
              {hasResults ? (
                <div className="max-h-[340px] overflow-y-auto">
                  {/* Matching Orders */}
                  {matchingOrders.length > 0 && (
                    <div className="p-2">
                      <p className="text-[10.5px] font-bold text-zinc-400 uppercase tracking-wider px-2 py-1">
                        Commandes trouvées
                      </p>
                      {matchingOrders.map((ord) => (
                        <div
                          key={ord.id}
                          onClick={() => {
                            setPreviewTicket(ord);
                            setSearchDropdownOpen(false);
                            setSearchQuery('');
                          }}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <div>
                              <p className="font-bold text-zinc-900">
                                {ord.ticketNumber} • {ord.customerName}
                              </p>
                              <p className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                                {ord.lines.map((l) => l.name).join(', ')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-zinc-900 tabular-nums">
                              {formatFCFA(ord.total)}
                            </span>
                            <span
                              className={`block text-[10px] font-semibold px-1.5 rounded-full ${
                                ord.status === 'ready'
                                  ? 'bg-purple-100 text-purple-700'
                                  : ord.status === 'washing'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-zinc-100 text-zinc-600'
                              }`}
                            >
                              {ord.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Matching Customers */}
                  {matchingCustomers.length > 0 && (
                    <div className="p-2 bg-zinc-50/50">
                      <p className="text-[10.5px] font-bold text-zinc-400 uppercase tracking-wider px-2 py-1">
                        Clients
                      </p>
                      {matchingCustomers.map((cust) => (
                        <div
                          key={cust.id}
                          onClick={() => {
                            setSelectedCustomer(cust);
                            setActiveScreen('pos');
                            setSearchDropdownOpen(false);
                            setSearchQuery('');
                            showToast(`Client ${cust.name} sélectionné pour dépôt au comptoir`);
                          }}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-white cursor-pointer transition-colors border border-transparent hover:border-zinc-200"
                        >
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <div>
                              <p className="font-bold text-zinc-900">{cust.name}</p>
                              <p className="text-[11px] text-zinc-500">
                                {cust.phone} • {cust.address}
                              </p>
                            </div>
                          </div>
                          <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                            Nouveau dépôt →
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-zinc-500 text-[12px]">
                  Aucun résultat pour « {searchQuery} »
                </div>
              )}

              {/* Quick tip footer */}
              <div className="p-2 bg-zinc-50 flex justify-between items-center text-[10.5px] text-zinc-400 px-3">
                <span>Appuyez sur Entrée pour valider ou Echap pour fermer</span>
                <span className="font-mono">Ctrl+K / ⌘K</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Shortcuts, Actions, Status & User */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Screen Actions */}
          {activeScreen !== 'pos' && (
            <button
              type="button"
              onClick={() => setActiveScreen('pos')}
              className="hidden lg:flex items-center gap-1.5 bg-[#09090b] hover:bg-zinc-800 text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>Réception POS (F2)</span>
            </button>
          )}

          {/* Keyboard Shortcuts Trigger Button */}
          <button
            type="button"
            onClick={() => setShortcutHelpOpen(true)}
            title="Raccourcis clavier (F9 / ?)"
            className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 rounded-lg bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 text-[12px] font-medium transition-colors shadow-2xs"
          >
            <Keyboard className="w-3.5 h-3.5 text-zinc-500" />
            <span className="hidden xl:inline text-[11.5px]">Raccourcis</span>
            <kbd className="hidden sm:inline text-[9.5px] px-1 py-0.2 rounded bg-zinc-100 border border-zinc-300 text-zinc-500 font-mono">
              ?
            </kbd>
          </button>

          {/* Date Indicator */}
          <div className="hidden xl:flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-zinc-600">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            <span className="tabular-nums">{formatShortDate(new Date())}</span>
          </div>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative p-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-600 hover:text-black hover:bg-zinc-50 transition-colors shadow-2xs"
              title="Alertes pressing"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-600 ring-2 ring-white" />
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-zinc-200 p-3 z-50 text-left animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <p className="text-[12px] font-bold text-zinc-900">Alertes en direct</p>
                  <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-semibold">
                    3 alertes
                  </span>
                </div>
                <div className="space-y-2 mt-2 text-[12px]">
                  <div className="p-2 rounded-lg bg-red-50/70 border border-red-100 text-red-900">
                    <p className="font-semibold">6 commandes en retard</p>
                    <p className="text-[11px] text-red-700">Costumes #TK-2841 promis hier 17h</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-100 text-amber-900">
                    <p className="font-semibold">Stock détachant bas</p>
                    <p className="text-[11px] text-amber-700">Reste 1 bidon détachant gras</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-100 text-blue-900">
                    <p className="font-semibold">Maintenance Machine L2</p>
                    <p className="text-[11px] text-blue-700">Planifiée 14h–16h</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User profile identifier */}
          <div className="flex items-center gap-2 pl-1 border-l border-zinc-200">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center font-bold text-xs shadow-xs">
              AK
            </div>
            <div className="hidden 2xl:block text-left leading-tight">
              <p className="text-[12px] font-bold text-zinc-900">Awa Koné</p>
              <p className="text-[10.5px] text-zinc-500">Gérante • Poste 01</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
