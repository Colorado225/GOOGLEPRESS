import React, { useEffect, useMemo, useState } from 'react';
import { useApp, ScreenId, WorkshopTab } from '../../context/AppContext';
import { isLogisticsTaskActionable } from '../../lib/logistics';
import { getOrdersOutForDeliveryIds, hasStructuredStorage } from '../../lib/storage';
import {
  Crown,
  PanelLeftClose,
  Keyboard,
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
  ChevronDown,
  WashingMachine,
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
  scopeStorageKey,
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
import { loadPersistedString, persistString } from '../../lib/localPersistence';
import {
  normalizeSubscription,
  resolveDefaultSubscription,
} from '../../lib/subscription';
import { getBrandInitials, resolveShopDisplayName } from '../../lib/shopIdentity';
import { SubscriptionPlanCard } from './SubscriptionPlanCard';
import {
  WORKSHOP_GROUP_LABEL,
  WORKSHOP_GROUP_STORAGE_KEY,
  WORKSHOP_SUBTABS,
  isWorkshopSubTabActive,
  type WorkshopSubTabIcon,
} from '../../lib/workshopNav';

/** Icône de chaque sous-onglet (le libellé et la cible viennent de lib/workshopNav). */
const WORKSHOP_SUBTAB_ICONS: Record<WorkshopSubTabIcon, React.ReactNode> = {
  washing: <WashingMachine className="w-[16px] h-[16px] shrink-0" />,
  archive: <Archive className="w-[16px] h-[16px] shrink-0" />,
  truck: <Truck className="w-[16px] h-[16px] shrink-0" />,
  wallet: <Wallet className="w-[16px] h-[16px] shrink-0" />,
};

/** Sous-onglet de l'atelier tel qu'il apparaît dans la barre latérale. */
interface SidebarSubItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  workshopTab: WorkshopTab;
  badge?: number;
  badgeTitle?: string;
}

/** Entrée de premier niveau. Un groupe possède des sous-onglets. */
interface SidebarEntry {
  key: string;
  label: string;
  icon: React.ReactNode;
  screen: ScreenId;
  workshopTab?: WorkshopTab;
  badge?: number;
  badgeTitle?: string;
  shortcut?: string;
  action?: () => void;
  children?: SidebarSubItem[];
}

/**
 * Transition de hauteur sans mesure JavaScript : la grille passe de `0fr`
 * (repliée) à `1fr` (dépliée), le contenu étant masqué par `overflow-hidden`.
 * C'est fluide quel que soit le nombre de sous-onglets, et la règle globale
 * `prefers-reduced-motion` neutralise l'animation si l'utilisateur le demande.
 */
const collapseGridClassName =
  'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]';

