import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Customer, LaundryOrder, OrderLine, ClothingItem, CashRegisterData, OrderStatus, ServiceCategory, PickupOption,
  Employee, EmployeeStatus, EmployeeFormData, AttendanceRecord,
  InventoryProduct, ProductFormData, StockMovement, StockMovementInput,
  Expense, ExpenseFormData, ExpenseCategory, ActionResult,
} from '../types';
import {
  INITIAL_CUSTOMERS, INITIAL_ORDERS, INITIAL_CASH_REGISTER,
  INITIAL_EMPLOYEES, INITIAL_ATTENDANCE, INITIAL_PRODUCTS, INITIAL_STOCK_MOVEMENTS,
  INITIAL_EXPENSES, INITIAL_EXPENSE_CATEGORIES,
} from '../data/demoData';
import { fireOrderCelebration } from '../registry/magicui/confetti';
import { calculateOrderTotals, calculateLineSubtotal } from '../lib/pricing';
import { formatPromised, getPromisedDate, nowDateTime, nowISODateTime } from '../lib/dates';
import { computeMovement } from '../lib/inventory';
import { normalizeText } from '../lib/utils';

/** Clé localStorage du compteur séquentiel de tickets (voir plus bas). */
import { AppTheme, applyTheme, getInitialTheme, persistTheme } from '../lib/theme';

const TICKET_COUNTER_KEY = 'pressingpro_next_ticket_number';

/** Extrait le numéro d'un libellé de ticket ("#TK-2854" → 2854), 0 si illisible. */
const parseTicketNumber = (ticketNumber: string): number => {
  const match = ticketNumber.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : 0;
};

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

/** Chargement localStorage avec repli sur les données initiales (même convention que commandes/clients/caisse). */
function loadPersistedState<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as T;
  } catch (e) {
    console.warn('LocalStorage load error', e);
  }
  return fallback;
}

function persistState(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('LocalStorage save error', e);
  }
}

const genId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

