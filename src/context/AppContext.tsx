import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Customer, LaundryOrder, OrderLine, ClothingItem, CartLineDetails, CashRegisterData, OrderStatus, ServiceCategory, PickupOption,
  Employee, EmployeeStatus, EmployeeFormData, AttendanceRecord,
  InventoryProduct, ProductFormData, StockMovement, StockMovementInput,
  Expense, ExpenseFormData, ExpenseCategory, ActionResult,
  FulfillmentMethod, LogisticsIssueReason, LogisticsTask, LogisticsTaskScheduleFormData,
  LogisticsTimeSlot, PaymentMethod, PickupTaskFormData,
  StorageAssignmentInput, StorageLocation, StorageLocationFormData,
  StorageLocationSeriesInput,
} from '../types';
import {
  INITIAL_CUSTOMERS, INITIAL_ORDERS, INITIAL_CASH_REGISTER, INITIAL_LOGISTICS_TASKS,
  INITIAL_STORAGE_LOCATIONS,
  INITIAL_EMPLOYEES, INITIAL_ATTENDANCE, INITIAL_PRODUCTS, INITIAL_STOCK_MOVEMENTS,
  INITIAL_EXPENSES, INITIAL_EXPENSE_CATEGORIES,
} from '../data/demoData';
import { fireOrderCelebration } from '../registry/magicui/confetti';
import {
  isLiveWorkspace,
  scopeStorageKey,
  type WorkspaceScope,
} from '../lib/workspaceScope';
import { useWorkspaceScope } from './WorkspaceScopeContext';
import { calculateOrderTotals, calculateLineSubtotal } from '../lib/pricing';
import {
  formatPromised, getPromisedDate, isValidISODate, nowDateTime, nowISODateTime, toISODate, todayISO,
} from '../lib/dates';
import { computeMovement } from '../lib/inventory';
import { normalizeText } from '../lib/utils';
import {
  LOGISTICS_TASKS_STORAGE_KEY, PAYMENT_METHOD_LABELS, getDefaultDeliveryTimeSlot,
  isHomeDeliveryOrder, normalizeLogisticsFee,
} from '../lib/logistics';
import {
  STORAGE_LOCATIONS_STORAGE_KEY, buildStorageLocationSeries,
  calculateStorageOccupancy, formatStorageLocation, getOrderPackageCount,
  getOrderStorageCode, hasStorageLocation, isValidStorageCode, normalizeStorageCode,
  normalizeStorageLocations, sanitizePackageCount,
  wouldExceedKnownStorageCapacity,
} from '../lib/storage';

import { AppTheme, applyTheme, getInitialTheme, persistTheme } from '../lib/theme';
import {
  DEFAULT_SHOP_SETTINGS,
  SHOP_SETTINGS_STORAGE_KEY,
  resolveDefaultShopSettings,
} from '../lib/shopSettings';
import { isValidLogoDataUrl } from '../lib/shopIdentity';
import { normalizeBlanchisserieSettings } from '../lib/blanchisserie';
import { normalizePressingSettings } from '../lib/pressing';
import { normalizeCustomGarments } from '../lib/garmentCatalog';
import { ShopSettings } from '../types';
import {
  TICKET_COUNTER_STORAGE_KEY as TICKET_COUNTER_KEY,
  createLocalId as genId,
  hasPersistedValue,
  loadPersistedState,
  loadPersistedString,
  parseTicketNumber,
  persistState,
  persistString,
} from '../lib/localPersistence';

export type ScreenId =
  | 'dashboard'
  | 'pos'
  | 'workshop'
  | 'orders'
  | 'clients'
  | 'employees'
  | 'inventory'
  | 'expenses'
  | 'reports'
  | 'settings';

/** Onglets de l’écran Production & remises. */
export type WorkshopTab =
  | 'production'
  | 'storage'
  | 'logistics'
  | 'handover'
  | 'cash'
  | 'remote';

/** Sous-vues du panneau Rangement (commandes prêtes ou plan des emplacements). */
export type StoragePanelView = 'orders' | 'locations';

/** Onglets de l’écran Paramètres. */
export type SettingsTab =
  | 'shop'
  | 'services'
  | 'logistics'
  | 'storage'
  | 'devices'
  | 'backend'
  | 'backup';

interface AppContextType {
  /** Portée courante : démonstration locale amorcée ou organisation réelle vide. */
  workspace: WorkspaceScope;
  activeScreen: ScreenId;
  setActiveScreen: (screen: ScreenId) => void;
  orders: LaundryOrder[];
  customers: Customer[];
  cashRegister: CashRegisterData;
  activeHandoverOrder: LaundryOrder | null;
  setActiveHandoverOrder: (order: LaundryOrder | null) => void;
  /** Client actif du POS ; `null` tant qu'aucun client n'existe (espace réel vide). */
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer) => void;
  cartLines: OrderLine[];
  addCartItem: (
    item: ClothingItem,
    serviceType?: string,
    quantity?: number,
    weightKg?: number,
    details?: CartLineDetails
  ) => void;
  removeCartItem: (lineId: string) => void;
  updateCartItemQty: (lineId: string, delta: number) => void;
  /** Couleur appliquée aux pièces ajoutées au panier (undefined = non précisée). */
  selectedGarmentColor: string | undefined;
  setSelectedGarmentColor: (color: string | undefined) => void;
  updateCartLineColor: (lineId: string, color: string | undefined) => void;
  clearCart: () => void;
  pickupOption: PickupOption;
  setPickupOption: (opt: PickupOption) => void;
  /** Brouillon logistique de la commande en cours de saisie au POS. */
  orderFulfillmentMethod: FulfillmentMethod;
  setOrderFulfillmentMethod: (method: FulfillmentMethod) => void;
  deliveryAddress: string;
  setDeliveryAddress: (address: string) => void;
  deliveryAddressDetails: string;
  setDeliveryAddressDetails: (details: string) => void;
  deliveryDateISO: string;
  setDeliveryDateISO: (date: string) => void;
  deliveryTimeSlot: LogisticsTimeSlot;
  setDeliveryTimeSlot: (slot: LogisticsTimeSlot) => void;
  /** Ramassage collecté en attente de comptage/conversion dans le POS. */
  pendingPickupTask: LogisticsTask | null;
  pendingPickupTaskId: string | null;
  /** Prochain numéro de ticket qui sera attribué (compteur séquentiel persisté). */
  nextTicketNumber: number;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  depositAmount: number;
  setDepositAmount: (amt: number) => void;
  paymentMethod: 'especes' | 'wave' | 'momo' | 'om';
  setPaymentMethod: (pm: 'especes' | 'wave' | 'momo' | 'om') => void;
  selectedServiceFilter: string;
  setSelectedServiceFilter: (srv: string) => void;
  previewTicket: LaundryOrder | null;
  setPreviewTicket: (order: LaundryOrder | null) => void;
  closingZModalOpen: boolean;
  setClosingZModalOpen: (open: boolean) => void;
  newCustomerModalOpen: boolean;
  setNewCustomerModalOpen: (open: boolean) => void;
  smsModalData: { isOpen: boolean; order?: LaundryOrder; text?: string } | null;
  setSmsModalData: (data: { isOpen: boolean; order?: LaundryOrder; text?: string } | null) => void;
  submitNewOrder: () => LaundryOrder | null;
  moveOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  settleAndDeliverOrder: (orderId: string, method: 'especes' | 'wave' | 'momo' | 'om') => void;
  // --- Rangement atelier des commandes terminées ---
  storageLocations: StorageLocation[];
  createStorageLocation: (
    data: StorageLocationFormData
  ) => ActionResult & { location?: StorageLocation };
  createStorageLocationSeries: (
    input: StorageLocationSeriesInput
  ) => ActionResult & { locations?: StorageLocation[] };
  updateStorageLocation: (id: string, data: StorageLocationFormData) => ActionResult;
  deleteStorageLocation: (id: string) => ActionResult;
  setStorageLocationActive: (id: string, isActive: boolean) => void;
  markOrderReadyAndStore: (orderId: string, input: StorageAssignmentInput) => ActionResult;
  assignOrderStorage: (orderId: string, input: StorageAssignmentInput) => ActionResult;
  clearOrderStorage: (orderId: string) => ActionResult;
  focusedStorageOrderId: string | null;
  setFocusedStorageOrderId: (orderId: string | null) => void;
  focusStorageOrder: (orderId: string) => void;
  storagePanelViewRequest: StoragePanelView | null;
  clearStoragePanelViewRequest: () => void;
  openStorageLocationsConfig: () => void;
  // --- Ramassage & livraison ---
  logisticsTasks: LogisticsTask[];
  createPickupTask: (data: PickupTaskFormData) => ActionResult & { task?: LogisticsTask };
  updateLogisticsTask: (taskId: string, data: LogisticsTaskScheduleFormData) => ActionResult;
  assignLogisticsTask: (taskId: string, employeeId: string) => ActionResult;
  startLogisticsTask: (taskId: string) => ActionResult;
  completePickupTask: (taskId: string, collectedBags?: number) => ActionResult;
  completeDeliveryTask: (taskId: string, paymentMethod: PaymentMethod) => ActionResult;
  failLogisticsTask: (taskId: string, reason: LogisticsIssueReason, notes?: string) => ActionResult;
  cancelLogisticsTask: (taskId: string, reason: LogisticsIssueReason, notes?: string) => ActionResult;
  startOrderFromPickupTask: (taskId: string) => boolean;
  cancelPendingPickupConversion: () => void;
  focusedLogisticsTaskId: string | null;
  setFocusedLogisticsTaskId: (taskId: string | null) => void;
  focusLogisticsTask: (taskId: string) => void;
  /** Demande ponctuelle d’ouverture d’un onglet précis de l’atelier. */
  workshopTabRequest: WorkshopTab | null;
  requestWorkshopTab: (tab: WorkshopTab) => void;
  clearWorkshopTabRequest: () => void;
  /** Onglet réellement affiché dans l'atelier (partagé avec la navigation). */
  activeWorkshopTab: WorkshopTab;
  setActiveWorkshopTab: (tab: WorkshopTab) => void;
  /** Demande ponctuelle d’ouverture d’un onglet précis des Paramètres. */
  settingsTabRequest: SettingsTab | null;
  requestSettingsTab: (tab: SettingsTab) => void;
  clearSettingsTabRequest: () => void;
  addNewCustomer: (cust: Omit<Customer, 'id' | 'depositsCount' | 'balance'>) => Customer;
  markReadyOrdersAsNotifiedLocally: () => void;
  selectedServiceCategory: ServiceCategory | null;
  setSelectedServiceCategory: (cat: ServiceCategory | null) => void;
  orderStep: 1 | 2 | 3;
  setOrderStep: (step: 1 | 2 | 3) => void;
  resetNewOrderFlow: (category?: ServiceCategory) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  shopSettings: ShopSettings;
  updateShopSettings: (settings: ShopSettings) => void;
  shortcutHelpOpen: boolean;
  setShortcutHelpOpen: (open: boolean) => void;
  notificationToast: string | null;
  showToast: (msg: string) => void;
  // --- Module Personnel ---
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  addEmployee: (data: EmployeeFormData) => Employee;
  updateEmployee: (id: string, data: EmployeeFormData) => boolean;
  setEmployeeStatus: (id: string, status: EmployeeStatus) => void;
  upsertAttendance: (
    employeeId: string,
    date: string,
    status: AttendanceRecord['status'],
    extra?: { arrivalTime?: string; reason?: string }
  ) => void;
  removeAttendance: (employeeId: string, date: string) => void;
  // --- Module Stocks ---
  products: InventoryProduct[];
  stockMovements: StockMovement[];
  createProduct: (data: ProductFormData, initialQuantity: number, initialDateISO: string) => ActionResult & { product?: InventoryProduct };
  updateProduct: (id: string, data: ProductFormData) => ActionResult;
  setProductActive: (id: string, isActive: boolean) => void;
  recordStockMovement: (input: StockMovementInput) => ActionResult;
  // --- Module Dépenses ---
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  addExpense: (data: ExpenseFormData) => Expense;
  updateExpense: (id: string, data: ExpenseFormData) => boolean;
  cancelExpense: (id: string, reason: string) => void;
  addExpenseCategory: (label: string) => ActionResult;
  renameExpenseCategory: (id: string, label: string) => ActionResult;
  setExpenseCategoryActive: (id: string, isActive: boolean) => void;
}

