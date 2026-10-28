import React, { useEffect, useMemo, useState } from 'react';
import { useApp, ScreenId, WorkshopTab } from '../../context/AppContext';
import { isLogisticsTaskActionable } from '../../lib/logistics';
import { getOrdersOutForDeliveryIds, hasStructuredStorage } from '../../lib/storage';
import {
  Crown,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Keyboard,
  Sparkles,
  LayoutDashboard,
  ShoppingBag,
  Cog,
  Archive,
  Truck,
  Wallet,
  Users,
  ContactRound,
  Boxes,
  ReceiptText,
  ChartColumn,
  Settings,
  ExternalLink,
  UserRound,
  GripVertical,
  RotateCcw,
} from 'lucide-react';
import { formatTime } from '../../lib/dates';
import { getAlertProducts } from '../../lib/inventory';
import { formatFCFA } from '../../data/demoData';
import {
  getWorkspaceLabel,
  getUserDisplayName,
  getUserInitials,
  getUserRoleLabel,
  isLiveWorkspace,
} from '../../lib/workspaceScope';
import {
  DEFAULT_SIDEBAR_ORDER,
  SIDEBAR_ORDER_STORAGE_KEY,
  isCustomSidebarOrder,
  mergeSidebarOrder,
  moveSidebarItem,
  parseSidebarOrder,
  reorderSidebarItems,
} from '../../lib/sidebarLayout';
import {
  loadPersistedString,
  persistString,
} from '../../lib/localPersistence';
import { scopeStorageKey } from '../../lib/workspaceScope';
import {
  normalizeSubscription,
  resolveDefaultSubscription,
} from '../../lib/subscription';
import { SubscriptionPlanCard } from './SubscriptionPlanCard';

