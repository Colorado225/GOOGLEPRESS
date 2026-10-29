import React, { createContext, useContext } from 'react';
import type { AppContextType } from './store/types';
import { useWorkspaceData } from './store/workspace';
import { useToast } from './store/toast';
import { useTheme } from './store/theme';
import { useNavigation } from './store/navigation';
import { useSubscriptionStore } from './store/subscription';
import { useShopSettingsStore } from './store/shopSettings';
import { useEmployeesStore } from './store/employees';
import { useInventoryStore } from './store/inventory';
import { useExpensesStore } from './store/expenses';
import { useCustomersStore } from './store/customers';
import { useOrdersStore } from './store/orders';
import { useLogisticsStore } from './store/logistics';
import { useStorageStore } from './store/storage';
import { usePosDraft } from './store/posDraft';
import { useCartStore } from './store/cart';
import { useModals } from './store/modals';
import { createCartActions } from './store/cartActions';
import { createCustomerActions } from './store/customerActions';
import { createOrderActions } from './store/orderActions';
import { createStorageActions } from './store/storageActions';
import { createLogisticsActions } from './store/logisticsActions';
import { createOrderFlowActions } from './store/orderFlow';
import { useKeyboardShortcuts } from './store/keyboardShortcuts';

// Types publics conservés à l'identique : les écrans continuent d'importer
// depuis ce module, qui n'est plus qu'une façade d'assemblage.
export type {
  ScreenId,
  SettingsTab,
  StoragePanelView,
  SubscriptionSource,
  WorkshopTab,
} from './store/types';