export const AppSidebar: React.FC = () => {
  const {
    activeScreen,
    setActiveScreen,
    orders,
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
    activeWorkshopTab,
    cashRegister,
    employees,
    workspace,
  } = useApp();

  // En tiroir mobile, la barre est toujours rendue déployée (le repli ne concerne que le bureau)
  const collapsed = isSidebarCollapsed && !isMobileMenuOpen;

  // Nom réel du pressing (Paramètres → agence → organisation). Jamais le nom
  // de l'application sur l'espace d'un pressing inscrit.
  const brandName = resolveShopDisplayName(shopSettings, workspace);

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

  // --- État déplié du groupe Atelier ---------------------------------------
  const workshopGroupStorageKey = scopeStorageKey(workspace, WORKSHOP_GROUP_STORAGE_KEY);
  const [workshopGroupOpen, setWorkshopGroupOpen] = useState(
    () => loadPersistedString(workshopGroupStorageKey) !== '0'
  );

  const toggleWorkshopGroup = () => {
    setWorkshopGroupOpen((previous) => {
      const next = !previous;
      persistString(workshopGroupStorageKey, next ? '1' : '0');
      return next;
    });
  };

  // Arriver sur l'atelier (raccourci F3, carte du tableau de bord, lien de
  // Paramètres…) déplie le groupe pour montrer où l'on se trouve.
  useEffect(() => {
    if (activeScreen !== 'workshop') return;
    setWorkshopGroupOpen((previous) => {
      if (previous) return previous;
      persistString(workshopGroupStorageKey, '1');
      return true;
    });
  }, [activeScreen, workshopGroupStorageKey]);

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

  // Nombre total d'actions en attente dans l'atelier, pour le badge du groupe.
  const workshopActionCount = storageActionCount + logisticsActionCount;

  const navItems: SidebarEntry[] = [
    {
      key: 'dashboard',
      label: 'Tableau de bord',
      icon: <LayoutDashboard className="w-[18px] h-[18px] shrink-0" />,
      screen: 'dashboard',
      shortcut: 'F1',
    },
    {
      key: 'pos',
      label: 'Réception (POS)',
      icon: <ShoppingBag className="w-[18px] h-[18px] shrink-0" />,
      screen: 'pos',
      // Compteur réel uniquement : aucun nombre de démonstration en repli.
      badge: receivedCount > 0 ? receivedCount : undefined,
      badgeTitle: `${receivedCount} commande(s) reçue(s) en attente de traitement`,
      shortcut: 'F2',
    },
    {
      key: 'workshop',
      label: WORKSHOP_GROUP_LABEL,
      icon: <Cog className="w-[18px] h-[18px] shrink-0" />,
      screen: 'workshop',
      badge: workshopActionCount > 0 ? workshopActionCount : undefined,
      badgeTitle: `${workshopActionCount} action(s) en attente dans l’atelier`,
      shortcut: 'F3',
      children: WORKSHOP_SUBTABS.map((subTab) => ({
        key: subTab.key,
        label: subTab.label,
        icon: WORKSHOP_SUBTAB_ICONS[subTab.icon],
        workshopTab: subTab.workshopTab,
        ...(subTab.workshopTab === 'storage' && storageActionCount > 0
          ? {
              badge: storageActionCount,
              badgeTitle: `${storageActionCount} commande(s) prête(s) à ranger`,
            }
          : {}),
        ...(subTab.workshopTab === 'logistics' && logisticsActionCount > 0
          ? {
              badge: logisticsActionCount,
              badgeTitle: `${logisticsActionCount} tournée(s) à traiter`,
            }
          : {}),
      })),
    },
    {
      key: 'clients',
      label: 'Clients',
      icon: <Users className="w-[18px] h-[18px] shrink-0" />,
      screen: 'clients',
      shortcut: 'Alt+5',
    },
    {
      key: 'employees',
      label: 'Personnel',
      icon: <ContactRound className="w-[18px] h-[18px] shrink-0" />,
      screen: 'employees',
      shortcut: 'Alt+7',
    },
    {
      key: 'inventory',
      label: 'Stocks',
      icon: <Boxes className="w-[18px] h-[18px] shrink-0" />,
      screen: 'inventory',
      badge: stockAlertCount > 0 ? stockAlertCount : undefined,
      badgeTitle: `${stockAlertCount} produit(s) sous le seuil d’alerte`,
      shortcut: 'Alt+8',
    },
    {
      key: 'expenses',
      label: 'Dépenses',
      icon: <ReceiptText className="w-[18px] h-[18px] shrink-0" />,
      screen: 'expenses',
      shortcut: 'Alt+9',
    },
    {
      key: 'reports',
      label: 'Rapports',
      icon: <ChartColumn className="w-[18px] h-[18px] shrink-0" />,
      screen: 'reports',
      shortcut: 'Alt+0',
    },
    {
      key: 'settings',
      label: 'Paramètres',
      icon: <Settings className="w-[18px] h-[18px] shrink-0" />,
      screen: 'settings',
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
    .filter((item): item is SidebarEntry => Boolean(item));

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

  const activateEntry = (entry: SidebarEntry) => {
    if (entry.action) {
      entry.action();
    } else if (entry.children?.length) {
      // Le groupe garde l'onglet d'atelier courant : on ne force pas un retour
      // à « Production » quand on arrive depuis un sous-onglet précis.
      if (activeScreen !== entry.screen) setActiveScreen(entry.screen);
      if (!workshopGroupOpen) {
        setWorkshopGroupOpen(true);
        persistString(workshopGroupStorageKey, '1');
      }
    } else if (entry.workshopTab) {
      requestWorkshopTab(entry.workshopTab);
    } else {
      setActiveScreen(entry.screen);
    }
    setMobileMenuOpen(false);
  };

  const activateSubItem = (subItem: SidebarSubItem) => {
    requestWorkshopTab(subItem.workshopTab);
    setMobileMenuOpen(false);
  };

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, entry: SidebarEntry) => {
    // Réorganisation au clavier : Alt + ↑ / ↓.
    if (!event.altKey) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveNavItem(entry.key, -1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveNavItem(entry.key, 1);
    }
  };

  const panelIdFor = (key: string) => `sidebar-subnav-${key.replace(/[^a-zA-Z0-9-]/g, '-')}`;

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
          {shopSettings.logoDataUrl ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-md shadow-blue-500/10">
              <img
                src={shopSettings.logoDataUrl}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-contain p-0.5"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-[15px] text-white shadow-md shadow-blue-500/30 shrink-0">
              {getBrandInitials(brandName)}
            </div>
          )}
          <div className="overflow-hidden">
            <p
              className="font-bold text-[15px] leading-tight text-white tracking-tight truncate"
              title={brandName}
            >
              {brandName}
            </p>
            <p
              className="text-[11px] text-zinc-400 font-medium truncate"
              title={shopSettings.address || getWorkspaceLabel(workspace)}
            >
              {shopSettings.address || getWorkspaceLabel(workspace)}
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
          {orderedNavItems.map((item) => {
            const isGroup = Boolean(item.children?.length);
            const groupOpen = isGroup && workshopGroupOpen && !collapsed;
            const isActive = activeScreen === item.screen;
            const isDragging = draggedNavId === item.key;
            const isDragTarget = dragOverNavId === item.key && draggedNavId !== item.key;
            const panelId = panelIdFor(item.key);

            return (
              <div
                key={item.key}
                draggable={!collapsed}
                onDragStart={(event) => handleNavDragStart(event, item.key)}
                onDragOver={(event) => handleNavDragOver(event, item.key)}
                onDragLeave={() =>
                  setDragOverNavId((current) => (current === item.key ? null : current))
                }
                onDrop={(event) => handleNavDrop(event, item.key)}
                onDragEnd={endNavDrag}
                className={`relative rounded-xl transition-all duration-200 ${
                  isDragging ? 'opacity-40' : ''
                } ${
                  isDragTarget
                    ? 'ring-2 ring-blue-500/70 ring-offset-2 ring-offset-[#09090b]'
                    : ''
                }`}
              >
                {/* Une seule pastille : le libellé et le chevron partagent le
                    même fond, sans imbriquer de boutons. */}
                <div
                  className={`group relative flex items-center rounded-xl transition-[background-color,color,box-shadow,transform] duration-200 ease-out hover:translate-x-0.5 ${
                    isActive
                      ? isGroup
                        ? 'bg-zinc-800/80 text-white shadow-sm ring-1 ring-inset ring-zinc-700/70'
                        : 'bg-white text-black shadow-sm'
                      : 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                  }`}
                >
                  {/* Repère d'onglet actif : la barre bleue se déploie en largeur */}
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-blue-500 transition-all duration-300 ease-out ${
                      isActive && !collapsed ? 'h-6 w-[3px] opacity-100' : 'h-2 w-0 opacity-0'
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => activateEntry(item)}
                    onKeyDown={(event) => handleRowKeyDown(event, item)}
                    aria-current={!isGroup && isActive ? 'page' : undefined}
                    title={
                      collapsed
                        ? `${item.label} ${item.shortcut ? `(${item.shortcut})` : ''}`
                        : `${item.label} — Alt+↑/↓ pour changer de position`
                    }
                    className={`flex min-w-0 flex-1 items-center text-left ${
                      collapsed ? 'justify-center p-2.5 my-1 rounded-xl' : 'gap-3 px-3 py-2.5 rounded-l-xl'
                    } ${isActive ? 'font-semibold' : 'font-normal'}`}
                  >
                    <span
                      className={`transition-transform duration-200 group-hover:scale-110 ${
                        isActive ? (isGroup ? 'text-blue-400' : 'text-black') : 'text-zinc-400'
                      }`}
                    >
                      {item.icon}
                    </span>

                    {!collapsed && <span className="truncate flex-1">{item.label}</span>}

                    {item.badge !== undefined && !collapsed && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-bold tabular-nums bg-blue-600 text-white"
                        title={item.badgeTitle}
                      >
                        {item.badge}
                      </span>
                    )}

                    {item.shortcut && !collapsed && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono tabular-nums transition-colors ${
                          isActive
                            ? 'bg-zinc-200 text-zinc-800'
                            : 'bg-zinc-900 text-zinc-400 group-hover:text-zinc-300'
                        }`}
                      >
                        {item.shortcut}
                      </span>
                    )}

                    {!collapsed && !isGroup && (
                      <GripVertical
                        aria-hidden="true"
                        className={`h-3.5 w-3.5 shrink-0 cursor-grab text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 ${
                          isDragging ? 'cursor-grabbing opacity-100' : ''
                        }`}
                      />
                    )}
                  </button>

                  {/* Dépliant des sous-onglets : bouton distinct pour ne pas
                      imbriquer d'interactifs et garder `aria-expanded` juste. */}
                  {isGroup && !collapsed && (
                    <button
                      type="button"
                      onClick={toggleWorkshopGroup}
                      aria-label={
                        groupOpen
                          ? 'Masquer les sous-onglets de l’atelier'
                          : 'Afficher les sous-onglets de l’atelier'
                      }
                      aria-expanded={groupOpen}
                      aria-controls={panelId}
                      title={groupOpen ? 'Masquer les sous-onglets' : 'Afficher les sous-onglets'}
                      className={`mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-200 hover:bg-zinc-700/70 ${
                        isActive ? 'text-zinc-200 hover:text-white' : 'text-zinc-500 hover:text-white'
                      }`}
                    >
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-3.5 w-3.5 transition-transform duration-300 ease-out ${
                          groupOpen ? 'rotate-180' : 'rotate-0'
                        }`}
                      />
                    </button>
                  )}
                </div>

                {isGroup && (
                  <div
                    id={panelId}
                    className={`${collapseGridClassName} ${
                      groupOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <ul
                        role="group"
                        aria-label={`Sous-onglets de ${WORKSHOP_GROUP_LABEL}`}
                        className="ml-4 mt-1 space-y-1 border-l border-zinc-800 pl-2"
                      >
                        {(item.children ?? []).map((subItem, index) => {
                          const subActive =
                            activeScreen === 'workshop' &&
                            isWorkshopSubTabActive(subItem, activeWorkshopTab);

                          return (
                            <li
                              key={subItem.key}
                              style={{
                                transitionDelay: groupOpen ? `${index * 35}ms` : '0ms',
                              }}
                              className={`transition-[opacity,transform] duration-300 ease-out ${
                                groupOpen
                                  ? 'translate-y-0 opacity-100'
                                  : '-translate-y-1 opacity-0'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => activateSubItem(subItem)}
                                aria-current={subActive ? 'page' : undefined}
                                tabIndex={groupOpen ? 0 : -1}
                                className={`group/sub flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-[background-color,color,transform] duration-200 ease-out hover:translate-x-0.5 ${
                                  subActive
                                    ? 'bg-blue-600/15 font-semibold text-white ring-1 ring-inset ring-blue-500/40'
                                    : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-white'
                                }`}
                              >
                                <span
                                  className={`transition-transform duration-200 group-hover/sub:scale-110 ${
                                    subActive ? 'text-blue-400' : 'text-zinc-500'
                                  }`}
                                >
                                  {subItem.icon}
                                </span>
                                <span className="truncate flex-1">{subItem.label}</span>
                                {subItem.badge !== undefined && (
                                  <span
                                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                                      subActive
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-zinc-800 text-zinc-300 group-hover/sub:bg-zinc-700'
                                    }`}
                                    title={subItem.badgeTitle}
                                  >
                                    {subItem.badge}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                )}
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
