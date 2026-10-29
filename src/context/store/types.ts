import type {
  ActionResult,
  AttendanceRecord,
  CartLineDetails,
  CashRegisterData,
  ClothingItem,
  Customer,
  Employee,
  EmployeeFormData,
  EmployeeStatus,
  Expense,
  ExpenseCategory,
  ExpenseFormData,
  FulfillmentMethod,
  GeoPoint,
  InventoryProduct,
  LaundryOrder,
  LogisticsIssueReason,
  LogisticsTask,
  LogisticsTaskScheduleFormData,
  LogisticsTimeSlot,
  OrderLine,
  OrderStatus,
  PaymentMethod,
  PickupOption,
  PickupTaskFormData,
  ProductFormData,
  ServiceCategory,
  ShopSettings,
  StockMovement,
  StockMovementInput,
  StorageAssignmentInput,
  StorageLocation,
  StorageLocationFormData,
  StorageLocationSeriesInput,
} from '../../types';
import type { WorkspaceScope } from '../../lib/workspaceScope';
import type { CourierPositions } from '../../lib/courierPositions';
import type { DeliveryProofDraft } from '../../lib/deliveryProof';
import type { ShopSettingsSyncState } from '../../lib/shopSettingsSync';
import type { StorageSyncState } from '../../lib/storageLocationsSync';
import type {
  SubscriptionPlanId,
  SubscriptionState,
} from '../../lib/subscription';
import type { AppTheme } from '../../lib/theme';

/** Écrans de l'ERP, dans l'ordre du workflow d'un pressing. */
export type ScreenId =
  | 'dashboard'
  | 'pos'
  | 'workshop'
  | 'courier'
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
  | 'backup'
  | 'subscription';

/**
 * Provenance de l'abonnement affiché.
 *
 * - `local` : démonstration locale, aucun serveur ;
 * - `chargement` : lecture de la base en cours ;
 * - `serveur` : formule et essai lus dans la base ;
 * - `indisponible` : la base n'a pas répondu, aucune formule payante n'est
 *   ouverte (on ne peut pas vérifier le droit).
 */
export type SubscriptionSource = 'local' | 'chargement' | 'serveur' | 'indisponible';

/** Fonction de notification utilisée par toutes les actions du magasin. */
export type NotifyFn = (msg: string) => void;

/**
 * Contrat public du magasin applicatif.
 *
 * Chaque section est produite par un module de `src/context/store/` et
 * assemblée par `AppProvider` ; les écrans ne voient que cette interface,
 * via `useApp()`.
 */
export interface AppContextType {
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
  completeDeliveryTask: (
    taskId: string,
    paymentMethod: PaymentMethod,
    proof?: DeliveryProofDraft | null
  ) => ActionResult;
  /** Jalon « arrivé chez le client », entre le départ et la confirmation. */
  markLogisticsTaskArrived: (taskId: string) => ActionResult;
  /** Point de livraison choisi sur la carte (null = point retiré). */
  setLogisticsTaskDestination: (taskId: string, point: GeoPoint | null) => ActionResult;
  /** Dernière position connue par tournée (jamais inventée). */
  courierPositions: CourierPositions;
  recordCourierPosition: (taskId: string, point: GeoPoint) => ActionResult;
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
  /** État d'enregistrement des paramètres dans la base (compte réel). */
  settingsSync: ShopSettingsSyncState;
  retryShopSettingsSync: () => void;
  /** État d'enregistrement des emplacements de rangement. */
  storageSync: StorageSyncState;
  retryStorageSync: () => void;
  /**
   * Abonnement de l'agence. En espace réel, la formule et la date d'essai
   * viennent de la base (`shop_subscriptions`) ; en démonstration, elles
   * restent locales.
   */
  subscription: SubscriptionState;
  /** Provenance de l'état affiché, pour rester honnête à l'écran. */
  subscriptionSource: SubscriptionSource;
  /** Formule réellement appliquée (essai de 14 jours inclus). */
  effectivePlanId: SubscriptionPlanId;
  /** Dépose une demande de formule (le propriétaire seul y a droit). */
  chooseSubscriptionPlan: (planId: SubscriptionPlanId) => Promise<ActionResult>;
  /** Relit l'abonnement dans la base (après une demande, par exemple). */
  refreshSubscription: () => Promise<ActionResult>;
  shortcutHelpOpen: boolean;
  setShortcutHelpOpen: (open: boolean) => void;
  notificationToast: string | null;
  showToast: (msg: string) => void;
  // --- Module Personnel ---
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  addEmployee: (data: EmployeeFormData) => ActionResult & { employee?: Employee };
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