const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * Magasin applicatif de l'ERP.
 *
 * Ce composant ne contient plus aucune logique métier : il appelle les
 * modules de `src/context/store/` dans l'ordre de leurs dépendances, puis
 * assemble leurs retours en un contrat `AppContextType` unique, vérifié par
 * TypeScript (annotation explicite de `value`).
 *
 * Ordre d'assemblage :
 * 1. fondations (portée, notification, thème, navigation) ;
 * 2. modules synchronisés ou plafonnés (abonnement, paramètres boutique) ;
 * 3. modules autonomes (personnel, stocks, dépenses) ;
 * 4. états du cœur couplé (clients, commandes, logistique, rangement,
 *    brouillon POS, panier, fenêtres) ;
 * 5. fabriques d'actions du cœur, qui reçoivent leurs dépendances
 *    inter-domaines en paramètres explicites ;
 * 6. raccourcis clavier globaux.
 */
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- 1. Fondations ------------------------------------------------------
  const { workspace, liveWorkspace, storageKey, seedList } = useWorkspaceData();
  const { notificationToast, showToast } = useToast();
  const notify = showToast;
  const { theme, setTheme, toggleTheme } = useTheme();
  const {
    activeScreen,
    setActiveScreen,
    isSidebarCollapsed,
    toggleSidebar,
    isMobileMenuOpen,
    setMobileMenuOpen,
    toggleMobileMenu,
    workshopTabRequest,
    requestWorkshopTab,
    clearWorkshopTabRequest,
    activeWorkshopTab,
    setActiveWorkshopTab,
    settingsTabRequest,
    requestSettingsTab,
    clearSettingsTabRequest,
  } = useNavigation({ notify });

  // --- 2. Abonnement et paramètres boutique --------------------------------
  const {
    subscription,
    subscriptionSource,
    effectivePlanId,
    refreshSubscription,
    chooseSubscriptionPlan,
  } = useSubscriptionStore(workspace);
  const { shopSettings, updateShopSettings, settingsSync, retryShopSettingsSync } =
    useShopSettingsStore({ workspace, liveWorkspace, storageKey });

  // --- 3. Modules autonomes -------------------------------------------------
  const {
    employees,
    attendanceRecords,
    addEmployee,
    updateEmployee,
    setEmployeeStatus,
    upsertAttendance,
    removeAttendance,
  } = useEmployeesStore({ storageKey, seedList, effectivePlanId, notify });
  const {
    products,
    stockMovements,
    createProduct,
    updateProduct,
    setProductActive,
    recordStockMovement,
  } = useInventoryStore({ storageKey, seedList, notify });
  const {
    expenses,
    expenseCategories,
    addExpense,
    updateExpense,
    cancelExpense,
    addExpenseCategory,
    renameExpenseCategory,
    setExpenseCategoryActive,
  } = useExpensesStore({ storageKey, seedList, notify });

  // --- 4. États du cœur couplé ----------------------------------------------
  const { customers, setCustomers } = useCustomersStore({ storageKey, seedList });
  const {
    orders,
    setOrders,
    nextTicketNumber,
    setNextTicketNumber,
    cashRegister,
    setCashRegister,
  } = useOrdersStore({ storageKey, seedList, liveWorkspace });
  const { logisticsTasks, setLogisticsTasks, courierPositions, setCourierPositions } =
    useLogisticsStore({ storageKey, liveWorkspace });
  const {
    storageLocations,
    setStorageLocations,
    storageSync,
    retryStorageSync,
    focusedStorageOrderId,
    setFocusedStorageOrderId,
    storagePanelViewRequest,
    setStoragePanelViewRequest,
  } = useStorageStore({ workspace, liveWorkspace, storageKey });
  const {
    selectedCustomer,
    setSelectedCustomer,
    pickupOption,
    setPickupOption,
    promisedDateISO,
    setPromisedDateISO,
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
    setPendingPickupTaskId,
    focusedLogisticsTaskId,
    setFocusedLogisticsTaskId,
    orderNotes,
    setOrderNotes,
    depositAmount,
    setDepositAmount,
    paymentMethod,
    setPaymentMethod,
    selectedServiceFilter,
    setSelectedServiceFilter,
    selectedServiceCategory,
    setSelectedServiceCategory,
    orderStep,
    setOrderStep,
    resetLogisticsDraft,
    setDeliveryScheduleManual,
    setDeliveryDateISOState,
    setDeliveryTimeSlotState,
  } = usePosDraft({ customers, logisticsTasks });
  const { cartLines, setCartLines, selectedGarmentColor, setSelectedGarmentColor } =
    useCartStore();
  const {
    previewTicket,
    setPreviewTicket,
    closingZModalOpen,
    setClosingZModalOpen,
    newCustomerModalOpen,
    setNewCustomerModalOpen,
    smsModalData,
    setSmsModalData,
    activeHandoverOrder,
    setActiveHandoverOrder,
    shortcutHelpOpen,
    setShortcutHelpOpen,
  } = useModals({ orders });

  // --- 5. Fabriques d'actions du cœur ---------------------------------------
  const { addCartItem, removeCartItem, updateCartItemQty, updateCartLineColor, clearCart } =
    createCartActions({
      selectedServiceFilter,
      selectedGarmentColor,
      setCartLines,
      setDepositAmount,
      notify,
    });
  const { addNewCustomer, markReadyOrdersAsNotifiedLocally } = createCustomerActions({
    orders,
    setOrders,
    setCustomers,
    setSelectedCustomer,
    setNewCustomerModalOpen,
    notify,
  });
  const { submitNewOrder, moveOrderStatus, settleAndDeliverOrder } = createOrderActions({
    orders,
    setOrders,
    cartLines,
    selectedCustomer,
    pickupOption,
    promisedDateISO,
    orderFulfillmentMethod,
    deliveryAddress,
    deliveryAddressDetails,
    deliveryDateISO,
    deliveryTimeSlot,
    pendingPickupTask,
    pendingPickupTaskId,
    nextTicketNumber,
    setNextTicketNumber,
    setLogisticsTasks,
    setCashRegister,
    setCustomers,
    setPreviewTicket,
    paymentMethod,
    depositAmount,
    orderNotes,
    selectedServiceCategory,
    effectivePlanId,
    shopSettings,
    logisticsTasks,
    activeHandoverOrder,
    setActiveHandoverOrder,
    clearCart,
    resetLogisticsDraft,
    notify,
  });
  const {
    createStorageLocation,
    createStorageLocationSeries,
    updateStorageLocation,
    deleteStorageLocation,
    setStorageLocationActive,
    markOrderReadyAndStore,
    assignOrderStorage,
    clearOrderStorage,
    focusStorageOrder,
    clearStoragePanelViewRequest,
    openStorageLocationsConfig,
  } = createStorageActions({
    storageLocations,
    setStorageLocations,
    orders,
    setOrders,
    logisticsTasks,
    shopSettings,
    effectivePlanId,
    setFocusedStorageOrderId,
    setStoragePanelViewRequest,
    requestWorkshopTab,
    notify,
  });
  const {
    createPickupTask,
    updateLogisticsTask,
    assignLogisticsTask,
    startLogisticsTask,
    completePickupTask,
    completeDeliveryTask,
    markLogisticsTaskArrived,
    setLogisticsTaskDestination,
    recordCourierPosition,
    failLogisticsTask,
    cancelLogisticsTask,
    startOrderFromPickupTask,
    cancelPendingPickupConversion,
    focusLogisticsTask,
  } = createLogisticsActions({
    logisticsTasks,
    setLogisticsTasks,
    orders,
    setOrders,
    customers,
    setCustomers,
    employees,
    setCourierPositions,
    setCashRegister,
    shopSettings,
    activeHandoverOrder,
    setActiveHandoverOrder,
    selectedCustomer,
    pickupOption,
    promisedDateISO,
    pendingPickupTaskId,
    setCartLines,
    setDepositAmount,
    setSelectedCustomer,
    setOrderNotes,
    setOrderFulfillmentMethod,
    setDeliveryAddress,
    setDeliveryAddressDetails,
    setDeliveryScheduleManual,
    setDeliveryDateISOState,
    setDeliveryTimeSlotState,
    setPendingPickupTaskId,
    setSelectedServiceCategory,
    setOrderStep,
    setActiveScreen,
    setFocusedLogisticsTaskId,
    notify,
  });
  const { resetNewOrderFlow } = createOrderFlowActions({
    setSelectedServiceCategory,
    setOrderStep,
    resetLogisticsDraft,
    clearCart,
  });

  // --- 6. Raccourcis clavier globaux -----------------------------------------
  useKeyboardShortcuts({
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
  });

  // Annotation explicite : toute section du contrat oubliée ou mal typée
  // est refusée à la compilation.
  const value: AppContextType = {
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
    promisedDateISO,
    setPromisedDateISO,
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
    markLogisticsTaskArrived,
    setLogisticsTaskDestination,
    courierPositions,
    recordCourierPosition,
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
    setMobileMenuOpen,
    toggleMobileMenu,
    theme,
    setTheme,
    toggleTheme,
    shopSettings,
    updateShopSettings,
    settingsSync,
    retryShopSettingsSync,
    storageSync,
    retryStorageSync,
    subscription,
    subscriptionSource,
    effectivePlanId,
    chooseSubscriptionPlan,
    refreshSubscription,
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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
