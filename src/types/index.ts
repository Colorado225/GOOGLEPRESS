export type OrderStatus = 'received' | 'washing' | 'ironing' | 'ready' | 'delivered';

export type ServiceCategory = 'pressing' | 'blanchisserie';

export type ServiceType = 'wash_iron' | 'dry_clean' | 'iron_only' | 'dye' | 'express_24h' | 'kilo_wash' | 'retouch';

export type PricingType = 'unit' | 'kilo';

/** Délai de retrait choisi au comptoir (règles dans src/lib/dates.ts). */
export type PickupOption = 'standard' | 'express' | 'delayed';

export interface ClothingItem {
  id: string;
  name: string;
  category: 'all' | 'men' | 'women' | 'home' | 'pro';
  serviceCategory: 'pressing' | 'blanchisserie' | 'both';
  unitPrice: number;
  pricingType: PricingType;
  unitLabel?: string; // 'pièce', 'kg', 'panneau'
  emoji: string;
  description?: string;
}

export interface OrderLine {
  id: string;
  clothingItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  pricingType?: PricingType;
  weightKg?: number;
  unitLabel?: string;
  subtotal: number;
  serviceType: string;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  depositsCount: number;
  balance: number;
  loyaltyDiscountPercent: number;
  isVip?: boolean;
}

export interface LaundryOrder {
  id: string;
  ticketNumber: string; // e.g., "#TK-2854"
  serviceCategory?: ServiceCategory;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  lines: OrderLine[];
  subtotal: number;
  serviceFees: number;
  discount: number;
  total: number;
  depositPaid: number;
  remainingBalance: number;
  paymentMethod: 'especes' | 'wave' | 'momo' | 'om';
  status: OrderStatus;
  receivedAt: string;
  promisedAt: string;
  readyAt?: string;
  deliveredAt?: string;
  notes?: string;
  isLate?: boolean;
  isUrgent?: boolean;
  rackLocation?: string; // e.g., "Étagère B-04"
  machineAssigned?: string; // e.g. "L1 • 40 min"
  assignee?: string; // e.g. "Grâce"
  progressPercent?: number; // for washing machines, e.g. 65%
  smsSent?: boolean;
}

export interface CashRegisterData {
  date: string;
  cashAmount: number;
  waveAmount: number;
  momoAmount: number;
  totalAmount: number;
  floatAmount: number; // Fond de caisse
  targetGoal: number; // Objectif du mois
  monthAchieved: number;
}
