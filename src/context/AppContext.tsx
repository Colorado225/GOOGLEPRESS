import React, { createContext, useContext, useState, useEffect } from 'react';
import { Customer, LaundryOrder, OrderLine, ClothingItem, CashRegisterData, OrderStatus, ServiceCategory } from '../types';
import { INITIAL_CUSTOMERS, INITIAL_ORDERS, INITIAL_CASH_REGISTER } from '../data/demoData';
import { fireOrderCelebration } from '../registry/magicui/confetti';

export type ScreenId = 'dashboard' | 'pos' | 'workshop' | 'orders' | 'clients' | 'settings';

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
  clearCart: () => void;
  pickupOption: 'standard' | 'express' | 'delayed';
  setPickupOption: (opt: 'standard' | 'express' | 'delayed') => void;
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
  shortcutHelpOpen: boolean;
  setShortcutHelpOpen: (open: boolean) => void;
  notificationToast: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
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

  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(customers[0] || INITIAL_CUSTOMERS[0]);
  const [pickupOption, setPickupOption] = useState<'standard' | 'express' | 'delayed'>('standard');
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

  // Default pre-populated cart to replicate Mockup 2 (#TK-2855):
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
      notes: 'Blanc, bleu, rayée',
    },
    {
      id: 'cl-2',
      clothingItemId: 'c3',
      name: 'Boubou bazin',
      quantity: 1,
      unitPrice: 4500,
      subtotal: 4500,
      serviceType: 'Lavage délicat',
      notes: 'Brodé or • détachage inclus',
    },
  ]);

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
      const existing = prev.find((line) => line.clothingItemId === item.id && line.serviceType === serviceType);
      const isKilo = item.pricingType === 'kilo';
      const actualQty = isKilo ? (weightKg || 1) : quantity;
      const calcSubtotal = isKilo
        ? Math.round(item.unitPrice * actualQty)
        : actualQty * item.unitPrice;

      if (existing) {
        const newQty = existing.quantity + actualQty;
        const newSubtotal = isKilo
          ? Math.round(item.unitPrice * newQty)
          : newQty * item.unitPrice;

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
                  subtotal: Math.round(newQty * line.unitPrice),
                }
              : null;
          }
          return line;
        })
        .filter(Boolean) as OrderLine[]
    );
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

    const subtotal = cartLines.reduce((acc, curr) => acc + curr.subtotal, 0);
    const expressFee = pickupOption === 'express' ? Math.round(subtotal * 0.5) : 0;
    const discountRate = (selectedCustomer.loyaltyDiscountPercent || 0) / 100;
    const discount = Math.round(subtotal * discountRate);
    const total = subtotal + expressFee - discount;
    const deposit = Math.min(depositAmount, total);
    const remaining = total - deposit;

    const nextTicketNum = `#TK-${2855 + orders.length - 10}`;
    const promised =
      pickupOption === 'express'
        ? 'Demain • 12h'
        : pickupOption === 'delayed'
        ? 'Sam 31 oct • 10h'
        : 'Mer 28 oct • 17h';

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
      receivedAt: '27/10/2026 10:15',
      promisedAt: promised,
      notes: orderNotes,
      smsSent: true,
    };

    setOrders((prev) => [newOrder, ...prev]);

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
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            status: newStatus,
            readyAt: newStatus === 'ready' ? '27/10/2026 11:30' : ord.readyAt,
            deliveredAt: newStatus === 'delivered' ? '27/10/2026 12:00' : ord.deliveredAt,
          };
        }
        return ord;
      })
    );
    showToast(`Statut mis à jour`);
  };

  const settleAndDeliverOrder = (orderId: string, method: 'especes' | 'wave' | 'momo' | 'om') => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          const balance = ord.remainingBalance;
          if (balance > 0) {
            setCashRegister((reg) => ({
              ...reg,
              cashAmount: reg.cashAmount + (method === 'especes' ? balance : 0),
              waveAmount: reg.waveAmount + (method === 'wave' ? balance : 0),
              momoAmount: reg.momoAmount + (method === 'momo' || method === 'om' ? balance : 0),
              totalAmount: reg.totalAmount + balance,
            }));
          }
          return {
            ...ord,
            depositPaid: ord.total,
            remainingBalance: 0,
            status: 'delivered',
            deliveredAt: '27/10/2026 11:45',
          };
        }
        return ord;
      })
    );
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
    setOrders((prev) =>
      prev.map((o) => (o.status === 'ready' ? { ...o, smsSent: true } : o))
    );
    showToast('📲 11 SMS de notification envoyés aux clients de commandes prêtes !');
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      showToast(next ? 'Barre latérale repliée (Alt+S)' : 'Barre latérale déployée (Alt+S)');
      return next;
    });
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
      if (e.altKey && (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        toggleSidebar();
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
        clearCart,
        pickupOption,
        setPickupOption,
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
        shortcutHelpOpen,
        setShortcutHelpOpen,
        notificationToast,
        showToast,
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
