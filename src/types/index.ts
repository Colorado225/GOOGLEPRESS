export type OrderStatus = 'received' | 'washing' | 'ironing' | 'ready' | 'delivered';

export type ServiceCategory = 'pressing' | 'blanchisserie';

export type ServiceType = 'wash_iron' | 'dry_clean' | 'iron_only' | 'dye' | 'express_24h' | 'kilo_wash' | 'retouch';

export type PricingType = 'unit' | 'kilo';

/** Délai de retrait choisi au comptoir (règles dans src/lib/dates.ts). */
export type PickupOption = 'standard' | 'express' | 'delayed';

/** Moyens d'encaissement acceptés au comptoir et lors d'une livraison. */
export type PaymentMethod = 'especes' | 'wave' | 'momo' | 'om';

/* -------------------------------------------------------------------------- */
/* Ramassage & livraison à domicile                                           */
/* -------------------------------------------------------------------------- */

/** Provenance physique du linge : déposé au comptoir ou collecté chez le client. */
export type OrderOrigin = 'counter' | 'home_pickup';

/** Mode de restitution choisi pour la commande. */
export type FulfillmentMethod = 'counter_pickup' | 'home_delivery';

export type LogisticsTaskKind = 'pickup' | 'delivery';

export type LogisticsTaskStatus = 'scheduled' | 'en_route' | 'completed' | 'failed' | 'cancelled';

/** Créneaux de tournée de deux heures (libellés dans src/lib/logistics.ts). */
export type LogisticsTimeSlot =
  | '08:00-10:00'
  | '10:00-12:00'
  | '14:00-16:00'
  | '16:00-18:00'
  | '18:00-20:00';

export type LogisticsIssueReason =
  | 'customer_absent'
  | 'customer_unreachable'
  | 'address_issue'
  | 'payment_unavailable'
  | 'customer_request'
  | 'other';

/**
 * Une course de ramassage ou de livraison. Les coordonnées client, l'adresse
 * et le frais sont des instantanés pris à la réservation : modifier ensuite
 * la fiche client ou les paramètres tarifaires ne réécrit pas une tournée
 * déjà promise. Une livraison est toujours rattachée à une commande ; un
 * ramassage ne l'est qu'après comptage et conversion au POS.
 */