interface AppContextType {
  activeScreen: ScreenId;
  setActiveScreen: (screen: ScreenId) => void;
  orders: LaundryOrder[];
  customers: Customer[];
  cashRegister: CashRegisterData;
  activeHandoverOrder: LaundryOrder | null;
  setActiveHandoverOrder: (order: LaundryOrder | null) => void;
  selectedCustomer: Customer;
  setSelectedCustomer: (customer: Customer) => void;
  cartLines: OrderLine[];
  addCartItem: (item: ClothingItem, serviceType?: string, quantity?: number, weightKg?: number) => void;
  removeCartItem: (lineId: string) => void;
  updateCartItemQty: (lineId: string, delta: number) => void;
  /** Couleur appliquée aux pièces ajoutées au panier (undefined = non précisée). */
  selectedGarmentColor: string | undefined;
  setSelectedGarmentColor: (color: string | undefined) => void;
  updateCartLineColor: (lineId: string, color: string | undefined) => void;
  clearCart: () => void;
  pickupOption: PickupOption;
  setPickupOption: (opt: PickupOption) => void;
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
  addNewCustomer: (cust: Omit<Customer, 'id' | 'depositsCount' | 'balance'>) => Customer;
  notifyAllSms: () => void;
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

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  // LocalStorage-backed state for offline persistence & zero data loss on refresh
  const [orders, setOrders] = useState<LaundryOrder[]>(() => {
    try {
      const saved = localStorage.getItem('pressingpro_orders');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('LocalStorage load error', e);
    }
    return INITIAL_ORDERS;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const saved = localStorage.getItem('pressingpro_customers');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('LocalStorage load error', e);
    }
    return INITIAL_CUSTOMERS;
  });

  const [cashRegister, setCashRegister] = useState<CashRegisterData>(() => {
    try {
      const saved = localStorage.getItem('pressingpro_cash_register');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('LocalStorage load error', e);
    }
    return INITIAL_CASH_REGISTER;
  });

  // Save to localStorage whenever state updates
  useEffect(() => {
    try {
      localStorage.setItem('pressingpro_orders', JSON.stringify(orders));
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem('pressingpro_customers', JSON.stringify(customers));
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
  }, [customers]);

  useEffect(() => {
    try {
      localStorage.setItem('pressingpro_cash_register', JSON.stringify(cashRegister));
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
  }, [cashRegister]);

  // Compteur séquentiel de tickets, persisté dans localStorage.
  // Remplace l'ancienne formule fragile basée sur orders.length (qui
  // réattribuait des numéros dès qu'une commande disparaissait de la liste).
  // Initialisation : valeur sauvegardée si elle existe, sinon max des
  // tickets existants + 1 (migration transparente des anciennes données).
  const [nextTicketNumber, setNextTicketNumber] = useState<number>(() => {
    const fallback =
      orders.reduce((max, o) => Math.max(max, parseTicketNumber(o.ticketNumber)), 0) + 1;
    try {
      const saved = parseInt(localStorage.getItem(TICKET_COUNTER_KEY) || '', 10);
      if (!isNaN(saved)) return Math.max(saved, fallback);
    } catch (e) {
      console.warn('LocalStorage load error', e);
    }
    return fallback;
  });

  useEffect(() => {
    try {
      localStorage.setItem(TICKET_COUNTER_KEY, String(nextTicketNumber));
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
  }, [nextTicketNumber]);

  // --- États des modules Personnel / Stocks / Dépenses ---
  // Même modèle de persistance que le reste de l'application : localStorage
  // du navigateur uniquement, données de démonstration au premier lancement.
  const [employees, setEmployees] = useState<Employee[]>(() =>
    loadPersistedState('pressingpro_employees', INITIAL_EMPLOYEES)
  );
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() =>
    loadPersistedState('pressingpro_attendance', INITIAL_ATTENDANCE)
  );
  const [products, setProducts] = useState<InventoryProduct[]>(() =>
    loadPersistedState('pressingpro_inventory_products', INITIAL_PRODUCTS)
  );
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() =>
    loadPersistedState('pressingpro_stock_movements', INITIAL_STOCK_MOVEMENTS)
  );
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    loadPersistedState('pressingpro_expenses', INITIAL_EXPENSES)
  );
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(() =>
    loadPersistedState('pressingpro_expense_categories', INITIAL_EXPENSE_CATEGORIES)
  );

  useEffect(() => persistState('pressingpro_employees', employees), [employees]);
  useEffect(() => persistState('pressingpro_attendance', attendanceRecords), [attendanceRecords]);
  useEffect(() => persistState('pressingpro_inventory_products', products), [products]);
  useEffect(() => persistState('pressingpro_stock_movements', stockMovements), [stockMovements]);
  useEffect(() => persistState('pressingpro_expenses', expenses), [expenses]);
  useEffect(() => persistState('pressingpro_expense_categories', expenseCategories), [expenseCategories]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(customers[0] || INITIAL_CUSTOMERS[0]);
  const [pickupOption, setPickupOption] = useState<PickupOption>('standard');
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

  // Active handover in workshop
  const [activeHandoverOrder, setActiveHandoverOrder] = useState<LaundryOrder | null>(() => {
    return INITIAL_ORDERS.find((o) => o.id === 'ord-2852') || null;
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
    clearCart();
  };

  const addCartItem = (
    item: ClothingItem,
    serviceType = selectedServiceFilter,
    quantity = 1,
    weightKg?: number
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
                subtotal: newSubtotal,
              }
            : line
        );
      }
      return [
        ...prev,
        {
          id: `cl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          clothingItemId: item.id,
          name: item.name,
          quantity: actualQty,
          pricingType: item.pricingType,
          weightKg: isKilo ? actualQty : undefined,
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

    const { subtotal, expressFee, discountAmount: discount, total, deposit, remaining } =
      calculateOrderTotals(cartLines, {
        pickupOption,
        loyaltyDiscountPercent: selectedCustomer.loyaltyDiscountPercent,
        depositAmount,
      });

    const nextTicketNum = `#TK-${nextTicketNumber}`;
    const promised = formatPromised(getPromisedDate(pickupOption));

    const newOrder: LaundryOrder = {
      id: `ord-${Date.now()}`,
      ticketNumber: nextTicketNum,
      serviceCategory: selectedServiceCategory || 'pressing',
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone,
      customerAddress: selectedCustomer.address,
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
      smsSent: true,
    };

    setOrders((prev) => [newOrder, ...prev]);
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
        c.id === selectedCustomer.id
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
    showToast(`✓ Commande ${newOrder.ticketNumber} enregistrée avec succès! 🎉`);
    return newOrder;
  };

  const moveOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    const now = nowDateTime();
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            status: newStatus,
            readyAt: newStatus === 'ready' ? now : ord.readyAt,
            deliveredAt: newStatus === 'delivered' ? now : ord.deliveredAt,
          };
        }
        return ord;
      })
    );
    showToast(`Statut mis à jour`);
  };

  const settleAndDeliverOrder = (orderId: string, method: 'especes' | 'wave' | 'momo' | 'om') => {
    // Lecture de la commande AVANT toute mise à jour d'état : les updaters
    // React doivent rester des fonctions pures. L'ancienne version appelait
    // setCashRegister à l'intérieur de l'updater de setOrders, ce qui pouvait
    // créditer la caisse deux fois (ex. double invocation en mode Strict).
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
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

    showToast(`✓ Commande remise au client et solde encaissé via ${method.toUpperCase()}!`);
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

  const notifyAllSms = () => {
    const readyCount = orders.filter((o) => o.status === 'ready').length;
    setOrders((prev) =>
      prev.map((o) => (o.status === 'ready' ? { ...o, smsSent: true } : o))
    );
    showToast(
      readyCount > 0
        ? `📲 ${readyCount} SMS de notification envoyés aux clients de commandes prêtes !`
        : 'Aucune commande prête à notifier pour le moment.'
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
        addNewCustomer,
        notifyAllSms,
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