/** Caisse vierge du jour pour un espace réel : aucun montant inventé. */
const createEmptyCashRegister = (): CashRegisterData => ({
  date: todayISO(),
  cashAmount: 0,
  waveAmount: 0,
  momoAmount: 0,
  totalAmount: 0,
  floatAmount: 0,
  targetGoal: 0,
  monthAchieved: 0,
});

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Portée des données (lib/workspaceScope.ts) :
  // - démonstration locale explicite → amorçage avec les jeux d'exemple ;
  // - compte réel rattaché à une organisation → aucune donnée inventée, les
  //   écrans démarrent vides et se remplissent des seules saisies réelles.
  const workspace = useWorkspaceScope();
  const liveWorkspace = isLiveWorkspace(workspace);
  /** Clé de persistance isolée par organisation en espace réel. */
  const storageKey = (name: string) => scopeStorageKey(workspace, name);
  /** Jeu d'exemple en démonstration, liste vide sur un compte réel. */
  const seedList = <T,>(demoValue: readonly T[]): T[] =>
    liveWorkspace ? [] : [...demoValue];

  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  // Thème d'interface clair/sombre (lib/theme.ts) : classe `dark` sur <html>,
  // mémorisé dans ce navigateur (pressingpro_theme), défaut = préférence système.
  const [theme, setThemeState] = useState<AppTheme>(() => getInitialTheme());
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  const setTheme = (next: AppTheme) => {
    persistTheme(next);
    setThemeState(next);
  };
  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      persistTheme(next);
      return next;
    });
  };
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState<boolean>(false);

  // Service Selection & Order Journey Steps
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<ServiceCategory | null>('pressing');
  const [orderStep, setOrderStep] = useState<1 | 2 | 3>(1);

  // États encore persistés localement pendant la migration progressive.
  // Tous les accès passent par lib/localPersistence afin de centraliser la
  // gestion des JSON illisibles et des écritures refusées par le navigateur.
  const [orders, setOrders] = useState<LaundryOrder[]>(() =>
    loadPersistedState(storageKey('pressingpro_orders'), seedList(INITIAL_ORDERS))
  );

  const [customers, setCustomers] = useState<Customer[]>(() =>
    loadPersistedState(storageKey('pressingpro_customers'), seedList(INITIAL_CUSTOMERS))
  );

  // Caisse du jour : montants réels uniquement. Aucun objectif ni fond de
  // caisse d'exemple n'est repris sur un compte réel.
  const [cashRegister, setCashRegister] = useState<CashRegisterData>(() =>
    loadPersistedState(
      storageKey('pressingpro_cash_register'),
      liveWorkspace ? createEmptyCashRegister() : INITIAL_CASH_REGISTER
    )
  );

  useEffect(() => {
    persistState(storageKey('pressingpro_orders'), orders);
  }, [orders]);

  useEffect(() => {
    persistState(storageKey('pressingpro_customers'), customers);
  }, [customers]);

  useEffect(() => {
    persistState(storageKey('pressingpro_cash_register'), cashRegister);
  }, [cashRegister]);

  // Compteur séquentiel de tickets, persisté dans localStorage.
  // Remplace l'ancienne formule fragile basée sur orders.length (qui
  // réattribuait des numéros dès qu'une commande disparaissait de la liste).
  // Initialisation : valeur sauvegardée si elle existe, sinon max des
  // tickets existants + 1 (migration transparente des anciennes données).
  const [nextTicketNumber, setNextTicketNumber] = useState<number>(() => {
    const fallback =
      orders.reduce((max, o) => Math.max(max, parseTicketNumber(o.ticketNumber)), 0) + 1;
    const saved = parseInt(loadPersistedString(storageKey(TICKET_COUNTER_KEY)) || '', 10);
    return Number.isNaN(saved) ? fallback : Math.max(saved, fallback);
  });

  useEffect(() => {
    persistString(storageKey(TICKET_COUNTER_KEY), String(nextTicketNumber));
  }, [nextTicketNumber]);

  // --- États des modules Personnel / Stocks / Dépenses ---
  // Même modèle de persistance que le reste de l'application : localStorage
  // du navigateur uniquement, données de démonstration au premier lancement.
  const [employees, setEmployees] = useState<Employee[]>(() =>
    loadPersistedState(storageKey('pressingpro_employees'), seedList(INITIAL_EMPLOYEES))
  );
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() =>
    loadPersistedState(storageKey('pressingpro_attendance'), seedList(INITIAL_ATTENDANCE))
  );
  const [products, setProducts] = useState<InventoryProduct[]>(() =>
    loadPersistedState(storageKey('pressingpro_inventory_products'), seedList(INITIAL_PRODUCTS))
  );
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() =>
    loadPersistedState(storageKey('pressingpro_stock_movements'), seedList(INITIAL_STOCK_MOVEMENTS))
  );
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    loadPersistedState(storageKey('pressingpro_expenses'), seedList(INITIAL_EXPENSES))
  );
  // Catégories : nomenclature de paramétrage (et non des écritures), donc
  // conservée dans les deux modes ; la liste reste éditable dans Paramètres.
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(() =>
    loadPersistedState(storageKey('pressingpro_expense_categories'), [
      ...INITIAL_EXPENSE_CATEGORIES,
    ])
  );

  // Tournées ramassage/livraison. Une première installation reçoit tous les
  // exemples fictifs. Sur un jeu de données antérieur à cette fonctionnalité,
  // on ne charge que les deux ramassages non convertis : ils ne dépendent
  // d'aucun total de commande déjà enregistré, contrairement aux exemples
  // liés à un ticket de démonstration.
  const [logisticsTasks, setLogisticsTasks] = useState<LogisticsTask[]>(() => {
    const saved = loadPersistedState<LogisticsTask[] | null>(
      storageKey(LOGISTICS_TASKS_STORAGE_KEY),
      null
    );
    if (saved) return saved;
    // Espace réel : aucune tournée fictive, même sur un poste où la
    // démonstration a déjà été utilisée.
    if (liveWorkspace) return [];
    if (hasPersistedValue(storageKey('pressingpro_orders'))) {
      return INITIAL_LOGISTICS_TASKS.filter((task) => task.kind === 'pickup' && !task.orderId);
    }
    return INITIAL_LOGISTICS_TASKS;
  });

  // Emplacements physiques des commandes terminées. Le plan proposé par
  // défaut est éditable pour correspondre au local réel ; persistance locale.
  // Plan de rangement : configuration matérielle éditable, conservée dans les
  // deux modes (elle ne contient aucun dossier client ni aucune commande).
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(() =>
    normalizeStorageLocations(
      loadPersistedState<unknown>(
        storageKey(STORAGE_LOCATIONS_STORAGE_KEY),
        INITIAL_STORAGE_LOCATIONS
      ),
      INITIAL_STORAGE_LOCATIONS
    )
  );
  const [focusedStorageOrderId, setFocusedStorageOrderId] = useState<string | null>(null);
  const [storagePanelViewRequest, setStoragePanelViewRequest] =
    useState<StoragePanelView | null>(null);

  // Paramètres de la boutique (écran Paramètres) : fusionnés aux valeurs par
  // défaut pour rester complets même si une ancienne version est en mémoire.
  // Sur un espace réel, la base porte le nom du pressing effectivement créé :
  // le nom de l'application n'apparaît jamais comme enseigne.
  const [shopSettings, setShopSettings] = useState<ShopSettings>(() => {
    const base = resolveDefaultShopSettings(workspace);
    const persisted = loadPersistedState<Partial<ShopSettings>>(
      storageKey(SHOP_SETTINGS_STORAGE_KEY),
      {}
    );
    // Un nom vide côté sauvegarde ne doit pas écraser celui du serveur.
    const merged = {
      ...base,
      ...persisted,
      name: persisted.name?.trim() ? persisted.name : base.name,
      logoDataUrl: isValidLogoDataUrl(persisted.logoDataUrl) ? persisted.logoDataUrl : null,
      // Une sauvegarde absente ne doit pas écraser la grille de départ
      // (démonstration) : seule une valeur réellement enregistrée est nettoyée.
      blanchisserie:
        persisted.blanchisserie === undefined
          ? base.blanchisserie
          : normalizeBlanchisserieSettings(persisted.blanchisserie),
      pressing:
        persisted.pressing === undefined
          ? base.pressing
          : normalizePressingSettings(persisted.pressing),
      customGarments:
        persisted.customGarments === undefined
          ? base.customGarments
          : normalizeCustomGarments(persisted.customGarments),
    };
    return {
      ...merged,
      storageAssignmentRequired: merged.storageAssignmentRequired === true,
      storageAllowCapacityOverflow: merged.storageAllowCapacityOverflow !== false,
      storageSuggestionsEnabled: merged.storageSuggestionsEnabled !== false,
      storageDefaultCapacityPackages:
        sanitizePackageCount(merged.storageDefaultCapacityPackages) ??
        DEFAULT_SHOP_SETTINGS.storageDefaultCapacityPackages,
    };
  });
  const updateShopSettings = (next: ShopSettings) =>
    setShopSettings({
      ...next,
      logoDataUrl: isValidLogoDataUrl(next.logoDataUrl) ? next.logoDataUrl : null,
      blanchisserie: normalizeBlanchisserieSettings(next.blanchisserie),
      pressing: normalizePressingSettings(next.pressing),
      customGarments: normalizeCustomGarments(next.customGarments),
      pickupFee: normalizeLogisticsFee(next.pickupFee),
      deliveryFee: normalizeLogisticsFee(next.deliveryFee),
      storageAssignmentRequired: next.storageAssignmentRequired === true,
      storageAllowCapacityOverflow: next.storageAllowCapacityOverflow === true,
      storageSuggestionsEnabled: next.storageSuggestionsEnabled === true,
      storageDefaultCapacityPackages:
        sanitizePackageCount(next.storageDefaultCapacityPackages) ??
        DEFAULT_SHOP_SETTINGS.storageDefaultCapacityPackages,
    });

  useEffect(() => {
    persistState(storageKey(LOGISTICS_TASKS_STORAGE_KEY), logisticsTasks);
  }, [logisticsTasks]);
  useEffect(() => {
    persistState(storageKey(STORAGE_LOCATIONS_STORAGE_KEY), storageLocations);
  }, [storageLocations]);
  useEffect(() => {
    persistState(storageKey('pressingpro_employees'), employees);
  }, [employees]);
  useEffect(() => {
    persistState(storageKey('pressingpro_attendance'), attendanceRecords);
  }, [attendanceRecords]);
  useEffect(() => {
    persistState(storageKey('pressingpro_inventory_products'), products);
  }, [products]);
  useEffect(() => {
    persistState(storageKey('pressingpro_stock_movements'), stockMovements);
  }, [stockMovements]);
  useEffect(() => {
    persistState(storageKey('pressingpro_expenses'), expenses);
  }, [expenses]);
  useEffect(() => {
    persistState(storageKey('pressingpro_expense_categories'), expenseCategories);
  }, [expenseCategories]);
  useEffect(() => {
    persistState(storageKey(SHOP_SETTINGS_STORAGE_KEY), shopSettings);
  }, [shopSettings]);

  // Aucun repli fictif : sur un espace réel sans client, la sélection est
  // vide et le POS invite à créer le premier dossier.
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    customers[0] ?? null
  );
  const [pickupOption, setPickupOption] = useState<PickupOption>('standard');

  // Brouillon logistique du POS : mode de restitution et, si livraison,
  // adresse/créneau saisis avant l'enregistrement de la commande.
  const [orderFulfillmentMethod, setOrderFulfillmentMethod] =
    useState<FulfillmentMethod>('counter_pickup');
  const [deliveryAddress, setDeliveryAddress] = useState<string>(
    customers[0]?.address || ''
  );
  const [deliveryAddressDetails, setDeliveryAddressDetails] = useState<string>('');
  const [deliveryDateISO, setDeliveryDateISOState] = useState<string>(() =>
    toISODate(getPromisedDate('standard'))
  );
  const [deliveryTimeSlot, setDeliveryTimeSlotState] =
    useState<LogisticsTimeSlot>('16:00-18:00');
  const [deliveryScheduleManual, setDeliveryScheduleManual] = useState(false);
  const [pendingPickupTaskId, setPendingPickupTaskId] = useState<string | null>(null);
  const [focusedLogisticsTaskId, setFocusedLogisticsTaskId] = useState<string | null>(null);
  const [workshopTabRequest, setWorkshopTabRequest] = useState<WorkshopTab | null>(null);
  // Onglet courant de l'atelier : la barre latérale le lit pour surligner le
  // bon sous-onglet, et l'écran Atelier l'écrit quand l'utilisateur navigue.
  const [activeWorkshopTab, setActiveWorkshopTab] = useState<WorkshopTab>('production');
  const [settingsTabRequest, setSettingsTabRequest] = useState<SettingsTab | null>(null);

  const pendingPickupTask = pendingPickupTaskId
    ? logisticsTasks.find((task) => task.id === pendingPickupTaskId) ?? null
    : null;

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

  const focusStorageOrder = (orderId: string) => {
    setFocusedStorageOrderId(orderId);
    requestWorkshopTab('storage');
  };

  const clearStoragePanelViewRequest = () => setStoragePanelViewRequest(null);
  const openStorageLocationsConfig = () => {
    setStoragePanelViewRequest('locations');
    requestWorkshopTab('storage');
  };

  const setDeliveryDateISO = (date: string) => {
    setDeliveryScheduleManual(true);
    setDeliveryDateISOState(date);
  };
  const setDeliveryTimeSlot = (slot: LogisticsTimeSlot) => {
    setDeliveryScheduleManual(true);
    setDeliveryTimeSlotState(slot);
  };

  const resetLogisticsDraft = (option: PickupOption = pickupOption) => {
    setOrderFulfillmentMethod('counter_pickup');
    setDeliveryAddress(selectedCustomer?.address || '');
    setDeliveryAddressDetails('');
    setDeliveryScheduleManual(false);
    setDeliveryDateISOState(toISODate(getPromisedDate(option)));
    setDeliveryTimeSlotState(getDefaultDeliveryTimeSlot(option));
    setPendingPickupTaskId(null);
  };

  // L'adresse proposée suit le client sélectionné, sauf pendant la conversion
  // d'un ramassage où l'adresse de collecte fait foi par défaut.
  useEffect(() => {
    if (!pendingPickupTaskId) setDeliveryAddress(selectedCustomer?.address || '');
  }, [selectedCustomer?.id, pendingPickupTaskId]);

  // Tant que le créneau n'a pas été choisi manuellement, la livraison suit la
  // date promise par l'option standard/express/différé.
  useEffect(() => {
    if (deliveryScheduleManual) return;
    setDeliveryDateISOState(toISODate(getPromisedDate(pickupOption)));
    setDeliveryTimeSlotState(getDefaultDeliveryTimeSlot(pickupOption));
  }, [pickupOption, deliveryScheduleManual]);

  const [orderNotes, setOrderNotes] = useState<string>(
    'Consigne : tache de sauce graine sur boubou — détachage doux. Cliente prévient sur WhatsApp.'
  );
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>('Lavage + Repassage');
  const [paymentMethod, setPaymentMethod] = useState<'especes' | 'wave' | 'momo' | 'om'>('wave');
  const [depositAmount, setDepositAmount] = useState<number>(5000);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  // Modals
  const [previewTicket, setPreviewTicket] = useState<LaundryOrder | null>(null);
  const [closingZModalOpen, setClosingZModalOpen] = useState(false);
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);
  const [smsModalData, setSmsModalData] = useState<{ isOpen: boolean; order?: LaundryOrder; text?: string } | null>(null);

  // Active handover in workshop : uniquement une commande prête en retrait
  // comptoir (les livraisons à domicile passent par l'onglet Tournées).
  const [activeHandoverOrder, setActiveHandoverOrder] = useState<LaundryOrder | null>(() => {
    return orders.find((o) => o.status === 'ready' && !isHomeDeliveryOrder(o)) || null;
  });

  // Default pre-populated cart to replicate Mockup 2:
  // 3x Chemise (4 500 FCFA), 1x Boubou bazin (4 500 FCFA), Remise fidélité -10% (-900 FCFA) -> Total 8 100 FCFA. Acompte: 5 000 FCFA. Reste: 3 100 FCFA.
  const [cartLines, setCartLines] = useState<OrderLine[]>([
    {
      id: 'cl-1',
      clothingItemId: 'c1',
      name: 'Chemise',
      quantity: 3,
      unitPrice: 1500,
      subtotal: 4500,
      serviceType: 'Lavage + Repassage',
      color: 'Blanc',
      notes: 'Dont une rayée',
    },
    {
      id: 'cl-2',
      clothingItemId: 'c3',
      name: 'Boubou bazin',
      quantity: 1,
      unitPrice: 4500,
      subtotal: 4500,
      serviceType: 'Lavage délicat',
      color: 'Multicolore',
      notes: 'Brodé or • détachage inclus',
    },
  ]);

  const [selectedGarmentColor, setSelectedGarmentColor] = useState<string | undefined>(undefined);

  const showToast = (msg: string) => {
    setNotificationToast(msg);
    setTimeout(() => {
      setNotificationToast((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  const resetNewOrderFlow = (category?: ServiceCategory) => {
    if (category) {
      setSelectedServiceCategory(category);
      setOrderStep(1);
    } else {
      setSelectedServiceCategory(null);
      setOrderStep(1);
    }
    resetLogisticsDraft();
    clearCart();
  };

  const addCartItem = (
    item: ClothingItem,
    serviceType = selectedServiceFilter,
    quantity = 1,
    weightKg?: number,
    details?: CartLineDetails
  ) => {
    setCartLines((prev) => {
      const existing = prev.find(
        (line) =>
          line.clothingItemId === item.id &&
          line.serviceType === serviceType &&
          (line.color ?? undefined) === selectedGarmentColor
      );
      const isKilo = item.pricingType === 'kilo';
      const actualQty = isKilo ? (weightKg || 1) : quantity;
      const calcSubtotal = calculateLineSubtotal(item.unitPrice, actualQty);

      if (existing) {
        const newQty = existing.quantity + actualQty;
        const newSubtotal = calculateLineSubtotal(item.unitPrice, newQty);

        return prev.map((line) =>
          line.id === existing.id
            ? {
                ...line,
                quantity: newQty,
                weightKg: isKilo ? newQty : undefined,
                garments:
                  details?.garments != null
                    ? (line.garments ?? 0) + details.garments
                    : line.garments,
                subtotal: newSubtotal,
              }
            : line
        );
      }
      return [
        ...prev,
        {
          id: genId('cl'),
          clothingItemId: item.id,
          name: item.name,
          quantity: actualQty,
          pricingType: item.pricingType,
          weightKg: isKilo ? actualQty : undefined,
          garments: details?.garments,
          pricingBasis: details?.pricingBasis,
          blanchisserieService: details?.blanchisserieService,
          unitLabel: item.unitLabel,
          unitPrice: item.unitPrice,
          subtotal: calcSubtotal,
          serviceType: serviceType,
          color: selectedGarmentColor,
        },
      ];
    });
    showToast(`✓ ${item.name} ajouté au panier`);
  };

  const removeCartItem = (lineId: string) => {
    setCartLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  const updateCartItemQty = (lineId: string, delta: number) => {
    setCartLines((prev) =>
      prev
        .map((line) => {
          if (line.id === lineId) {
            const isKilo = line.pricingType === 'kilo';
            const step = isKilo ? 0.5 : 1;
            const newQty = Math.max(0, Math.round((line.quantity + delta * step) * 10) / 10);
            return newQty > 0
              ? {
                  ...line,
                  quantity: newQty,
                  weightKg: isKilo ? newQty : undefined,
                  subtotal: calculateLineSubtotal(line.unitPrice, newQty),
                }
              : null;
          }
          return line;
        })
        .filter(Boolean) as OrderLine[]
    );
  };

  const updateCartLineColor = (lineId: string, color: string | undefined) => {
    setCartLines((prev) => {
      const target = prev.find((l) => l.id === lineId);
      if (!target || (target.color ?? undefined) === color) return prev;
      const twin = prev.find(
        (l) =>
          l.id !== lineId &&
          l.clothingItemId === target.clothingItemId &&
          l.serviceType === target.serviceType &&
          (l.color ?? undefined) === color
      );
      if (!twin) return prev.map((l) => (l.id === lineId ? { ...l, color } : l));
      const isKilo = target.pricingType === 'kilo';
      const newQty = twin.quantity + target.quantity;
      return prev
        .filter((l) => l.id !== lineId)
        .map((l) =>
          l.id === twin.id
            ? {
                ...l,
                quantity: newQty,
                weightKg: isKilo ? newQty : undefined,
                subtotal: calculateLineSubtotal(l.unitPrice, newQty),
              }
            : l
        );
    });
  };

  const clearCart = () => {
    setCartLines([]);
    setDepositAmount(0);
    showToast('Panier vidé');
  };

  const submitNewOrder = (): LaundryOrder | null => {
    if (cartLines.length === 0) {
      showToast('Le panier est vide. Veuillez ajouter au moins un vêtement ou linge.');
      return null;
    }

    // Sur un espace réel vide, aucun client fictif n'est pré-sélectionné :
    // la commande ne peut pas être enregistrée sans dossier client.
    const customer = selectedCustomer;
    if (!customer) {
      showToast('Sélectionnez ou créez un client avant d’enregistrer la commande.');
      return null;
    }

    // Conversion d'un ramassage : la course doit être collectée, non encore
    // convertie, et appartenir au client actuellement sélectionné.
    const sourcePickupTask = pendingPickupTask;
    if (pendingPickupTaskId) {
      if (
        !sourcePickupTask ||
        sourcePickupTask.kind !== 'pickup' ||
        sourcePickupTask.status !== 'completed' ||
        sourcePickupTask.orderId ||
        sourcePickupTask.customerId !== customer.id
      ) {
        showToast('Ce ramassage ne peut pas être converti pour le client sélectionné.');
        return null;
      }
    }

    const wantsHomeDelivery = orderFulfillmentMethod === 'home_delivery';
    const cleanDeliveryAddress = deliveryAddress.trim();
    const cleanDeliveryDetails = deliveryAddressDetails.trim();
    if (wantsHomeDelivery) {
      if (!cleanDeliveryAddress) {
        showToast('Renseignez l’adresse de livraison avant d’enregistrer la commande.');
        return null;
      }
      if (!isValidISODate(deliveryDateISO) || deliveryDateISO < todayISO()) {
        showToast('Choisissez une date de livraison valide, aujourd’hui ou plus tard.');
        return null;
      }
    }

    const collectionFee = sourcePickupTask ? normalizeLogisticsFee(sourcePickupTask.fee) : 0;
    const deliveryFee = wantsHomeDelivery
      ? normalizeLogisticsFee(shopSettings.deliveryFee)
      : 0;

    const { subtotal, expressFee, discountAmount: discount, total, deposit, remaining } =
      calculateOrderTotals(cartLines, {
        pickupOption,
        loyaltyDiscountPercent: customer.loyaltyDiscountPercent,
        depositAmount,
        collectionFee,
        deliveryFee,
      });

    const nextTicketNum = `#TK-${nextTicketNumber}`;
    const promised = formatPromised(getPromisedDate(pickupOption));
    const orderId = genId('ord');
    const nowIso = nowISODateTime();

    const deliveryTask: LogisticsTask | null = wantsHomeDelivery
      ? {
          id: genId('log'),
          kind: 'delivery',
          status: 'scheduled',
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          address: cleanDeliveryAddress,
          addressDetails: cleanDeliveryDetails || undefined,
          scheduledDate: deliveryDateISO,
          timeSlot: deliveryTimeSlot,
          orderId,
          orderTicketNumber: nextTicketNum,
          fee: deliveryFee,
          createdAt: nowIso,
          updatedAt: nowIso,
        }
      : null;

    const newOrder: LaundryOrder = {
      id: orderId,
      ticketNumber: nextTicketNum,
      serviceCategory: selectedServiceCategory || 'pressing',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      lines: [...cartLines],
      subtotal,
      serviceFees: expressFee,
      discount,
      total,
      depositPaid: deposit,
      remainingBalance: remaining,
      paymentMethod,
      status: 'received',
      receivedAt: nowDateTime(),
      promisedAt: promised,
      notes: orderNotes,
      smsSent: false,
      origin: sourcePickupTask ? 'home_pickup' : 'counter',
      fulfillmentMethod: orderFulfillmentMethod,
      collectionTaskId: sourcePickupTask?.id,
      collectionFee,
      collectionAddress: sourcePickupTask?.address,
      collectionAddressDetails: sourcePickupTask?.addressDetails,
      collectionDate: sourcePickupTask?.scheduledDate,
      collectionTimeSlot: sourcePickupTask?.timeSlot,
      deliveryTaskId: deliveryTask?.id,
      deliveryFee,
      deliveryAddress: wantsHomeDelivery ? cleanDeliveryAddress : undefined,
      deliveryAddressDetails: wantsHomeDelivery
        ? cleanDeliveryDetails || undefined
        : undefined,
      deliveryDate: wantsHomeDelivery ? deliveryDateISO : undefined,
      deliveryTimeSlot: wantsHomeDelivery ? deliveryTimeSlot : undefined,
    };

    setOrders((prev) => [newOrder, ...prev]);
    setLogisticsTasks((prev) => {
      const linked = sourcePickupTask
        ? prev.map((task) =>
            task.id === sourcePickupTask.id
              ? {
                  ...task,
                  orderId,
                  orderTicketNumber: nextTicketNum,
                  updatedAt: nowISODateTime(),
                }
              : task
          )
        : prev;
      return deliveryTask ? [deliveryTask, ...linked] : linked;
    });
    setNextTicketNumber((n) => n + 1);

    // Update cash register if deposit received
    if (deposit > 0) {
      setCashRegister((prev) => {
        const cashInc = paymentMethod === 'especes' ? deposit : 0;
        const waveInc = paymentMethod === 'wave' ? deposit : 0;
        const momoInc = paymentMethod === 'momo' || paymentMethod === 'om' ? deposit : 0;
        return {
          ...prev,
          cashAmount: prev.cashAmount + cashInc,
          waveAmount: prev.waveAmount + waveInc,
          momoAmount: prev.momoAmount + momoInc,
          totalAmount: prev.totalAmount + deposit,
        };
      });
    }

    // Update customer deposits
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? { ...c, depositsCount: c.depositsCount + 1, balance: c.balance + remaining }
          : c
      )
    );

    // Trigger festive celebratory confetti
    try {
      fireOrderCelebration(newOrder.serviceCategory);
    } catch (e) {
      console.warn('Confetti trigger error', e);
    }

    // Open ticket preview
    setPreviewTicket(newOrder);
    clearCart();
    resetLogisticsDraft();
    showToast(
      wantsHomeDelivery
        ? `✓ Commande ${newOrder.ticketNumber} enregistrée — livraison à programmer dans Tournées.`
        : `✓ Commande ${newOrder.ticketNumber} enregistrée avec succès! 🎉`
    );
    return newOrder;
  };

  const moveOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // La remise finale passe toujours par un encaissement contrôlé : comptoir
    // pour un retrait, confirmation de tournée pour une livraison à domicile.
    if (newStatus === 'delivered') {
      showToast(
        isHomeDeliveryOrder(order)
          ? 'Confirmez la livraison depuis l’onglet Tournées pour encaisser le solde une seule fois.'
          : 'Utilisez l’onglet Remises pour encaisser puis remettre la commande au comptoir.'
      );
      return;
    }
    if (order.status === 'delivered') {
      showToast('Cette commande est déjà remise : son statut de production ne peut plus changer.');
      return;
    }
    const activeDelivery = logisticsTasks.find(
      (task) => task.kind === 'delivery' && task.orderId === order.id && task.status === 'en_route'
    );
    if (activeDelivery) {
      showToast('Cette commande est déjà en route : terminez ou signalez la livraison dans Tournées avant tout retour en production.');
      return;
    }
    if (
      newStatus === 'ready' &&
      order.status !== 'ready' &&
      shopSettings.storageAssignmentRequired
    ) {
      showToast('Règle du propriétaire : choisissez un casier pour marquer cette commande prête.');
      return;
    }

    const now = nowDateTime();
    const leavingReady = order.status === 'ready' && newStatus !== 'ready';
    const clearedStorageFields = {
      rackLocation: undefined,
      storageLocationId: undefined,
      storageLocationCode: undefined,
      storageLocationLabel: undefined,
      storagePackageCount: undefined,
      storageNotes: undefined,
      storedAt: undefined,
    };
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            status: newStatus,
            readyAt: newStatus === 'ready' ? now : leavingReady ? undefined : ord.readyAt,
            // Entrée en « Prêt » : la commande n'est pas encore marquée comme
            // notifiée localement (le champ historique ne prouve aucun SMS).
            smsSent: newStatus === 'ready' && ord.status !== 'ready' ? false : ord.smsSent,
            deliveredAt: ord.deliveredAt,
            // Une commande qui repart en production n'occupe plus le rayon des
            // prêts ; une nouvelle arrivée en « Prêt » repart non rangée.
            ...(leavingReady || (newStatus === 'ready' && ord.status !== 'ready')
              ? clearedStorageFields
              : {}),
          };
        }
        return ord;
      })
    );
    showToast(
      leavingReady
        ? `${order.ticketNumber} retourne en production — son emplacement est libéré.`
        : newStatus === 'ready'
          ? `✓ ${order.ticketNumber} est prête — pensez à la ranger dans l’onglet Rangement.`
          : 'Statut mis à jour'
    );
  };

  /* ================= Rangement atelier ================= */

  const validateStorageLocationData = (
    data: StorageLocationFormData,
    excludeId?: string
  ): { normalized?: StorageLocationFormData; error?: string } => {
    const code = normalizeStorageCode(data.code);
    const label = data.label.trim();
    const capacityPackages = Number(data.capacityPackages);
    if (!isValidStorageCode(code)) {
      return {
        error: 'Le code doit contenir 2 à 16 lettres/chiffres, séparés si besoin par des tirets (ex. A-01).',
      };
    }
    if (!label) return { error: 'Le libellé de l’emplacement est obligatoire.' };
    if (!Number.isInteger(capacityPackages) || capacityPackages < 1 || capacityPackages > 999) {
      return { error: 'La capacité doit être comprise entre 1 et 999 paquets.' };
    }
    if (
      storageLocations.some(
        (location) =>
          location.id !== excludeId && normalizeStorageCode(location.code) === code
      )
    ) {
      return { error: `Un emplacement portant déjà le code ${code} existe.` };
    }
    return {
      normalized: {
        code,
        label,
        zone: data.zone,
        capacityPackages,
        description: data.description?.trim() || undefined,
        isActive: data.isActive,
      },
    };
  };

  const createStorageLocation = (
    data: StorageLocationFormData
  ): ActionResult & { location?: StorageLocation } => {
    const { normalized, error } = validateStorageLocationData(data);
    if (!normalized || error) return { ok: false, error: error ?? 'Emplacement invalide.' };
    const now = nowISODateTime();
    const location: StorageLocation = {
      ...normalized,
      id: genId('storage'),
      createdAt: now,
      updatedAt: now,
    };
    setStorageLocations((prev) => [...prev, location]);
    showToast(`✓ Emplacement ajouté : ${formatStorageLocation(location)}`);
    return { ok: true, location };
  };

  const createStorageLocationSeries = (
    input: StorageLocationSeriesInput
  ): ActionResult & { locations?: StorageLocation[] } => {
    const { locations: drafts, error } = buildStorageLocationSeries(input, storageLocations);
    if (error || drafts.length === 0) {
      return { ok: false, error: error ?? 'Aucun emplacement à créer.' };
    }

    const now = nowISODateTime();
    const locations: StorageLocation[] = drafts.map((draft, index) => ({
      ...draft,
      id: `${genId('storage')}-${index}`,
      createdAt: now,
      updatedAt: now,
    }));
    setStorageLocations((prev) => [...prev, ...locations]);
    showToast(
      `✓ Série créée : ${locations.length} emplacement(s), de ${locations[0].code} à ${locations[locations.length - 1].code}.`
    );
    return { ok: true, locations };
  };

  const updateStorageLocation = (id: string, data: StorageLocationFormData): ActionResult => {
    const current = storageLocations.find((location) => location.id === id);
    if (!current) return { ok: false, error: 'Emplacement introuvable.' };
    const { normalized, error } = validateStorageLocationData(data, id);
    if (!normalized || error) return { ok: false, error: error ?? 'Emplacement invalide.' };

    const updated: StorageLocation = {
      ...current,
      ...normalized,
      updatedAt: nowISODateTime(),
    };
    setStorageLocations((prev) => prev.map((location) => (location.id === id ? updated : location)));
    // Les écrans de remise lisent un instantané code/libellé : il est
    // resynchronisé pour les commandes encore physiquement rangées. Les
    // commandes déjà remises conservent leur historique tel qu'imprimé.
    setOrders((prev) =>
      prev.map((order) =>
        order.storageLocationId === id && order.status === 'ready'
          ? {
              ...order,
              storageLocationCode: updated.code,
              storageLocationLabel: updated.label,
              rackLocation: formatStorageLocation(updated),
            }
          : order
      )
    );
    showToast(`✓ Emplacement mis à jour : ${formatStorageLocation(updated)}`);
    return { ok: true };
  };

  const deleteStorageLocation = (id: string): ActionResult => {
    const location = storageLocations.find((item) => item.id === id);
    if (!location) return { ok: false, error: 'Emplacement introuvable.' };
    const isReferenced = orders.some((order) => {
      if (order.storageLocationId === id) return true;
      const referencedCode = normalizeStorageCode(getOrderStorageCode(order) ?? '');
      return referencedCode !== '' && referencedCode === location.code;
    });
    if (isReferenced) {
      return {
        ok: false,
        error:
          'Cet emplacement est déjà cité par au moins une commande : désactivez-le pour conserver l’historique.',
      };
    }
    setStorageLocations((prev) => prev.filter((item) => item.id !== id));
    showToast(`✓ Emplacement supprimé : ${formatStorageLocation(location)}`);
    return { ok: true };
  };

  const setStorageLocationActive = (id: string, isActive: boolean) => {
    const location = storageLocations.find((item) => item.id === id);
    if (!location) return;
    setStorageLocations((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isActive, updatedAt: nowISODateTime() } : item
      )
    );
    const currentOrders = orders.filter(
      (order) => order.storageLocationId === id && order.status === 'ready'
    ).length;
    showToast(
      isActive
        ? `✓ Emplacement réactivé : ${formatStorageLocation(location)}`
        : `Emplacement désactivé pour les nouveaux rangements${currentOrders ? ` — ${currentOrders} commande(s) déjà placée(s) restent visibles.` : '.'}`
    );
  };

  const isOrderOutForDelivery = (orderId: string): boolean =>
    logisticsTasks.some(
      (task) => task.kind === 'delivery' && task.orderId === orderId && task.status === 'en_route'
    );

  const resolveStorageAssignment = (
    input: StorageAssignmentInput,
    required: boolean,
    existingLocationId?: string,
    orderId?: string
  ): {
    location?: StorageLocation;
    packageCount?: number;
    notes?: string;
    error?: string;
  } => {
    if (!input.locationId) {
      return required ? { error: 'Choisissez l’emplacement où les paquets sont rangés.' } : {};
    }
    const location = storageLocations.find((item) => item.id === input.locationId);
    if (!location) return { error: 'L’emplacement sélectionné est introuvable.' };
    // Un emplacement désactivé reste modifiable pour une commande qui s'y
    // trouve déjà (correction du nombre de paquets), mais ne reçoit plus de
    // nouvelle commande.
    if (!location.isActive && location.id !== existingLocationId) {
      return { error: 'Cet emplacement est désactivé : choisissez-en un autre.' };
    }
    const packageCount = sanitizePackageCount(input.packageCount);
    if (!packageCount) {
      return { error: 'Indiquez un nombre de paquets entier compris entre 1 et 999.' };
    }

    if (!shopSettings.storageAllowCapacityOverflow) {
      const occupancy = calculateStorageOccupancy(orders, logisticsTasks).get(location.id) ?? {
        orderCount: 0,
        packageCount: 0,
        unknownPackageOrders: 0,
      };
      const adjustedOccupancy = { ...occupancy };
      const currentOrder = orderId ? orders.find((item) => item.id === orderId) : undefined;
      if (
        currentOrder &&
        currentOrder.storageLocationId === location.id &&
        currentOrder.status === 'ready' &&
        !isOrderOutForDelivery(currentOrder.id)
      ) {
        const currentPackages = getOrderPackageCount(currentOrder);
        if (currentPackages) {
          adjustedOccupancy.packageCount = Math.max(
            0,
            adjustedOccupancy.packageCount - currentPackages
          );
        } else {
          adjustedOccupancy.unknownPackageOrders = Math.max(
            0,
            adjustedOccupancy.unknownPackageOrders - 1
          );
        }
      }
      if (wouldExceedKnownStorageCapacity(location, adjustedOccupancy, packageCount)) {
        return {
          error: `${location.code} est plein (${adjustedOccupancy.packageCount}/${location.capacityPackages} paquets connus) : choisissez un autre emplacement ou augmentez sa capacité.`,
        };
      }
    }

    return {
      location,
      packageCount,
      notes: input.notes?.trim() || undefined,
    };
  };

  const clearStorageFields = () => ({
    rackLocation: undefined,
    storageLocationId: undefined,
    storageLocationCode: undefined,
    storageLocationLabel: undefined,
    storagePackageCount: undefined,
    storageNotes: undefined,
    storedAt: undefined,
  });

  const markOrderReadyAndStore = (
    orderId: string,
    input: StorageAssignmentInput
  ): ActionResult => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, error: 'Commande introuvable.' };
    if (order.status === 'delivered') {
      return { ok: false, error: 'Cette commande est déjà remise.' };
    }
    if (order.status === 'ready') {
      return {
        ok: false,
        error: 'Cette commande est déjà prête : utilisez Ranger/Déplacer pour changer son emplacement.',
      };
    }
    if (isOrderOutForDelivery(orderId)) {
      return { ok: false, error: 'Cette commande est déjà en cours de livraison.' };
    }
    const { location, packageCount, notes, error } = resolveStorageAssignment(
      input,
      shopSettings.storageAssignmentRequired,
      undefined,
      orderId
    );
    if (error) return { ok: false, error };

    const now = nowDateTime();
    setOrders((prev) =>
      prev.map((item) =>
        item.id === orderId
          ? {
              ...item,
              status: 'ready',
              readyAt: now,
              smsSent: false,
              ...(location
                ? {
                    rackLocation: formatStorageLocation(location),
                    storageLocationId: location.id,
                    storageLocationCode: location.code,
                    storageLocationLabel: location.label,
                    storagePackageCount: packageCount,
                    storageNotes: notes,
                    storedAt: now,
                  }
                : clearStorageFields()),
            }
          : item
      )
    );
    showToast(
      location
        ? `✓ ${order.ticketNumber} prête et rangée en ${location.code}.`
        : `✓ ${order.ticketNumber} prête — à ranger depuis l’onglet Rangement.`
    );
    return { ok: true };
  };

  const assignOrderStorage = (orderId: string, input: StorageAssignmentInput): ActionResult => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, error: 'Commande introuvable.' };
    if (order.status !== 'ready') {
      return { ok: false, error: 'Seules les commandes prêtes se rangent dans la zone d’attente des retraits.' };
    }
    if (isOrderOutForDelivery(orderId)) {
      return { ok: false, error: 'Cette commande est avec le livreur : elle ne peut pas être rangée en atelier.' };
    }
    const { location, packageCount, notes, error } = resolveStorageAssignment(
      input,
      true,
      order.storageLocationId,
      orderId
    );
    if (error || !location) return { ok: false, error: error ?? 'Emplacement invalide.' };

    const now = nowDateTime();
    const isSameLocation = order.storageLocationId === location.id;
    setOrders((prev) =>
      prev.map((item) =>
        item.id === orderId
          ? {
              ...item,
              rackLocation: formatStorageLocation(location),
              storageLocationId: location.id,
              storageLocationCode: location.code,
              storageLocationLabel: location.label,
              storagePackageCount: packageCount,
              storageNotes: notes,
              // Une correction sur place (paquets/repère) ne doit pas faire
              // repartir à zéro l'ancienneté du rangement.
              storedAt: isSameLocation ? item.storedAt ?? now : now,
            }
          : item
      )
    );
    showToast(
      isSameLocation
        ? `✓ Rangement de ${order.ticketNumber} mis à jour en ${location.code}.`
        : `✓ ${order.ticketNumber} rangée en ${location.code}.`
    );
    return { ok: true };
  };

  const clearOrderStorage = (orderId: string): ActionResult => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return { ok: false, error: 'Commande introuvable.' };
    if (order.status !== 'ready') {
      return { ok: false, error: 'Cette commande n’est pas dans la zone des commandes prêtes.' };
    }
    if (isOrderOutForDelivery(orderId)) {
      return { ok: false, error: 'Cette commande est déjà en cours de livraison.' };
    }
    if (!hasStorageLocation(order)) {
      return { ok: false, error: 'Cette commande n’a déjà aucun emplacement renseigné.' };
    }
    setOrders((prev) =>
      prev.map((item) => (item.id === orderId ? { ...item, ...clearStorageFields() } : item))
    );
    showToast(`${order.ticketNumber} marquée non rangée — choisissez son nouvel emplacement.`);
    return { ok: true };
  };

  const settleAndDeliverOrder = (orderId: string, method: 'especes' | 'wave' | 'momo' | 'om') => {
    // Lecture de la commande AVANT toute mise à jour d'état : les updaters
    // React doivent rester des fonctions pures. L'ancienne version appelait
    // setCashRegister à l'intérieur de l'updater de setOrders, ce qui pouvait
    // créditer la caisse deux fois (ex. double invocation en mode Strict).
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    if (isHomeDeliveryOrder(order)) {
      showToast('Cette commande est en livraison à domicile : terminez-la depuis l’onglet Tournées.');
      return;
    }
    if (order.status !== 'ready') {
      showToast('Seule une commande prête peut être remise au comptoir.');
      return;
    }
    const balance = order.remainingBalance;
    const deliveredAt = nowDateTime();

    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId
          ? { ...ord, depositPaid: ord.total, remainingBalance: 0, status: 'delivered', deliveredAt }
          : ord
      )
    );

    if (balance > 0) {
      setCashRegister((reg) => ({
        ...reg,
        cashAmount: reg.cashAmount + (method === 'especes' ? balance : 0),
        waveAmount: reg.waveAmount + (method === 'wave' ? balance : 0),
        momoAmount: reg.momoAmount + (method === 'momo' || method === 'om' ? balance : 0),
        totalAmount: reg.totalAmount + balance,
      }));
      // Le reste à payer avait été ajouté au solde dû du client à la création
      // de la commande : on le déduit maintenant qu'il est encaissé.
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === order.customerId ? { ...c, balance: Math.max(0, c.balance - balance) } : c
        )
      );
    }

    if (activeHandoverOrder?.id === orderId) setActiveHandoverOrder(null);
    showToast(`✓ Commande remise au client et solde encaissé via ${PAYMENT_METHOD_LABELS[method]}!`);
  };

  /* ================= Ramassage & livraison ================= */

  const sanitizeBags = (value?: number): number | undefined => {
    if (value === undefined || !Number.isFinite(value)) return undefined;
    return Math.min(99, Math.max(1, Math.round(value)));
  };

  const resolveLogisticsEmployee = (
    employeeId?: string
  ): { employee?: Employee; error?: string } => {
    if (!employeeId) return {};
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return { error: 'Le coursier sélectionné est introuvable.' };
    if (employee.status !== 'active') {
      return { error: `${employee.fullName} n’est pas actif et ne peut pas recevoir cette tournée.` };
    }
    return { employee };
  };

  const patchLogisticsTask = (taskId: string, patch: Partial<LogisticsTask>) => {
    setLogisticsTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, ...patch, updatedAt: nowISODateTime() } : task
      )
    );
  };

  const createPickupTask = (
    data: PickupTaskFormData
  ): ActionResult & { task?: LogisticsTask } => {
    const address = data.address.trim();
    if (!address) return { ok: false, error: 'L’adresse de ramassage est obligatoire.' };
    if (!isValidISODate(data.scheduledDate) || data.scheduledDate < todayISO()) {
      return { ok: false, error: 'Choisissez une date de ramassage valide, aujourd’hui ou plus tard.' };
    }

    const { employee, error: employeeError } = resolveLogisticsEmployee(data.assignedEmployeeId);
    if (employeeError) return { ok: false, error: employeeError };

    let customer: Customer | undefined;
    if (data.customerMode === 'existing') {
      customer = customers.find((c) => c.id === data.customerId);
      if (!customer) return { ok: false, error: 'Sélectionnez un client existant.' };
    } else {
      const name = (data.newCustomerName ?? '').trim();
      const phone = (data.newCustomerPhone ?? '').trim();
      if (!name) return { ok: false, error: 'Le nom du nouveau client est obligatoire.' };
      if (!phone) return { ok: false, error: 'Le téléphone du nouveau client est obligatoire.' };
      const phoneDigits = phone.replace(/\D/g, '');
      const duplicate = customers.find((c) => c.phone.replace(/\D/g, '') === phoneDigits);
      if (duplicate) {
        return {
          ok: false,
          error: `Ce numéro appartient déjà à ${duplicate.name}. Sélectionnez ce client existant.`,
        };
      }
      customer = {
        id: genId('cust'),
        name,
        phone,
        address,
        depositsCount: 0,
        balance: 0,
        loyaltyDiscountPercent: 0,
      };
      setCustomers((prev) => [customer as Customer, ...prev]);
    }

    const now = nowISODateTime();
    const task: LogisticsTask = {
      id: genId('log'),
      kind: 'pickup',
      status: 'scheduled',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      address,
      addressDetails: data.addressDetails?.trim() || undefined,
      scheduledDate: data.scheduledDate,
      timeSlot: data.timeSlot,
      assignedEmployeeId: employee?.id,
      assignedEmployeeName: employee?.fullName,
      fee: normalizeLogisticsFee(shopSettings.pickupFee),
      estimatedBags: sanitizeBags(data.estimatedBags),
      instructions: data.instructions?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    setLogisticsTasks((prev) => [task, ...prev]);
    showToast(`✓ Ramassage programmé pour ${customer.name}.`);
    return { ok: true, task };
  };

  const updateLogisticsTask = (
    taskId: string,
    data: LogisticsTaskScheduleFormData
  ): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Cette tournée est introuvable.' };
    if (task.status === 'completed' || task.status === 'en_route') {
      return { ok: false, error: 'Une tournée en route ou terminée ne peut plus être modifiée.' };
    }

    const address = data.address.trim();
    if (!address) return { ok: false, error: 'L’adresse est obligatoire.' };
    if (!isValidISODate(data.scheduledDate) || data.scheduledDate < todayISO()) {
      return { ok: false, error: 'Choisissez une date valide, aujourd’hui ou plus tard.' };
    }

    const { employee, error: employeeError } = resolveLogisticsEmployee(data.assignedEmployeeId);
    if (employeeError) return { ok: false, error: employeeError };

    const linkedOrder = task.orderId ? orders.find((o) => o.id === task.orderId) : undefined;
    if (task.kind === 'delivery' && linkedOrder?.status === 'delivered') {
      return { ok: false, error: 'Cette commande est déjà livrée.' };
    }

    patchLogisticsTask(taskId, {
      address,
      addressDetails: data.addressDetails?.trim() || undefined,
      scheduledDate: data.scheduledDate,
      timeSlot: data.timeSlot,
      assignedEmployeeId: employee?.id,
      assignedEmployeeName: employee?.fullName,
      estimatedBags: task.kind === 'pickup' ? sanitizeBags(data.estimatedBags) : task.estimatedBags,
      instructions: data.instructions?.trim() || undefined,
      status: 'scheduled',
      issueReason: undefined,
      issueNotes: undefined,
      startedAt: undefined,
      completedAt: undefined,
    });

    // Le ticket doit refléter la dernière adresse/créneau promis au client.
    if (task.kind === 'delivery' && task.orderId) {
      setOrders((prev) =>
        prev.map((order) =>
          order.id === task.orderId
            ? {
                ...order,
                deliveryAddress: address,
                deliveryAddressDetails: data.addressDetails?.trim() || undefined,
                deliveryDate: data.scheduledDate,
                deliveryTimeSlot: data.timeSlot,
              }
            : order
        )
      );
    }

    showToast(task.status === 'scheduled' ? '✓ Tournée mise à jour.' : '✓ Tournée reprogrammée.');
    return { ok: true };
  };

  const assignLogisticsTask = (taskId: string, employeeId: string): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Cette tournée est introuvable.' };
    if (task.status === 'completed' || task.status === 'cancelled') {
      return { ok: false, error: 'Cette tournée ne peut plus être assignée.' };
    }
    const { employee, error } = resolveLogisticsEmployee(employeeId || undefined);
    if (error) return { ok: false, error };
    patchLogisticsTask(taskId, {
      assignedEmployeeId: employee?.id,
      assignedEmployeeName: employee?.fullName,
    });
    showToast(employee ? `✓ Tournée assignée à ${employee.fullName}.` : 'Coursier retiré de la tournée.');
    return { ok: true };
  };

  const startLogisticsTask = (taskId: string): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Cette tournée est introuvable.' };
    if (task.status !== 'scheduled') {
      return { ok: false, error: 'Seule une tournée programmée peut démarrer.' };
    }
    if (!task.assignedEmployeeId) {
      return { ok: false, error: 'Assignez un coursier avant le départ.' };
    }
    const employee = employees.find((e) => e.id === task.assignedEmployeeId);
    if (!employee || employee.status !== 'active') {
      return { ok: false, error: 'Le coursier assigné n’est plus actif. Choisissez-en un autre.' };
    }
    if (task.kind === 'delivery') {
      const order = orders.find((o) => o.id === task.orderId);
      if (!order) return { ok: false, error: 'La commande liée à cette livraison est introuvable.' };
      if (order.status !== 'ready') {
        return { ok: false, error: 'Cette livraison ne peut partir que lorsque la commande est prête.' };
      }
    }

    patchLogisticsTask(taskId, {
      status: 'en_route',
      assignedEmployeeName: employee.fullName,
      startedAt: nowISODateTime(),
      issueReason: undefined,
      issueNotes: undefined,
    });
    showToast(`🚚 ${employee.fullName} est en route pour ${task.customerName}.`);
    return { ok: true };
  };

  const completePickupTask = (taskId: string, collectedBags?: number): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task || task.kind !== 'pickup') return { ok: false, error: 'Ce ramassage est introuvable.' };
    if (task.status !== 'en_route') {
      return { ok: false, error: 'Démarrez d’abord la tournée avant de confirmer la collecte.' };
    }
    patchLogisticsTask(taskId, {
      status: 'completed',
      collectedBags: sanitizeBags(collectedBags),
      completedAt: nowISODateTime(),
    });
    showToast('✓ Linge collecté. Créez la commande après le comptage à la boutique.');
    return { ok: true };
  };

  const completeDeliveryTask = (
    taskId: string,
    paymentMethodForBalance: PaymentMethod
  ): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task || task.kind !== 'delivery') return { ok: false, error: 'Cette livraison est introuvable.' };
    if (task.status !== 'en_route') {
      return { ok: false, error: 'Démarrez d’abord la tournée avant de confirmer la livraison.' };
    }
    const order = orders.find((o) => o.id === task.orderId);
    if (!order) return { ok: false, error: 'La commande liée à cette livraison est introuvable.' };
    if (order.status !== 'ready') {
      return { ok: false, error: 'La commande doit être prête et non encore remise pour être livrée.' };
    }

    const balance = Math.max(0, order.remainingBalance);
    const deliveredAt = nowDateTime();

    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === order.id
          ? {
              ...ord,
              depositPaid: ord.total,
              remainingBalance: 0,
              status: 'delivered',
              deliveredAt,
              paymentMethod:
                balance > 0 && ord.depositPaid === 0 ? paymentMethodForBalance : ord.paymentMethod,
            }
          : ord
      )
    );

    patchLogisticsTask(taskId, {
      status: 'completed',
      completedAt: nowISODateTime(),
      collectedAmount: balance,
      collectedPaymentMethod: balance > 0 ? paymentMethodForBalance : undefined,
    });

    if (balance > 0) {
      setCashRegister((reg) => ({
        ...reg,
        cashAmount: reg.cashAmount + (paymentMethodForBalance === 'especes' ? balance : 0),
        waveAmount: reg.waveAmount + (paymentMethodForBalance === 'wave' ? balance : 0),
        momoAmount:
          reg.momoAmount + (paymentMethodForBalance === 'momo' || paymentMethodForBalance === 'om' ? balance : 0),
        totalAmount: reg.totalAmount + balance,
      }));
      setCustomers((prev) =>
        prev.map((customer) =>
          customer.id === order.customerId
            ? { ...customer, balance: Math.max(0, customer.balance - balance) }
            : customer
        )
      );
    }

    if (activeHandoverOrder?.id === order.id) setActiveHandoverOrder(null);
    showToast(
      balance > 0
        ? `✓ ${order.ticketNumber} livrée — ${balance.toLocaleString('fr-FR')} FCFA encaissés via ${PAYMENT_METHOD_LABELS[paymentMethodForBalance]}.`
        : `✓ ${order.ticketNumber} livrée — commande déjà soldée.`
    );
    return { ok: true };
  };

  const failLogisticsTask = (
    taskId: string,
    reason: LogisticsIssueReason,
    notes?: string
  ): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Cette tournée est introuvable.' };
    if (task.status !== 'en_route') {
      return { ok: false, error: 'Seule une tournée en route peut être marquée en échec.' };
    }
    patchLogisticsTask(taskId, {
      status: 'failed',
      issueReason: reason,
      issueNotes: notes?.trim() || undefined,
      completedAt: undefined,
    });
    showToast('Tournée en échec : elle reste visible dans « À traiter » pour reprogrammation.');
    return { ok: true };
  };

  const cancelLogisticsTask = (
    taskId: string,
    reason: LogisticsIssueReason,
    notes?: string
  ): ActionResult => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Cette tournée est introuvable.' };
    if (task.status !== 'scheduled' && task.status !== 'failed') {
      return { ok: false, error: 'Seule une tournée programmée ou en échec peut être annulée.' };
    }
    patchLogisticsTask(taskId, {
      status: 'cancelled',
      issueReason: reason,
      issueNotes: notes?.trim() || undefined,
      completedAt: undefined,
    });
    showToast('Tournée annulée. Elle pourra être reprogrammée depuis l’historique si besoin.');
    return { ok: true };
  };

  const startOrderFromPickupTask = (taskId: string): boolean => {
    const task = logisticsTasks.find((t) => t.id === taskId);
    if (!task || task.kind !== 'pickup') {
      showToast('Ce ramassage est introuvable.');
      return false;
    }
    if (task.status !== 'completed') {
      showToast('Confirmez d’abord la collecte avant de compter et créer la commande.');
      return false;
    }
    if (task.orderId) {
      showToast(`Ce ramassage est déjà converti en commande ${task.orderTicketNumber ?? ''}.`);
      return false;
    }
    const customer = customers.find((c) => c.id === task.customerId);
    if (!customer) {
      showToast('La fiche client de ce ramassage est introuvable.');
      return false;
    }

    setCartLines([]);
    setDepositAmount(0);
    setSelectedCustomer(customer);
    // Les instructions de tournée restent sur la course ; les consignes
    // atelier sont saisies séparément après inspection des pièces.
    setOrderNotes('');
    setOrderFulfillmentMethod('counter_pickup');
    setDeliveryAddress(task.address);
    setDeliveryAddressDetails(task.addressDetails ?? '');
    setDeliveryScheduleManual(false);
    setDeliveryDateISOState(toISODate(getPromisedDate(pickupOption)));
    setDeliveryTimeSlotState(getDefaultDeliveryTimeSlot(pickupOption));
    setPendingPickupTaskId(task.id);
    setSelectedServiceCategory(null);
    setOrderStep(1);
    setActiveScreen('pos');
    showToast('Ramassage chargé : comptez les pièces puis enregistrez la commande.');
    return true;
  };

  const cancelPendingPickupConversion = () => {
    if (!pendingPickupTaskId) return;
    setPendingPickupTaskId(null);
    setOrderFulfillmentMethod('counter_pickup');
    setDeliveryAddress(selectedCustomer?.address || '');
    setDeliveryAddressDetails('');
    showToast('Ramassage détaché : la saisie redevient une commande comptoir.');
  };

  const focusLogisticsTask = (taskId: string) => {
    setFocusedLogisticsTaskId(taskId);
    setActiveScreen('workshop');
  };

  const addNewCustomer = (custData: Omit<Customer, 'id' | 'depositsCount' | 'balance'>): Customer => {
    const newCust: Customer = {
      ...custData,
      id: `cust-${Date.now()}`,
      depositsCount: 1,
      balance: 0,
    };
    setCustomers((prev) => [newCust, ...prev]);
    setSelectedCustomer(newCust);
    setNewCustomerModalOpen(false);
    showToast(`✓ Fiche client créée pour ${newCust.name}`);
    return newCust;
  };

  const markReadyOrdersAsNotifiedLocally = () => {
    const readyOrders = orders.filter((o) => o.status === 'ready');
    const toMarkCount = readyOrders.filter((o) => !o.smsSent).length;

    if (toMarkCount > 0) {
      setOrders((prev) =>
        prev.map((o) => (o.status === 'ready' && !o.smsSent ? { ...o, smsSent: true } : o))
      );
      showToast(
        `✓ ${toMarkCount} commande(s) prête(s) marquée(s) comme notifiée(s) dans l’application — aucun SMS externe envoyé.`
      );
      return;
    }

    showToast(
      readyOrders.length > 0
        ? 'Toutes les commandes prêtes sont déjà marquées comme notifiées dans l’application.'
        : 'Aucune commande prête à marquer pour le moment.'
    );
  };

  /* ================= Module Personnel ================= */

  const addEmployee = (data: EmployeeFormData): Employee => {
    const now = nowISODateTime();
    const employee: Employee = { ...data, id: genId('emp'), createdAt: now, updatedAt: now };
    setEmployees((prev) => [employee, ...prev]);
    showToast(`✓ Employé ajouté : ${employee.fullName}`);
    return employee;
  };

  const updateEmployee = (id: string, data: EmployeeFormData): boolean => {
    let found = false;
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        found = true;
        return { ...e, ...data, id: e.id, updatedAt: nowISODateTime() };
      })
    );
    if (found) showToast('✓ Fiche employé mise à jour');
    return found;
  };

  const setEmployeeStatus = (id: string, status: EmployeeStatus) => {
    const employee = employees.find((e) => e.id === id);
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status, updatedAt: nowISODateTime() } : e))
    );
    if (employee) {
      showToast(
        status === 'inactive'
          ? `Employé désactivé : ${employee.fullName}`
          : status === 'leave'
          ? `${employee.fullName} marqué en congé`
          : `✓ Employé réactivé : ${employee.fullName}`
      );
    }
  };

  /** Unicité (employé, date) : une correction remplace la saisie existante. */
  const upsertAttendance = (
    employeeId: string,
    date: string,
    status: AttendanceRecord['status'],
    extra?: { arrivalTime?: string; reason?: string }
  ) => {
    setAttendanceRecords((prev) => {
      const existing = prev.find((r) => r.employeeId === employeeId && r.date === date);
      if (existing) {
        return prev.map((r) =>
          r.id === existing.id
            ? { ...r, status, arrivalTime: extra?.arrivalTime, reason: extra?.reason }
            : r
        );
      }
      return [
        ...prev,
        { id: genId('att'), employeeId, date, status, arrivalTime: extra?.arrivalTime, reason: extra?.reason },
      ];
    });
    showToast('✓ Présence enregistrée');
  };

  const removeAttendance = (employeeId: string, date: string) => {
    setAttendanceRecords((prev) =>
      prev.filter((r) => !(r.employeeId === employeeId && r.date === date))
    );
    showToast('Saisie de présence effacée (retour à « Non renseigné »)');
  };

  /* ================= Module Stocks ================= */

  const isReferenceTaken = (reference: string, exceptId?: string): boolean =>
    products.some(
      (p) => p.id !== exceptId && normalizeText(p.reference) === normalizeText(reference)
    );

  const createProduct = (
    data: ProductFormData,
    initialQuantity: number,
    initialDateISO: string
  ): ActionResult & { product?: InventoryProduct } => {
    if (isReferenceTaken(data.reference)) {
      return { ok: false, error: `La référence « ${data.reference} » est déjà utilisée par un autre produit.` };
    }
    if (initialQuantity < 0) {
      return { ok: false, error: 'La quantité initiale ne peut pas être négative.' };
    }
    const product: InventoryProduct = {
      ...data,
      id: genId('prod'),
      currentQuantity: initialQuantity,
    };
    setProducts((prev) => [product, ...prev]);
    // Toute quantité initiale est tracée par un mouvement d'entrée.
    if (initialQuantity > 0) {
      setStockMovements((prev) => [
        {
          id: genId('mov'),
          productId: product.id,
          type: 'in',
          quantity: initialQuantity,
          quantityBefore: 0,
          quantityAfter: initialQuantity,
          date: initialDateISO,
          reason: 'Stock initial à la création du produit',
          unitCostXof: data.unitCostXof,
        },
        ...prev,
      ]);
    }
    showToast(`✓ Produit créé : ${product.name}`);
    return { ok: true, product };
  };

  const updateProduct = (id: string, data: ProductFormData): ActionResult => {
    if (isReferenceTaken(data.reference, id)) {
      return { ok: false, error: `La référence « ${data.reference} » est déjà utilisée par un autre produit.` };
    }
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data, id: p.id } : p)));
    showToast('✓ Produit mis à jour');
    return { ok: true };
  };

  const setProductActive = (id: string, isActive: boolean) => {
    const product = products.find((p) => p.id === id);
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, isActive } : p)));
    if (product) {
      showToast(
        isActive
          ? `✓ Produit réactivé : ${product.name}`
          : `Produit désactivé : ${product.name} (historique conservé)`
      );
    }
  };

  /**
   * Point d'écriture UNIQUE du stock : quantité du produit et historique des
   * mouvements sont toujours mis à jour ensemble (voir lib/inventory.ts).
   */
  const recordStockMovement = (input: StockMovementInput): ActionResult => {
    const product = products.find((p) => p.id === input.productId);
    if (!product) return { ok: false, error: 'Produit introuvable.' };
    if (!product.isActive) {
      return { ok: false, error: 'Produit désactivé : réactivez-le avant d’enregistrer un mouvement.' };
    }
    if (input.type === 'adjustment' && !input.reason.trim()) {
      return { ok: false, error: 'Un ajustement exige un motif (ex. inventaire, casse…).' };
    }
    const { quantityBefore, quantityAfter, error } = computeMovement(
      product.currentQuantity,
      input.type,
      input.quantity
    );
    if (error) return { ok: false, error };

    const movement: StockMovement = {
      id: genId('mov'),
      productId: product.id,
      type: input.type,
      quantity: input.quantity,
      quantityBefore,
      quantityAfter,
      date: input.date,
      reason: input.reason.trim(),
      unitCostXof: input.unitCostXof,
      note: input.note?.trim() || undefined,
    };
    setStockMovements((prev) => [movement, ...prev]);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id
          ? {
              ...p,
              currentQuantity: quantityAfter,
              // Une entrée avec coût met à jour le « dernier coût d'achat » du produit.
              unitCostXof:
                input.type === 'in' && typeof input.unitCostXof === 'number'
                  ? input.unitCostXof
                  : p.unitCostXof,
            }
          : p
      )
    );
    showToast(`✓ Mouvement enregistré — ${product.name} : nouveau stock ${quantityAfter} ${product.unit}`);
    return { ok: true };
  };

  /* ================= Module Dépenses ================= */

  const addExpense = (data: ExpenseFormData): Expense => {
    const now = nowISODateTime();
    const expense: Expense = { ...data, id: genId('exp'), status: 'recorded', createdAt: now, updatedAt: now };
    setExpenses((prev) => [expense, ...prev]);
    showToast('✓ Dépense enregistrée');
    return expense;
  };

  const updateExpense = (id: string, data: ExpenseFormData): boolean => {
    let found = false;
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        found = true;
        return { ...e, ...data, id: e.id, updatedAt: nowISODateTime() };
      })
    );
    if (found) showToast('✓ Dépense mise à jour');
    return found;
  };

  const cancelExpense = (id: string, reason: string) => {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, status: 'cancelled', cancellationReason: reason.trim(), updatedAt: nowISODateTime() }
          : e
      )
    );
    showToast('Dépense annulée — exclue des totaux, conservée dans le registre');
  };

  const addExpenseCategory = (label: string): ActionResult => {
    const trimmed = label.trim();
    if (!trimmed) return { ok: false, error: 'Le libellé de la catégorie est obligatoire.' };
    if (expenseCategories.some((c) => normalizeText(c.label) === normalizeText(trimmed))) {
      return { ok: false, error: 'Une catégorie avec ce libellé existe déjà.' };
    }
    setExpenseCategories((prev) => [...prev, { id: genId('cat'), label: trimmed, isActive: true }]);
    showToast(`✓ Catégorie ajoutée : ${trimmed}`);
    return { ok: true };
  };

  const renameExpenseCategory = (id: string, label: string): ActionResult => {
    const trimmed = label.trim();
    if (!trimmed) return { ok: false, error: 'Le libellé de la catégorie est obligatoire.' };
    if (expenseCategories.some((c) => c.id !== id && normalizeText(c.label) === normalizeText(trimmed))) {
      return { ok: false, error: 'Une catégorie avec ce libellé existe déjà.' };
    }
    setExpenseCategories((prev) => prev.map((c) => (c.id === id ? { ...c, label: trimmed } : c)));
    showToast('✓ Catégorie renommée');
    return { ok: true };
  };

  const setExpenseCategoryActive = (id: string, isActive: boolean) => {
    setExpenseCategories((prev) => prev.map((c) => (c.id === id ? { ...c, isActive } : c)));
    showToast(isActive ? 'Catégorie réactivée pour les nouvelles saisies' : 'Catégorie désactivée pour les nouvelles saisies');
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      showToast(next ? 'Barre latérale repliée (Alt+S)' : 'Barre latérale déployée (Alt+S)');
      return next;
    });
  };

  // Tiroir de navigation mobile (< 768 px) : la barre latérale devient un panneau coulissant
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  // Global Keyboard Shortcuts
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
        showToast('Tableau de bord (F1)');
        return;
      }
      if (e.key === 'F2' || (e.altKey && e.key === '2')) {
        e.preventDefault();
        setActiveScreen('pos');
        showToast('Réception comptoir POS (F2)');
        return;
      }
      if (e.key === 'F3' || (e.altKey && e.key === '3')) {
        e.preventDefault();
        setActiveScreen('workshop');
        showToast('Atelier de production (F3)');
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
        showToast('Fichier clients (Alt+5)');
        return;
      }
      if (e.altKey && (e.key === '6' || e.key.toLowerCase() === 'o')) {
        e.preventDefault();
        setActiveScreen('orders');
        showToast('Commandes récentes (Alt+6)');
        return;
      }
      if (e.altKey && e.key === '7') {
        e.preventDefault();
        setActiveScreen('employees');
        showToast('Personnel (Alt+7)');
        return;
      }
      if (e.altKey && e.key === '8') {
        e.preventDefault();
        setActiveScreen('inventory');
        showToast('Stocks (Alt+8)');
        return;
      }
      if (e.altKey && e.key === '9') {
        e.preventDefault();
        setActiveScreen('expenses');
        showToast('Dépenses (Alt+9)');
        return;
      }
      if (e.altKey && e.key === '0') {
        e.preventDefault();
        setActiveScreen('reports');
        showToast('Rapports (Alt+0)');
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
          showToast('Tableau de bord [D]');
        } else if (e.key.toLowerCase() === 'n' || e.key.toLowerCase() === 'r') {
          setActiveScreen('pos');
          showToast('Réception [N]');
        } else if (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'w') {
          setActiveScreen('workshop');
          showToast('Atelier [A]');
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

  return (
    <AppContext.Provider
      value={{
        workspace,
        activeScreen,
        setActiveScreen,
        orders,
        customers,
        cashRegister,
        activeHandoverOrder,
        setActiveHandoverOrder,
        selectedCustomer,
        setSelectedCustomer,
        cartLines,
        addCartItem,
        removeCartItem,
        updateCartItemQty,
        selectedGarmentColor,
        setSelectedGarmentColor,
        updateCartLineColor,
        clearCart,
        pickupOption,
        setPickupOption,
        orderFulfillmentMethod,
        setOrderFulfillmentMethod,
        deliveryAddress,
        setDeliveryAddress,
        deliveryAddressDetails,
        setDeliveryAddressDetails,
        deliveryDateISO,
        setDeliveryDateISO,
        deliveryTimeSlot,
        setDeliveryTimeSlot,
        pendingPickupTask,
        pendingPickupTaskId,
        nextTicketNumber,
        orderNotes,
        setOrderNotes,
        depositAmount,
        setDepositAmount,
        paymentMethod,
        setPaymentMethod,
        selectedServiceFilter,
        setSelectedServiceFilter,
        previewTicket,
        setPreviewTicket,
        closingZModalOpen,
        setClosingZModalOpen,
        newCustomerModalOpen,
        setNewCustomerModalOpen,
        smsModalData,
        setSmsModalData,
        submitNewOrder,
        moveOrderStatus,
        settleAndDeliverOrder,
        storageLocations,
        createStorageLocation,
        createStorageLocationSeries,
        updateStorageLocation,
        deleteStorageLocation,
        setStorageLocationActive,
        markOrderReadyAndStore,
        assignOrderStorage,
        clearOrderStorage,
        focusedStorageOrderId,
        setFocusedStorageOrderId,
        focusStorageOrder,
        storagePanelViewRequest,
        clearStoragePanelViewRequest,
        openStorageLocationsConfig,
        logisticsTasks,
        createPickupTask,
        updateLogisticsTask,
        assignLogisticsTask,
        startLogisticsTask,
        completePickupTask,
        completeDeliveryTask,
        failLogisticsTask,
        cancelLogisticsTask,
        startOrderFromPickupTask,
        cancelPendingPickupConversion,
        focusedLogisticsTaskId,
        setFocusedLogisticsTaskId,
        focusLogisticsTask,
        workshopTabRequest,
        requestWorkshopTab,
        activeWorkshopTab,
        setActiveWorkshopTab,
        clearWorkshopTabRequest,
        settingsTabRequest,
        requestSettingsTab,
        clearSettingsTabRequest,
        addNewCustomer,
        markReadyOrdersAsNotifiedLocally,
        selectedServiceCategory,
        setSelectedServiceCategory,
        orderStep,
        setOrderStep,
        resetNewOrderFlow,
        isSidebarCollapsed,
        toggleSidebar,
        isMobileMenuOpen,
        setMobileMenuOpen: setIsMobileMenuOpen,
        toggleMobileMenu,
        theme,
        setTheme,
        toggleTheme,
        shopSettings,
        updateShopSettings,
        shortcutHelpOpen,
        setShortcutHelpOpen,
        notificationToast,
        showToast,
        employees,
        attendanceRecords,
        addEmployee,
        updateEmployee,
        setEmployeeStatus,
        upsertAttendance,
        removeAttendance,
        products,
        stockMovements,
        createProduct,
        updateProduct,
        setProductActive,
        recordStockMovement,
        expenses,
        expenseCategories,
        addExpense,
        updateExpense,
        cancelExpense,
        addExpenseCategory,
        renameExpenseCategory,
        setExpenseCategoryActive,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