export interface LogisticsTask {
  id: string;
  kind: LogisticsTaskKind;
  status: LogisticsTaskStatus;
  customerId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  addressDetails?: string;
  scheduledDate: string; // ISO YYYY-MM-DD
  timeSlot: LogisticsTimeSlot;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  orderId?: string;
  orderTicketNumber?: string;
  /** Frais de ramassage ou de livraison annoncé au client (FCFA). */
  fee: number;
  estimatedBags?: number;
  collectedBags?: number;
  instructions?: string;
  issueReason?: LogisticsIssueReason;
  issueNotes?: string;
  startedAt?: string; // ISO datetime
  completedAt?: string; // ISO datetime
  /** Solde réellement encaissé par le coursier lors d'une livraison. */
  collectedAmount?: number;
  collectedPaymentMethod?: PaymentMethod;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

/** Saisie du formulaire de réservation d'un ramassage (client existant ou nouveau). */
export interface PickupTaskFormData {
  customerMode: 'existing' | 'new';
  customerId?: string;
  newCustomerName?: string;
  newCustomerPhone?: string;
  address: string;
  addressDetails?: string;
  scheduledDate: string; // ISO YYYY-MM-DD
  timeSlot: LogisticsTimeSlot;
  assignedEmployeeId?: string;
  estimatedBags?: number;
  instructions?: string;
}

/** Champs modifiables d'une tournée non terminée (édition / reprogrammation). */
export interface LogisticsTaskScheduleFormData {
  address: string;
  addressDetails?: string;
  scheduledDate: string; // ISO YYYY-MM-DD
  timeSlot: LogisticsTimeSlot;
  assignedEmployeeId?: string;
  estimatedBags?: number;
  instructions?: string;
}

/* -------------------------------------------------------------------------- */
/* Rangement atelier des commandes terminées                                   */
/* -------------------------------------------------------------------------- */

/**
 * Familles d'emplacements proposées pour organiser physiquement les articles
 * terminés avant leur remise. Elles décrivent le mode de rangement, sans
 * empêcher le personnel de placer exceptionnellement une commande ailleurs.
 */
export type StorageZone = 'hanging' | 'folded' | 'delivery' | 'bulky' | 'hold' | 'other';

/**
 * Un emplacement physique de l'atelier (portant, étagère, bac…). La capacité
 * est indicative et exprimée en paquets/sacs afin de signaler la saturation.
 */
export interface StorageLocation {
  id: string;
  /** Code court à reporter sur l'étiquette physique, ex. « A-01 ». */
  code: string;
  label: string;
  zone: StorageZone;
  capacityPackages: number;
  description?: string;
  isActive: boolean;
  createdAt?: string; // ISO datetime
  updatedAt?: string; // ISO datetime
}

export interface StorageLocationFormData {
  code: string;
  label: string;
  zone: StorageZone;
  capacityPackages: number;
  description?: string;
  isActive: boolean;
}

/**
 * Création en série d'emplacements numérotés (ex. B-01 → B-12). Le modèle
 * de libellé accepte {code}, {nn} (01, 02…) et {n} (1, 2…).
 */
export interface StorageLocationSeriesInput {
  codePrefix: string;
  startNumber: number;
  count: number;
  labelTemplate: string;
  zone: StorageZone;
  capacityPackages: number;
  description?: string;
  isActive: boolean;
}

/** Affectation physique d'une commande prête à un emplacement. */
export interface StorageAssignmentInput {
  locationId?: string;
  packageCount: number;
  notes?: string;
}

export interface ClothingItem {
  id: string;
  name: string;
  category: 'all' | 'men' | 'women' | 'home' | 'pro';
  serviceCategory: 'pressing' | 'blanchisserie' | 'both';
  unitPrice: number;
  pricingType: PricingType;
  unitLabel?: string; // 'pièce', 'kg', 'panneau'
  emoji: string;
  /** Vignette illustrée (URL importée) ; si absente, l'emoji est affiché. */
  image?: string;
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
  /** Prestation de blanchisserie facturée (forfait ou à l'unité). */
  blanchisserieService?: BlanchisserieServiceId;
  /** Nombre de vêtements couverts par la ligne (forfait ou complément). */
  garments?: number;
  /** Nature de la ligne blanchisserie : bloc de forfait ou vêtements à l'unité. */
  pricingBasis?: 'forfait' | 'per_garment';
  unitLabel?: string;
  subtotal: number;
  serviceType: string;
  /** Couleur de la pièce (identification et tri) — voir GARMENT_COLORS. Absente = non précisée. */
  color?: string;
  notes?: string;
}

/** Précisions portées par une ligne ajoutée au panier depuis le comptoir. */
export interface CartLineDetails {
  /** Nombre de vêtements couverts par la ligne (forfait ou complément). */
  garments?: number;
  /** Bloc de forfait ou vêtements facturés à l'unité. */
  pricingBasis?: 'forfait' | 'per_garment';
  /** Prestation de blanchisserie concernée. */
  blanchisserieService?: BlanchisserieServiceId;
}

export interface GarmentColor {
  name: string;
  /** Valeur CSS de la pastille (couleur unie ou dégradé pour Multicolore). */
  swatch: string;
}

/** Palette proposée au comptoir pour identifier les pièces confiées (tri au lavage, retrait sans confusion). */
export const GARMENT_COLORS: GarmentColor[] = [
  { name: 'Blanc', swatch: '#F8FAFC' },
  { name: 'Noir', swatch: '#18181B' },
  { name: 'Gris', swatch: '#A1A1AA' },
  { name: 'Beige', swatch: '#D8C7A5' },
  { name: 'Marron', swatch: '#7C4A21' },
  { name: 'Rouge', swatch: '#DC2626' },
  { name: 'Orange', swatch: '#EA580C' },
  { name: 'Jaune', swatch: '#EAB308' },
  { name: 'Vert', swatch: '#16A34A' },
  { name: 'Bleu', swatch: '#2563EB' },
  { name: 'Violet', swatch: '#7C3AED' },
  { name: 'Rose', swatch: '#EC4899' },
  { name: 'Multicolore', swatch: 'conic-gradient(#ef4444, #f59e0b, #84cc16, #06b6d4, #8b5cf6, #ef4444)' },
];

export const getGarmentColorSwatch = (name?: string): string | undefined =>
  GARMENT_COLORS.find((c) => c.name === name)?.swatch;

/**
 * Normalise une couleur saisie librement : si elle correspond (casse/accents
 * près) à une couleur de la palette, on retient le nom officiel (pastille
 * correcte, fusion des lignes cohérente) ; sinon le texte nettoyé est conservé.
 */
export const resolveGarmentColorName = (raw: string): string | undefined => {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return undefined;
  const norm = (value: string) =>
    value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return GARMENT_COLORS.find((c) => norm(c.name) === norm(trimmed))?.name ?? trimmed;
};

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
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  receivedAt: string;
  promisedAt: string;
  readyAt?: string;
  deliveredAt?: string;
  notes?: string;
  isLate?: boolean;
  isUrgent?: boolean;
  /**
   * Libellé d'affichage de l'emplacement, conservé pour les anciens tickets
   * et comme instantané lisible (ex. « A-02 · Portant costumes »).
   */
  rackLocation?: string;
  /** Emplacement structuré courant, pour recherche et taux d'occupation. */
  storageLocationId?: string;
  storageLocationCode?: string;
  storageLocationLabel?: string;
  /** Nombre de paquets/sacs physiquement présents à cet emplacement. */
  storagePackageCount?: number;
  storageNotes?: string;
  storedAt?: string; // "JJ/MM/AAAA HH:mm"
  machineAssigned?: string; // e.g. "L1 • 40 min"
  assignee?: string; // e.g. "Grâce"
  progressPercent?: number; // for washing machines, e.g. 65%
  /**
   * Nom historique conservé pour compatibilité localStorage : signifie
   * « notification marquée localement », pas « SMS externe confirmé ».
   */
  smsSent?: boolean;
  /**
   * Logistique (champs optionnels : les anciennes commandes sans ces champs
   * valent automatiquement dépôt + retrait au comptoir).
   * Les frais et adresses sont figés à la création de la commande.
   */
  origin?: OrderOrigin;
  fulfillmentMethod?: FulfillmentMethod;
  collectionTaskId?: string;
  collectionFee?: number;
  collectionAddress?: string;
  collectionAddressDetails?: string;
  collectionDate?: string; // ISO YYYY-MM-DD
  collectionTimeSlot?: LogisticsTimeSlot;
  deliveryTaskId?: string;
  deliveryFee?: number;
  deliveryAddress?: string;
  deliveryAddressDetails?: string;
  deliveryDate?: string; // ISO YYYY-MM-DD
  deliveryTimeSlot?: LogisticsTimeSlot;
}