export const AppSidebar: React.FC = () => {
  const {
    activeScreen,
    setActiveScreen,
    orders,
    setClosingZModalOpen,
    isSidebarCollapsed,
    toggleSidebar,
    isMobileMenuOpen,
    setMobileMenuOpen,
    setShortcutHelpOpen,
    nextTicketNumber,
    products,
    shopSettings,
    logisticsTasks,
    requestWorkshopTab,
    cashRegister,
    employees,
    workspace,
  } = useApp();

  // En tiroir mobile, la barre est toujours rendue déployée (le repli ne concerne que le bureau)
  const collapsed = isSidebarCollapsed && !isMobileMenuOpen;

  // --- Ordre personnalisable des entrées -----------------------------------
  // Chaque entrée porte un identifiant stable ; l'ordre choisi est mémorisé
  // pour l'organisation courante et les entrées ajoutées plus tard sont
  // automatiquement replacées en fin de liste.
  const orderStorageKey = scopeStorageKey(workspace, SIDEBAR_ORDER_STORAGE_KEY);
  const [navOrder, setNavOrder] = useState<string[]>(() =>
    mergeSidebarOrder(
      parseSidebarOrder(loadPersistedString(orderStorageKey)),
      [...DEFAULT_SIDEBAR_ORDER]
    )
  );
  const [draggedNavId, setDraggedNavId] = useState<string | null>(null);
  const [dragOverNavId, setDragOverNavId] = useState<string | null>(null);
  const [orderAnnouncement, setOrderAnnouncement] = useState('');

  const commitNavOrder = (next: string[], announcement?: string) => {
    setNavOrder(next);
    persistString(orderStorageKey, JSON.stringify(next));
    if (announcement) setOrderAnnouncement(announcement);
  };

  // --- Plan d'abonnement ---------------------------------------------------
  const [subscription, setSubscription] = useState(() =>
    resolveDefaultSubscription(workspace)
  );
  useEffect(() => {
    const fallback = resolveDefaultSubscription(workspace);
    const stored = loadPersistedString(
      scopeStorageKey(workspace, 'pressingpro_subscription')
    );
    if (!stored) {
      setSubscription(fallback);
      return;
    }
    try {
      setSubscription(normalizeSubscription(JSON.parse(stored), fallback));
    } catch {
      setSubscription(fallback);
    }
  }, [workspace]);

  const receivedCount = orders.filter((o) => o.status === 'received').length;
  const stockAlertCount = getAlertProducts(products).length;
  const logisticsActionCount = logisticsTasks.filter(isLogisticsTaskActionable).length;
  // Progression de l'objectif mensuel, bornée à 100 % pour la barre.
  const goalPercent =
    cashRegister.targetGoal > 0
      ? Math.min(100, Math.round((cashRegister.monthAchieved / cashRegister.targetGoal) * 100))
      : 0;

  // Composition réelle de l'atelier : employés non désactivés, regroupés par
  // poste. Aucun prénom d'exemple n'est injecté.
  const activeTeam = Array.from(
    employees
      .filter((employee) => employee.status !== 'inactive')
      .reduce((groups, employee) => {
        const position = employee.position?.trim() || 'Atelier';
        const names = groups.get(position) ?? [];
        names.push(employee.fullName.split(' ')[0]);
        groups.set(position, names);
        return groups;
      }, new Map<string, string[]>())
  )
    .map(([position, names]) => ({ position, names }))
    .slice(0, 4);

  const outForDeliveryIds = getOrdersOutForDeliveryIds(logisticsTasks);
  const storageActionCount = orders.filter(
    (order) =>
      order.status === 'ready' &&
      !outForDeliveryIds.has(order.id) &&
      !hasStructuredStorage(order)
  ).length;

  const navItems: {
    /** Identifiant stable, utilisé pour mémoriser l'ordre choisi. */
    key: string;
    id: ScreenId;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    shortcut?: string;
    action?: () => void;
    workshopTab?: WorkshopTab;
  }[] = [
    {
      key: 'dashboard',
      id: 'dashboard',
      label: 'Tableau de bord',
      icon: <LayoutDashboard className="w-[18px] h-[18px] shrink-0" />,
      shortcut: 'F1',
    },
    {
      key: 'pos',
      id: 'pos',
      label: 'Réception (POS)',
      icon: <ShoppingBag className="w-[18px] h-[18px] shrink-0" />,
      // Compteur réel uniquement : aucun nombre de démonstration en repli.
      badge: receivedCount > 0 ? receivedCount : undefined,
      shortcut: 'F2',
    },
    {
      key: 'workshop:production',
      id: 'workshop',
      label: 'Production & Suivi',
      icon: <Cog className="w-[18px] h-[18px] shrink-0" />,
      shortcut: 'F3',
      workshopTab: 'production',
    },
    {
      key: 'workshop:storage',
      id: 'workshop',
      label: 'Rangement atelier',
      icon: <Archive className="w-[18px] h-[18px] shrink-0" />,
      badge: storageActionCount || undefined,
      workshopTab: 'storage',
    },
    {
      key: 'workshop:logistics',
      id: 'workshop',
      label: 'Remises & Livraisons',
      icon: <Truck className="w-[18px] h-[18px] shrink-0" />,
      badge: logisticsActionCount || undefined,
      workshopTab: 'logistics',
    },
    {
      key: 'closing',
      id: 'dashboard',
      label: 'Caisse & Clôture',
      icon: <Wallet className="w-[18px] h-[18px] shrink-0" />,
      shortcut: 'F4',
      action: () => setClosingZModalOpen(true),
    },
    {
      key: 'clients',
      id: 'clients',
      label: 'Clients',
      icon: <Users className="w-[18px] h-[18px] shrink-0" />,
      shortcut: 'Alt+5',
    },
    {
      key: 'employees',
      id: 'employees',
      label: 'Personnel',
      icon: <ContactRound className="w-[18px] h-[18px] shrink-0" />,
      shortcut: 'Alt+7',
    },
    {
      key: 'inventory',
      id: 'inventory',
      label: 'Stocks',
      icon: <Boxes className="w-[18px] h-[18px] shrink-0" />,
      badge: stockAlertCount > 0 ? stockAlertCount : undefined,
      shortcut: 'Alt+8',
    },
    {
      key: 'expenses',
      id: 'expenses',
      label: 'Dépenses',
      icon: <ReceiptText className="w-[18px] h-[18px] shrink-0" />,
      shortcut: 'Alt+9',
    },
    {
      key: 'reports',
      id: 'reports',
      label: 'Rapports',
      icon: <ChartColumn className="w-[18px] h-[18px] shrink-0" />,
      shortcut: 'Alt+0',
    },
    {
      key: 'settings',
      id: 'settings',
      label: 'Paramètres',
      icon: <Settings className="w-[18px] h-[18px] shrink-0" />,
    },
  ];

  const navById = useMemo(
    () => new Map(navItems.map((item) => [item.key, item])),
    [navItems]
  );
  // L'ordre mémorisé peut référencer une entrée retirée : on ne garde que ce
  // qui existe réellement, puis on complète avec les nouveautés.
  const orderedNavItems = mergeSidebarOrder(navOrder, [...DEFAULT_SIDEBAR_ORDER])
    .map((key) => navById.get(key))
    .filter((item): item is (typeof navItems)[number] => Boolean(item));

  const customOrder = isCustomSidebarOrder(
    orderedNavItems.map((item) => item.key),
    [...DEFAULT_SIDEBAR_ORDER]
  );

  const moveNavItem = (key: string, delta: number) => {
    const label = navById.get(key)?.label ?? key;
    const next = moveSidebarItem(navOrder, key, delta);
    commitNavOrder(next, `${label} déplacé en position ${next.indexOf(key) + 1}.`);
  };

  const resetNavOrder = () => {
    commitNavOrder([...DEFAULT_SIDEBAR_ORDER], 'Ordre de la navigation réinitialisé.');
  };

  const handleNavDragStart = (event: React.DragEvent<HTMLElement>, key: string) => {
    setDraggedNavId(key);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
  };

  const handleNavDragOver = (event: React.DragEvent<HTMLElement>, key: string) => {
    if (!draggedNavId || draggedNavId === key) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverNavId(key);
  };

  const handleNavDrop = (event: React.DragEvent<HTMLElement>, key: string) => {
    event.preventDefault();
    const source = draggedNavId || event.dataTransfer.getData('text/plain');
    setDraggedNavId(null);
    setDragOverNavId(null);
    if (!source || source === key) return;
    const next = reorderSidebarItems(navOrder, source, key);
    const label = navById.get(source)?.label ?? source;
    commitNavOrder(next, `${label} déplacé en position ${next.indexOf(source) + 1}.`);
  };

  const endNavDrag = () => {
    setDraggedNavId(null);
    setDragOverNavId(null);
  };

  return (
    <aside
      className={`bg-[#09090b] text-white flex flex-col rounded-2xl md:rounded-r-2xl select-none z-20 transition-all duration-300 ease-in-out transform origin-left relative flex-1 min-h-[calc(100vh-5.5rem)] h-[calc(100%-1.5rem)] overflow-hidden ${
        collapsed
          ? '-translate-x-full w-0 opacity-0 pointer-events-none overflow-hidden border-0 my-3 ml-0 p-0 shadow-none'
          : 'translate-x-0 w-[255px] opacity-100 shadow-pop border border-zinc-700 my-3 ml-0 md:ml-3 p-4 md:p-5'
      }`}
    >
      {/* Brand Header with Collapse Sliding Button */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-lg text-white shadow-md shadow-blue-500/30 shrink-0">
            P
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-[15px] leading-tight text-white tracking-tight truncate">
              {shopSettings.name}
            </p>
            <p className="text-[11px] text-zinc-400 font-medium truncate" title={shopSettings.address}>
              {shopSettings.address}
            </p>
          </div>
        </div>

        {/* Sidebar Header Slide/Collapse Button */}
        <button
          type="button"
          onClick={() => {
            if (isMobileMenuOpen) {
              setMobileMenuOpen(false);
            } else {
              toggleSidebar();
            }
          }}
          title={isMobileMenuOpen ? 'Fermer le menu de navigation' : 'Masquer le volet latéral (Alt+S)'}
          aria-label={isMobileMenuOpen ? 'Fermer le menu de navigation' : 'Masquer le volet latéral'}
          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation : elle occupe tout l'espace laissé libre entre l'en-tête et
          le bloc d'abonnement, et les entrées peuvent y être redisposées. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-1 flex items-center justify-between gap-2 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Navigation
          </span>
          {customOrder && !collapsed && (
            <button
              type="button"
              onClick={resetNavOrder}
              title="Revenir à l’ordre d’origine de la navigation"
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Réinitialiser
            </button>
          )}
        </div>

        <nav
          aria-label="Navigation principale"
          className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-0.5 text-[13.5px]"
        >
        {orderedNavItems.map((item, idx) => {
          const isActive =
            item.action
              ? false
              : item.workshopTab && item.workshopTab !== 'production'
                ? false
                : activeScreen === item.id;

          const isDragging = draggedNavId === item.key;
          const isDragTarget = dragOverNavId === item.key && draggedNavId !== item.key;

          return (
            <div
              key={item.key}
              draggable={!collapsed}
              onDragStart={(event) => handleNavDragStart(event, item.key)}
              onDragOver={(event) => handleNavDragOver(event, item.key)}
              onDragLeave={() => setDragOverNavId((current) => (current === item.key ? null : current))}
              onDrop={(event) => handleNavDrop(event, item.key)}
              onDragEnd={endNavDrag}
              className={`relative rounded-xl transition-all ${
                isDragging ? 'opacity-40' : ''
              } ${isDragTarget ? 'ring-2 ring-blue-500/70 ring-offset-2 ring-offset-[#09090b]' : ''}`}
            >
            <button
              onClick={() => {
                if (item.workshopTab) {
                  requestWorkshopTab(item.workshopTab);
                } else if (item.action) {
                  item.action();
                } else {
                  setActiveScreen(item.id);
                }
                setMobileMenuOpen(false);
              }}
              onKeyDown={(event) => {
                // Réorganisation au clavier : Alt + ↑ / ↓.
                if (!event.altKey) return;
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  moveNavItem(item.key, -1);
                } else if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  moveNavItem(item.key, 1);
                }
              }}
              title={
                collapsed
                  ? `${item.label} ${item.shortcut ? `(${item.shortcut})` : ''}`
                  : `${item.label} — Alt+↑/↓ pour changer de position`
              }
              className={`w-full flex items-center rounded-xl text-left transition-all duration-200 hover:translate-x-0.5 relative group ${
                collapsed
                  ? 'justify-center p-2.5 my-1'
                  : 'gap-3 px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white font-normal'
              }`}
            >
              <span className={`transition-transform group-hover:scale-110 ${isActive ? 'text-black' : 'text-zinc-400'}`}>
                {item.icon}
              </span>

              <span className="truncate flex-1">{item.label}</span>

              {item.badge !== undefined && (
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums bg-blue-600 text-white"
                  title={
                    item.id === 'pos'
                      ? `${item.badge} commande(s) reçue(s) en attente de traitement`
                      : undefined
                  }
                >
                  {item.badge}
                </span>
              )}

              {item.shortcut && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono tabular-nums ${
                    isActive
                      ? 'bg-zinc-200 text-zinc-800'
                      : 'bg-zinc-900 text-zinc-400 group-hover:text-zinc-300'
                  }`}
                >
                  {item.shortcut}
                </span>
              )}

              {!collapsed && (
                <GripVertical
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 shrink-0 cursor-grab text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 ${
                    isDragging ? 'cursor-grabbing opacity-100' : ''
                  }`}
                />
              )}
            </button>
            </div>
          );
        })}
        </nav>

        <p aria-live="polite" className="sr-only">
          {orderAnnouncement}
        </p>
      </div>

      <a
        href="/client/connexion"
        title="Ouvrir l’espace client (connexion et inscription)"
        className="mt-3 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2.5 text-[13.5px] font-semibold text-zinc-200 transition-all duration-200 hover:translate-x-0.5 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70"
      >
        <UserRound className="h-[18px] w-[18px] shrink-0 text-teal-300" aria-hidden="true" />
        <span className="flex-1 truncate">Espace client</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
      </a>

      {/* Aucun système d'abonnement n'existe : afficher « Formule Pro —
          Abonnement actif » sur un compte réel serait une affirmation fausse.
          La carte ne subsiste donc qu'en démonstration locale. */}
      {!isLiveWorkspace(workspace) && (
        <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-zinc-900 to-zinc-900/90 border border-amber-500/20 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Crown className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[12px] font-bold text-amber-300 leading-tight">Mode démonstration</p>
                <p className="text-[10px] text-zinc-400">Données d’exemple</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contextual Bottom Widget */}
      <div className="mt-auto pt-4 space-y-3">
        {/* Objectif du mois : chiffres de la caisse réelle. Tant qu'aucun
            objectif n'est renseigné, l'encart n'est pas affiché plutôt que de
            montrer un montant d'exemple. */}
        {activeScreen === 'dashboard' && cashRegister.targetGoal > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-[11px] text-zinc-400 font-medium tracking-wider">OBJECTIF DU MOIS</p>
            <p className="font-bold text-[15px] tabular-nums mt-0.5">
              {new Intl.NumberFormat('fr-FR').format(cashRegister.targetGoal)}{' '}
              <span className="text-[11px] font-normal text-zinc-400">FCFA</span>
            </p>
            <div className="h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
              <div
                className="h-1.5 bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${goalPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-400 mt-1.5 tabular-nums">
              {goalPercent} % atteint — {formatFCFA(cashRegister.monthAchieved)}
            </p>
          </div>
        )}

        {activeScreen === 'pos' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white">
            <p className="text-[11px] text-zinc-400 font-semibold tracking-wider">TICKET EN COURS</p>
            <p className="font-bold text-[14px] text-blue-400">#TK-{nextTicketNumber} • {formatTime(new Date())}</p>
            <p className="text-[11.5px] text-zinc-400 mt-0.5">{getWorkspaceLabel(workspace)}</p>
          </div>
        )}

        {activeScreen === 'workshop' && activeTeam.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white">
            <p className="font-bold text-[12px] text-zinc-200">👷 Équipe atelier</p>
            <div className="text-[11px] text-zinc-400 mt-1 leading-snug space-y-0.5">
              {activeTeam.map((group) => (
                <p key={group.position}>
                  {group.position} : {group.names.join(' + ')}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Plan d'abonnement : placé juste avant le widget des raccourcis. */}
        <SubscriptionPlanCard
          subscription={subscription}
          collapsed={collapsed}
          onManage={() => {
            setActiveScreen('settings');
            setMobileMenuOpen(false);
          }}
        />

        {/* Keyboard shortcut quick trigger button */}
        <button
          type="button"
          onClick={() => setShortcutHelpOpen(true)}
          title="Guide des raccourcis clavier (?)"
          className={`w-full py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-[11px] flex items-center transition-colors ${
            collapsed ? 'justify-center px-1' : 'justify-between px-2.5'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5 text-zinc-400" />
            {!collapsed && <span>Raccourcis</span>}
          </span>
          {!collapsed && (
            <kbd className="px-1 py-0.5 bg-zinc-800 text-[10px] font-mono rounded text-zinc-300">
              ?
            </kbd>
          )}
        </button>

        {/* User profile identifier */}
        <div
          className={`flex items-center pt-2 border-t border-zinc-800/70 transition-all ${
            collapsed ? 'justify-center' : 'gap-2.5'
          }`}
          title={collapsed ? `${getUserDisplayName(workspace)} (${getUserRoleLabel(workspace)})` : undefined}
        >
          <div className="w-9 h-9 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center font-black text-sm shrink-0 shadow-inner">
            {getUserInitials(workspace)}
          </div>
          {!collapsed && (
            <div className="overflow-hidden animate-in fade-in duration-200">
              <p className="text-[13px] font-semibold text-white truncate">
                {getUserDisplayName(workspace)}
              </p>
              <p className="text-[11px] text-zinc-400 truncate">{getUserRoleLabel(workspace)}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
