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

/* ============================================================================
 * Modules Personnel, Stocks, Dépenses (frontend uniquement)
 * - Dates "métier" stockées en ISO YYYY-MM-DD pour des calculs fiables,
 *   puis formatées en français à l'affichage (voir src/lib/dates.ts).
 * - Montants numériques en FCFA, jamais de chaînes formatées dans les calculs.
 * ========================================================================== */

// ---------- Personnel ----------

export type EmployeeStatus = 'active' | 'inactive' | 'leave';

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'late' | 'unrecorded';

export interface Employee {
  id: string;
  fullName: string;
  phone?: string;
  position: string;
  status: EmployeeStatus;
  hiredAt?: string; // ISO YYYY-MM-DD
  notes?: string;
  createdAt?: string; // ISO datetime
  updatedAt?: string; // ISO datetime
}

/** Une présence est unique par couple (employé, date). 'unrecorded' = absence d'enregistrement. */
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // ISO YYYY-MM-DD
  status: Exclude<AttendanceStatus, 'unrecorded'>;
  arrivalTime?: string; // "08:05"
  reason?: string;
  notes?: string;
}

/** Postes proposés dans le formulaire employé (liste fermée, extensible ici). */
export const EMPLOYEE_POSITIONS = [
  'Réception',
  'Lavage',
  'Repassage',
  'Finition',
  'Livraison',
  'Responsable / Gestion',
  'Autre',
] as const;

// ---------- Stocks ----------

export type StockMovementType = 'in' | 'out' | 'adjustment';

export type StockStatus = 'normal' | 'low' | 'out';

export interface InventoryProduct {
  id: string;
  name: string;
  reference: string;
  category: string;
  unit: string;
  currentQuantity: number;
  alertThreshold: number;
  unitCostXof?: number; // Dernier coût d'achat connu ; absent = inconnu (pas zéro)
  supplier?: string;
  description?: string;
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  /** Quantité saisie : variation pour entrée/sortie, quantité cible pour un ajustement. */
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  date: string; // ISO YYYY-MM-DD
  reason: string;
  unitCostXof?: number;
  note?: string;
}

/** Catégories de produits proposées au départ (saisie libre possible via le champ). */
export const PRODUCT_CATEGORIES = [
  'Détergents et lessives',
  'Détachants et solvants',
  'Assouplissants et finition',
  'Cintres',
  'Housses et emballages',
  'Fournitures diverses',
] as const;

/** Unités de mesure proposées (saisie libre possible). Ne jamais additionner des unités différentes. */
export const PRODUCT_UNITS = ['L', 'kg', 'unité', 'paquet', 'bidon', 'carton', 'bouteille'] as const;

// ---------- Dépenses ----------

export type ExpensePaymentMethod =
  | 'cash'
  | 'wave'
  | 'orange_money'
  | 'mtn_momo'
  | 'transfer'
  | 'other';

export const EXPENSE_PAYMENT_LABELS: Record<ExpensePaymentMethod, string> = {
  cash: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  transfer: 'Virement',
  other: 'Autre',
};

export interface ExpenseCategory {
  id: string;
  label: string;
  isActive: boolean;
}

export interface Expense {
  id: string;
  label: string;
  categoryId: string;
  amountXof: number;
  date: string; // ISO YYYY-MM-DD
  paymentMethod: ExpensePaymentMethod;
  supplier?: string;
  reference?: string;
  description?: string;
  status: 'recorded' | 'cancelled';
  cancellationReason?: string;
  createdAt?: string; // ISO datetime
  updatedAt?: string; // ISO datetime
}

// ---------- Saisies des formulaires des nouveaux modules ----------

export type EmployeeFormData = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;

export type ProductFormData = Omit<InventoryProduct, 'id' | 'currentQuantity'>;

export interface StockMovementInput {
  productId: string;
  type: StockMovementType;
  quantity: number;
  date: string; // ISO YYYY-MM-DD
  reason: string;
  unitCostXof?: number;
  note?: string;
}

export type ExpenseFormData = Omit<
  Expense,
  'id' | 'status' | 'cancellationReason' | 'createdAt' | 'updatedAt'
>;

/** Résultat d'une action pouvant échouer pour une règle métier (doublon, stock…). */
export type ActionResult = { ok: true } | { ok: false; error: string };