/**
 * Paramètres de la boutique (écran Paramètres), persistés dans le navigateur
 * (clé pressingpro_shop_settings). L'identité alimente le ticket thermique,
 * la barre latérale et l'en-tête imprimé des rapports.
 */
/**
 * Prestations de blanchisserie.
 *
 * La blanchisserie ne se vend plus au kilo ni à la pièce du catalogue : elle
 * propose trois prestations, dont deux au forfait par NOMBRE DE VÊTEMENTS
 * (ex. 20 vêtements = 3 000 FCFA). La grille est définie à l'avance dans les
 * Paramètres ; le repassage seul se facture au vêtement.
 */
export type BlanchisserieServiceId = 'wash_only' | 'wash_iron' | 'iron_only';

/** Un palier de forfait : N vêtements et le prix de chaque prestation. */
export interface BlanchisserieTier {
  id: string;
  garments: number;
  prices: Record<BlanchisserieServiceId, number>;
}

export interface BlanchisserieSettings {
  /** Paliers de forfaits (nombre de vêtements croissant). */
  tiers: BlanchisserieTier[];
  /**
   * Prix du vêtement supplémentaire au-delà du forfait, et tarif des
   * prestations facturées à l'unité (repassage seul).
   */
  unitPrices: Record<BlanchisserieServiceId, number>;
  /** `true` = prestation facturée au vêtement, sans forfait. */
  perGarment: Record<BlanchisserieServiceId, boolean>;
}

export interface ShopSettings {
  name: string;
  /** Logo de l'établissement en data URL (PNG/WebP 256 px), `null` = aucun. */
  logoDataUrl: string | null;
  tagline: string;
  address: string;
  phone: string;
  currency: string;
  enableSms: boolean;
  enableThermalPrinter: boolean;
  /** Forfaits appliqués aux NOUVEAUX ramassages / livraisons (0 = offert). */
  pickupFee: number;
  deliveryFee: number;
  /** Règles du propriétaire pour le rangement des commandes terminées. */
  storageAssignmentRequired: boolean;
  storageAllowCapacityOverflow: boolean;
  storageSuggestionsEnabled: boolean;
  storageDefaultCapacityPackages: number;
  /** Grille des prestations de blanchisserie (forfaits au nombre de vêtements). */
  blanchisserie: BlanchisserieSettings;
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
