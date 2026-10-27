import {
  ClothingItem,
  Customer,
  LaundryOrder,
  CashRegisterData,
  Employee,
  AttendanceRecord,
  InventoryProduct,
  StockMovement,
  Expense,
  ExpenseCategory,
} from '../types';
import { daysFromToday, formatDate, formatDateTime, formatPromised, isoDaysFromToday } from '../lib/dates';
import imgChemise from '../assets/images/articles/chemise.webp';
import imgPantalon from '../assets/images/articles/pantalon.webp';
import imgRobe from '../assets/images/articles/robe.webp';
import imgCostume from '../assets/images/articles/costume.webp';
import imgVeste from '../assets/images/articles/veste.webp';
import imgJupe from '../assets/images/articles/jupe.webp';
import imgPull from '../assets/images/articles/pull.webp';
import imgBlouseUniforme from '../assets/images/articles/blouse-uniforme.webp';
import imgGilet from '../assets/images/articles/gilet.webp';
import imgTeeShirt from '../assets/images/articles/tee-shirt.webp';
import imgJean from '../assets/images/articles/jean.webp';
import imgSweatCapuche from '../assets/images/articles/sweat-capuche.webp';
import imgShort from '../assets/images/articles/short.webp';
import imgChaussettes from '../assets/images/articles/chaussettes.webp';

export const INITIAL_CLOTHING_ITEMS: ClothingItem[] = [
  // --- PRESSING (Bleu) ---
  { id: 'c1', name: 'Chemise', category: 'men', serviceCategory: 'pressing', unitPrice: 1500, pricingType: 'unit', unitLabel: 'pièce', emoji: '👔', image: imgChemise, description: 'Coton, lin, col amidonné' },
  { id: 'c2', name: 'Pantalon', category: 'men', serviceCategory: 'pressing', unitPrice: 1500, pricingType: 'unit', unitLabel: 'pièce', emoji: '👖', image: imgPantalon, description: 'Pli marqué, costume, chino' },
  { id: 'c3', name: 'Robe', category: 'women', serviceCategory: 'pressing', unitPrice: 2500, pricingType: 'unit', unitLabel: 'pièce', emoji: '👗', image: imgRobe, description: 'Soie, mousseline, soirée' },
  { id: 'c4', name: 'Costume', category: 'men', serviceCategory: 'pressing', unitPrice: 5000, pricingType: 'unit', unitLabel: 'pièce', emoji: '🤵', image: imgCostume, description: '2 ou 3 pièces en laine' },
  { id: 'c5', name: 'Boubou bazin', category: 'men', serviceCategory: 'pressing', unitPrice: 4500, pricingType: 'unit', unitLabel: 'pièce', emoji: '🥻', description: 'Bazin riche, broderie or' },
  { id: 'c6', name: 'Veste & Manteau', category: 'men', serviceCategory: 'pressing', unitPrice: 4000, pricingType: 'unit', unitLabel: 'pièce', emoji: '🧥', image: imgVeste, description: 'Laine, velours, doublé' },
  { id: 'c7', name: 'Foulard & Soie', category: 'women', serviceCategory: 'pressing', unitPrice: 800, pricingType: 'unit', unitLabel: 'pièce', emoji: '🧕', description: 'Soie, mousseline, wax délicat' },
  { id: 'c8', name: 'Jupe', category: 'women', serviceCategory: 'pressing', unitPrice: 2000, pricingType: 'unit', unitLabel: 'pièce', emoji: '🩳', image: imgJupe, description: 'Droite, plissée, tailleur' },
  { id: 'c9', name: 'Pull & Tricot', category: 'all', serviceCategory: 'pressing', unitPrice: 2500, pricingType: 'unit', unitLabel: 'pièce', emoji: '🧶', image: imgPull, description: 'Cachemire, laine délicate' },
  { id: 'c10', name: 'Retouche / Ourlet', category: 'all', serviceCategory: 'pressing', unitPrice: 1500, pricingType: 'unit', unitLabel: 'prestation', emoji: '🪡', description: 'Ourlet pantalon, reprise taille' },
  { id: 'c11', name: 'Gilet', category: 'men', serviceCategory: 'pressing', unitPrice: 2000, pricingType: 'unit', unitLabel: 'pièce', emoji: '🧥', image: imgGilet, description: 'Gilet habillé, costume 3 pièces' },
  { id: 'c12', name: 'Tee-shirt & Polo', category: 'all', serviceCategory: 'pressing', unitPrice: 1000, pricingType: 'unit', unitLabel: 'pièce', emoji: '👕', image: imgTeeShirt, description: 'Coton, col rond ou polo' },
  { id: 'c13', name: 'Jean', category: 'all', serviceCategory: 'pressing', unitPrice: 1500, pricingType: 'unit', unitLabel: 'pièce', emoji: '👖', image: imgJean, description: 'Denim, pli léger' },
  { id: 'c14', name: 'Sweat à capuche', category: 'all', serviceCategory: 'pressing', unitPrice: 2000, pricingType: 'unit', unitLabel: 'pièce', emoji: '🧥', image: imgSweatCapuche, description: 'Molleton, poche kangourou' },
  { id: 'c15', name: 'Short & Culotte', category: 'all', serviceCategory: 'pressing', unitPrice: 1000, pricingType: 'unit', unitLabel: 'pièce', emoji: '🩳', image: imgShort, description: 'Bermuda, short de ville ou de sport' },

  // --- BLANCHISSERIE (Vert turquoise) ---
  { id: 'b1', name: 'Draps & Housses', category: 'home', serviceCategory: 'blanchisserie', unitPrice: 2000, pricingType: 'unit', unitLabel: 'pièce', emoji: '🛏️', description: '1 ou 2 places, grand format' },
  { id: 'b2', name: 'Serviettes de bain', category: 'home', serviceCategory: 'blanchisserie', unitPrice: 1200, pricingType: 'unit', unitLabel: 'pièce', emoji: '🧖', description: 'Éponge épaisse, désinfection' },
  { id: 'b3', name: 'Taies d’oreiller', category: 'home', serviceCategory: 'blanchisserie', unitPrice: 800, pricingType: 'unit', unitLabel: 'pièce', emoji: '🛌', description: 'Coton blanc, satin de coton' },
  { id: 'b4', name: 'Nappes & Serviettes table', category: 'home', serviceCategory: 'blanchisserie', unitPrice: 2500, pricingType: 'unit', unitLabel: 'pièce', emoji: '🍽️', description: 'Restauration, amidonnage' },
  { id: 'b5', name: 'Uniformes pro / Médical', category: 'pro', serviceCategory: 'blanchisserie', unitPrice: 2000, pricingType: 'unit', unitLabel: 'pièce', emoji: '🦺', image: imgBlouseUniforme, description: 'Blouse, tenue cuisine/sécurité' },
  { id: 'b6', name: 'Linge au kilo (au poids)', category: 'all', serviceCategory: 'blanchisserie', unitPrice: 1000, pricingType: 'kilo', unitLabel: 'kg', emoji: '⚖️', description: 'Pesée au comptoir • 1 000 FCFA/kg' },
  { id: 'b7', name: 'Couette & Édredon', category: 'home', serviceCategory: 'blanchisserie', unitPrice: 5000, pricingType: 'unit', unitLabel: 'pièce', emoji: '🛋️', description: 'Duvet plume ou synthétique' },
  { id: 'b8', name: 'Rideaux & Voilages', category: 'home', serviceCategory: 'blanchisserie', unitPrice: 3000, pricingType: 'unit', unitLabel: 'panneau', emoji: '🪟', description: 'Lavage & défroissage vapeur' },
  { id: 'b9', name: 'Chaussettes & petit linge', category: 'all', serviceCategory: 'blanchisserie', unitPrice: 500, pricingType: 'unit', unitLabel: 'pièce', emoji: '🧦', image: imgChaussettes, description: 'Chaussettes, sous-vêtements, petit linge' },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Aïcha Koné',
    phone: '07 08 55 23 41',
    address: 'Attoban, Cocody',
    depositsCount: 27,
    balance: 0,
    loyaltyDiscountPercent: 10,
    isVip: true,
  },
  {
    id: 'cust-2',
    name: 'Ibrahim Touré',
    phone: '05 66 20 91 34',
    address: 'Plateau, Rue du Commerce',
    depositsCount: 14,
    balance: 0,
    loyaltyDiscountPercent: 0,
  },
  {
    id: 'cust-3',
    name: 'Fatou Diarra',
    phone: '07 47 88 03 55',
    address: 'Yopougon, Maroc',
    depositsCount: 31,
    balance: 4000,
    loyaltyDiscountPercent: 5,
    isVip: true,
  },
  {
    id: 'cust-4',
    name: "N'Guessan Affoué",
    phone: '07 09 44 12 08',
    address: 'Cocody, Angré 8e Tranche',
    depositsCount: 19,
    balance: 0,
    loyaltyDiscountPercent: 0,
  },
  {
    id: 'cust-5',
    name: 'Seen Hôtel (pro)',
    phone: '01 02 03 04 05',
    address: 'Plateau Business District',
    depositsCount: 95,
    balance: 0,
    loyaltyDiscountPercent: 15,
    isVip: true,
  },
  {
    id: 'cust-6',
    name: 'Yao Kouassi',
    phone: '07 77 12 34 56',
    address: 'Cocody, Deux Plateaux',
    depositsCount: 8,
    balance: 0,
    loyaltyDiscountPercent: 0,
  },
  {
    id: 'cust-7',
    name: 'Marc Yao',
    phone: '05 55 88 99 00',
    address: 'Cocody, Riviera Golf',
    depositsCount: 42,
    balance: 0,
    loyaltyDiscountPercent: 10,
    isVip: true,
  },
  {
    id: 'cust-8',
    name: 'Rita N\'Guessan',
    phone: '07 88 44 11 22',
    address: 'Marcory, Zone 4',
    depositsCount: 5,
    balance: 0,
    loyaltyDiscountPercent: 0,
  },
  {
    id: 'cust-9',
    name: 'Konan Ulrich',
    phone: '01 44 55 66 77',
    address: 'Cocody, Danga',
    depositsCount: 22,
    balance: 0,
    loyaltyDiscountPercent: 5,
  },
  {
    id: 'cust-10',
    name: 'Aya Brou',
    phone: '07 12 99 88 77',
    address: 'Riviera Palmeraie',
    depositsCount: 11,
    balance: 0,
    loyaltyDiscountPercent: 0,
  },
];

// Dates de démonstration RELATIVES au jour d'ouverture de l'application :
// le tableau de bord reste cohérent quel que soit le jour de la démo
// (commandes "du jour", une en retard depuis hier, retraits à venir…).
export const INITIAL_ORDERS: LaundryOrder[] = [
  {
    id: 'ord-2854',
    ticketNumber: '#TK-2854',
    customerId: 'cust-4',
    customerName: "N'Guessan Affoué",
    customerPhone: '07 09 44 12 08',
    customerAddress: 'Cocody, Angré 8e Tranche',
    lines: [
      { id: 'l1', clothingItemId: 'c1', name: 'Chemise', quantity: 3, unitPrice: 1500, subtotal: 4500, serviceType: 'Lavage + Repassage', color: 'Blanc' },
      { id: 'l2', clothingItemId: 'c3', name: 'Robe', quantity: 1, unitPrice: 2000, subtotal: 2000, serviceType: 'Lavage + Repassage', color: 'Rouge' },
    ],
    subtotal: 6500,
    serviceFees: 0,
    discount: 0,
    total: 6500,
    depositPaid: 6500,
    remainingBalance: 0,
    paymentMethod: 'wave',
    status: 'washing',
    receivedAt: formatDateTime(daysFromToday(0, 8, 30)),
    promisedAt: formatPromised(daysFromToday(1, 12)),
    machineAssigned: 'L1 • 40 min',
    progressPercent: 65,
    notes: 'Lavage classique, amidonnage léger sur cols chemises',
    smsSent: true,
  },
  {
    id: 'ord-2853',
    ticketNumber: '#TK-2853',
    customerId: 'cust-2',
    customerName: 'Ibrahim Touré',
    customerPhone: '05 66 20 91 34',
    customerAddress: 'Plateau',
    lines: [
      { id: 'l3', clothingItemId: 'c4', name: 'Costume 3 pièces', quantity: 1, unitPrice: 5000, subtotal: 5000, serviceType: 'Pressing à sec', color: 'Noir' },
    ],
    subtotal: 5000,
    serviceFees: 0,
    discount: 0,
    total: 5000,
    depositPaid: 2500,
    remainingBalance: 2500,
    paymentMethod: 'especes',
    status: 'received',
    receivedAt: formatDateTime(daysFromToday(0, 9, 15)),
    promisedAt: formatPromised(daysFromToday(2, 17)),
    isUrgent: true,
    notes: 'Costume bleu marine en laine froide, bouton de manche gauche à resserrer si possible',
    smsSent: true,
  },
  {
    id: 'ord-2852',
    ticketNumber: '#TK-2852',
    customerId: 'cust-3',
    customerName: 'Fatou Diarra',
    customerPhone: '07 47 88 03 55',
    customerAddress: 'Yopougon',
    lines: [
      { id: 'l4', clothingItemId: 'c5', name: 'Boubou wax brodé', quantity: 2, unitPrice: 3700, subtotal: 7400, serviceType: 'Lavage délicat', color: 'Multicolore' },
      { id: 'l5', clothingItemId: 'c7', name: 'Foulard soie', quantity: 4, unitPrice: 400, subtotal: 1600, serviceType: 'Lavage délicat' },
    ],
    subtotal: 9000,
    serviceFees: 0,
    discount: 0,
    total: 9000,
    depositPaid: 5000,
    remainingBalance: 4000,
    paymentMethod: 'wave',
    status: 'ready',
    receivedAt: formatDateTime(daysFromToday(-1, 11, 0)),
    promisedAt: formatPromised(daysFromToday(1, 18)),
    readyAt: formatDateTime(daysFromToday(0, 8, 0)),
    rackLocation: 'Étagère B-04',
    notes: 'Boubous wax très colorés, cintre + housse plastique',
    smsSent: true,
  },
  {
    id: 'ord-2851',
    ticketNumber: '#TK-2851',
    customerId: 'cust-5',
    customerName: 'Seen Hôtel (pro)',
    customerPhone: '01 02 03 04 05',
    customerAddress: 'Plateau',
    lines: [
      { id: 'l6', clothingItemId: 'b6', name: 'Linge pro B2B (Serviettes + draps 85kg)', quantity: 85, unitPrice: 1000, subtotal: 85000, serviceType: 'Blanchisserie industrielle' },
    ],
    subtotal: 85000,
    serviceFees: 0,
    discount: 0,
    total: 85000,
    depositPaid: 85000,
    remainingBalance: 0,
    paymentMethod: 'om',
    status: 'washing',
    receivedAt: formatDateTime(daysFromToday(0, 7, 0)),
    promisedAt: formatPromised(daysFromToday(3, 8)),
    machineAssigned: 'L2 • Grand tambour',
    progressPercent: 40,
    notes: 'Contrat B2B • 120 pièces/semaine',
    smsSent: true,
  },
  {
    id: 'ord-2841',
    ticketNumber: '#TK-2841',
    customerId: 'cust-6',
    customerName: 'Yao Kouassi',
    customerPhone: '07 77 12 34 56',
    customerAddress: 'Cocody',
    lines: [
      { id: 'l7', clothingItemId: 'c4', name: 'Costume 2 pièces', quantity: 2, unitPrice: 5000, subtotal: 10000, serviceType: 'Pressing à sec' },
    ],
    subtotal: 10000,
    serviceFees: 0,
    discount: 0,
    total: 10000,
    depositPaid: 5000,
    remainingBalance: 5000,
    paymentMethod: 'especes',
    status: 'ironing',
    receivedAt: formatDateTime(daysFromToday(-2, 14, 0)),
    promisedAt: formatPromised(daysFromToday(-1, 17)),
    isLate: true,
    assignee: 'Grâce',
    notes: 'Promis hier 17h — retard à rattraper d’urgence',
    smsSent: false,
  },
  {
    id: 'ord-2849',
    ticketNumber: '#TK-2849',
    customerId: 'cust-10',
    customerName: 'Aya Brou',
    customerPhone: '07 12 99 88 77',
    customerAddress: 'Riviera Palmeraie',
    lines: [
      { id: 'l8', clothingItemId: 'c2', name: 'Pantalon', quantity: 4, unitPrice: 1500, subtotal: 6000, serviceType: 'Lavage + Repassage', color: 'Gris' },
      { id: 'l9', clothingItemId: 'c1', name: 'Chemise', quantity: 2, unitPrice: 1500, subtotal: 3000, serviceType: 'Lavage + Repassage' },
    ],
    subtotal: 9000,
    serviceFees: 0,
    discount: 0,
    total: 9000,
    depositPaid: 9000,
    remainingBalance: 0,
    paymentMethod: 'wave',
    status: 'ironing',
    receivedAt: formatDateTime(daysFromToday(-1, 15, 30)),
    promisedAt: formatPromised(daysFromToday(1, 16)),
    assignee: 'Divine',
    notes: 'Plis bien droits',
    smsSent: true,
  },
  {
    id: 'ord-2847',
    ticketNumber: '#TK-2847',
    customerId: 'cust-9',
    customerName: 'Konan Ulrich',
    customerPhone: '01 44 55 66 77',
    customerAddress: 'Cocody, Danga',
    lines: [
      { id: 'l10', clothingItemId: 'c4', name: 'Costumes', quantity: 3, unitPrice: 5000, subtotal: 15000, serviceType: 'Pressing à sec' },
    ],
    subtotal: 15000,
    serviceFees: 0,
    discount: 0,
    total: 15000,
    depositPaid: 15000,
    remainingBalance: 0,
    paymentMethod: 'momo',
    status: 'ready',
    receivedAt: formatDateTime(daysFromToday(-2, 10, 0)),
    promisedAt: formatPromised(daysFromToday(0, 14)),
    readyAt: formatDateTime(daysFromToday(0, 9, 0)),
    rackLocation: 'Étagère A-12',
    notes: 'Soldé par MTN MoMo',
    smsSent: true,
  },
  {
    id: 'ord-2856',
    ticketNumber: '#TK-2856',
    customerId: 'cust-6',
    customerName: 'Yao Kouassi',
    customerPhone: '07 77 12 34 56',
    customerAddress: 'Cocody, Deux Plateaux',
    lines: [
      { id: 'l11', clothingItemId: 'c1', name: 'Chemise', quantity: 5, unitPrice: 1500, subtotal: 7500, serviceType: 'Lavage + Repassage' },
    ],
    subtotal: 7500,
    serviceFees: 0,
    discount: 0,
    total: 7500,
    depositPaid: 7500,
    remainingBalance: 0,
    paymentMethod: 'wave',
    status: 'received',
    receivedAt: formatDateTime(daysFromToday(0, 9, 30)),
    promisedAt: formatPromised(daysFromToday(1, 12)),
    notes: '3 blanches, 2 bleues ciel',
    smsSent: true,
  },
  {
    id: 'ord-2857',
    ticketNumber: '#TK-2857',
    customerId: 'cust-8',
    customerName: "Rita N'Guessan",
    customerPhone: '07 88 44 11 22',
    customerAddress: 'Marcory, Zone 4',
    lines: [
      { id: 'l12', clothingItemId: 'c3', name: 'Robe de mariée avec traîne', quantity: 1, unitPrice: 15000, subtotal: 15000, serviceType: 'Pressing délicat haute couture' },
    ],
    subtotal: 15000,
    serviceFees: 0,
    discount: 0,
    total: 15000,
    depositPaid: 10000,
    remainingBalance: 5000,
    paymentMethod: 'especes',
    status: 'received',
    receivedAt: formatDateTime(daysFromToday(0, 9, 40)),
    promisedAt: formatPromised(daysFromToday(3, 16)),
    notes: '⚠ Délicat — contrôle direct par Awa',
    smsSent: true,
  },
  {
    id: 'ord-2836',
    ticketNumber: '#TK-2836',
    customerId: 'cust-1',
    customerName: 'Aïcha Koné',
    customerPhone: '07 08 55 23 41',
    customerAddress: 'Attoban, Cocody',
    lines: [
      { id: 'l13', clothingItemId: 'c5', name: 'Boubou bazin', quantity: 1, unitPrice: 4500, subtotal: 4500, serviceType: 'Lavage délicat' },
    ],
    subtotal: 4500,
    serviceFees: 0,
    discount: 0,
    total: 4500,
    depositPaid: 2000,
    remainingBalance: 2500,
    paymentMethod: 'wave',
    status: 'ironing',
    receivedAt: formatDateTime(daysFromToday(-3, 16, 0)),
    promisedAt: formatPromised(daysFromToday(0, 15)),
    notes: 'Jour J — à terminer pour 15h',
    smsSent: false,
  },
  {
    id: 'ord-2831',
    ticketNumber: '#TK-2831',
    customerId: 'cust-7',
    customerName: 'Marc Yao',
    customerPhone: '05 55 88 99 00',
    customerAddress: 'Riviera Golf',
    lines: [
      { id: 'l14', clothingItemId: 'b1', name: 'Hôtel — 35 draps / housses', quantity: 35, unitPrice: 1000, subtotal: 35000, serviceType: 'Blanchisserie' },
    ],
    subtotal: 35000,
    serviceFees: 0,
    discount: 0,
    total: 35000,
    depositPaid: 35000,
    remainingBalance: 0,
    paymentMethod: 'wave',
    status: 'ironing',
    receivedAt: formatDateTime(daysFromToday(-3, 11, 0)),
    promisedAt: formatPromised(daysFromToday(0, 17)),
    notes: 'Jour J — commande volumineuse',
    smsSent: true,
  },
];

export const INITIAL_CASH_REGISTER: CashRegisterData = {
  date: formatDate(new Date()),
  cashAmount: 78500,
  waveAmount: 64000,
  momoAmount: 44000,
  totalAmount: 186500,
  floatAmount: 20000,
  targetGoal: 3850000,
  monthAchieved: 2772000,
};

// Montants de démonstration ; les libellés de jours sont générés à partir
// des 7 derniers jours réels pour rester cohérents avec le calendrier.
const REVENUE_VALUES = [98000, 124000, 142000, 210000, 87000, 163000, 186500];

export const REVENUE_7_DAYS = REVENUE_VALUES.map((value, i) => {
  const offset = i - (REVENUE_VALUES.length - 1); // de J-6 à aujourd'hui
  const date = daysFromToday(offset, 12);
  const weekdayShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
    .format(date)
    .replace(/\.$/, '');
  const isToday = offset === 0;
  const isPeak = value === Math.max(...REVENUE_VALUES);
  return {
    day: isToday ? 'Auj.' : `${weekdayShort.charAt(0).toUpperCase() + weekdayShort.slice(1)} ${date.getDate()}`,
    date: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date),
    value,
    label: `${Math.round(value / 1000)}k`,
    heightPercent: Math.round((value / Math.max(...REVENUE_VALUES)) * 100),
    ...(isPeak ? { isPeak: true } : {}),
    ...(isToday ? { isToday: true } : {}),
    note: isToday ? 'En cours' : isPeak ? 'Pic de la semaine' : '',
  };
});

export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FCFA';
}

/* ============================================================================
 * DONNÉES DE DÉMONSTRATION des modules Personnel, Stocks et Dépenses.
 * Entièrement FICTIVES : noms, montants et quantités d'illustration, chargés
 * uniquement au premier lancement puis conservés dans le localStorage.
 * Les dates sont relatives au jour d'ouverture pour rester plausibles.
 * ========================================================================== */

export const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'emp-1', fullName: 'Awa Koné', phone: '07 08 09 10 11', position: 'Responsable / Gestion', status: 'active', hiredAt: '2023-01-16', notes: 'Gérante — poste comptoir 01.' },
  { id: 'emp-2', fullName: 'Moussa Diarra', phone: '05 44 32 18 90', position: 'Lavage', status: 'active', hiredAt: '2023-03-06', notes: "Chef d'atelier." },
  { id: 'emp-3', fullName: 'Yann Kouadio', phone: '07 59 61 24 08', position: 'Lavage', status: 'active', hiredAt: '2024-02-19' },
  { id: 'emp-4', fullName: "Grâce N'Dri", phone: '01 41 77 52 63', position: 'Repassage', status: 'active', hiredAt: '2023-09-04' },
  { id: 'emp-5', fullName: 'Divine Aka', phone: '07 87 30 45 12', position: 'Finition', status: 'active', hiredAt: '2024-06-10', notes: 'Repassage et finition.' },
  { id: 'emp-6', fullName: 'Ibrahim Sangaré', position: 'Livraison', status: 'active', notes: 'Tournées Cocody / Plateau. Téléphone à compléter.' },
  { id: 'emp-7', fullName: 'Fatou Bamba', phone: '05 66 94 21 37', position: 'Réception', status: 'leave', hiredAt: '2024-11-25', notes: 'En congé annuel (démonstration).' },
  { id: 'emp-8', fullName: 'Kouamé Junior', phone: '07 47 12 98 55', position: 'Livraison', status: 'inactive', notes: 'Profil désactivé (démonstration).' },
  { id: 'emp-9', fullName: 'Aïcha Bamba', phone: '01 52 08 73 46', position: 'Finition', status: 'active' },
];

const att = (
  n: number,
  employeeId: string,
  offset: number,
  status: AttendanceRecord['status'],
  extra?: Partial<AttendanceRecord>
): AttendanceRecord => ({
  id: `att-${n}`,
  employeeId,
  date: isoDaysFromToday(offset),
  status,
  ...extra,
});

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  // Semaine écoulée (démonstration)
  att(1, 'emp-1', -6, 'present', { arrivalTime: '07:52' }),
  att(2, 'emp-2', -6, 'present', { arrivalTime: '08:03' }),
  att(3, 'emp-3', -6, 'present', { arrivalTime: '08:10' }),
  att(4, 'emp-4', -6, 'present', { arrivalTime: '07:58' }),
  att(5, 'emp-5', -6, 'present', { arrivalTime: '08:00' }),
  att(6, 'emp-1', -5, 'present', { arrivalTime: '07:55' }),
  att(7, 'emp-2', -5, 'present', { arrivalTime: '08:01' }),
  att(8, 'emp-3', -5, 'present', { arrivalTime: '08:06' }),
  att(9, 'emp-4', -5, 'present', { arrivalTime: '08:02' }),
  att(10, 'emp-1', -4, 'present', { arrivalTime: '07:50' }),
  att(11, 'emp-2', -4, 'present', { arrivalTime: '08:00' }),
  att(12, 'emp-4', -4, 'present', { arrivalTime: '08:04' }),
  att(13, 'emp-7', -4, 'leave', { reason: 'Congé annuel' }),
  att(14, 'emp-1', -3, 'present', { arrivalTime: '07:57' }),
  att(15, 'emp-2', -3, 'present', { arrivalTime: '08:05' }),
  att(16, 'emp-3', -3, 'absent', { reason: 'Absent — a prévenu par téléphone' }),
  att(17, 'emp-7', -3, 'leave', { reason: 'Congé annuel' }),
  att(18, 'emp-1', -2, 'present', { arrivalTime: '07:54' }),
  att(19, 'emp-4', -2, 'present', { arrivalTime: '07:59' }),
  att(20, 'emp-5', -2, 'late', { arrivalTime: '08:47', reason: 'Embouteillages (déclaré)' }),
  att(21, 'emp-7', -2, 'leave', { reason: 'Congé annuel' }),
  att(22, 'emp-1', -1, 'present', { arrivalTime: '07:53' }),
  att(23, 'emp-2', -1, 'present', { arrivalTime: '08:02' }),
  att(24, 'emp-4', -1, 'present', { arrivalTime: '08:01' }),
  att(25, 'emp-9', -1, 'present', { arrivalTime: '08:08' }),
  att(26, 'emp-7', -1, 'leave', { reason: 'Congé annuel' }),
  // Aujourd'hui : pointage partiellement saisi (emp-3 et emp-6 restent « Non renseigné »)
  att(27, 'emp-1', 0, 'present', { arrivalTime: '07:55' }),
  att(28, 'emp-2', 0, 'present', { arrivalTime: '08:02' }),
  att(29, 'emp-4', 0, 'present', { arrivalTime: '08:00' }),
  att(30, 'emp-5', 0, 'late', { arrivalTime: '08:40' }),
  att(31, 'emp-9', 0, 'present', { arrivalTime: '08:05' }),
  att(32, 'emp-7', 0, 'leave', { reason: 'Congé annuel' }),
];

export const INITIAL_PRODUCTS: InventoryProduct[] = [
  { id: 'prod-1', name: 'Lessive liquide professionnelle', reference: 'LES-20L', category: 'Détergents et lessives', unit: 'L', currentQuantity: 42, alertThreshold: 20, unitCostXof: 850, supplier: 'Siprochim CI (démo)', isActive: true },
  { id: 'prod-2', name: 'Poudre à laver industrielle', reference: 'POU-25', category: 'Détergents et lessives', unit: 'kg', currentQuantity: 18, alertThreshold: 25, unitCostXof: 600, supplier: 'Siprochim CI (démo)', isActive: true },
  { id: 'prod-3', name: 'Détachant textile enzymatique', reference: 'DET-05', category: 'Détachants et solvants', unit: 'L', currentQuantity: 3.5, alertThreshold: 5, unitCostXof: 3200, isActive: true },
  { id: 'prod-4', name: 'Solvant pressing à sec', reference: 'SOL-10', category: 'Détachants et solvants', unit: 'L', currentQuantity: 0, alertThreshold: 8, unitCostXof: 2800, supplier: 'ChimInter (démo)', isActive: true },
  { id: 'prod-5', name: 'Assouplissant concentré parfumé', reference: 'ASS-10', category: 'Assouplissants et finition', unit: 'L', currentQuantity: 26, alertThreshold: 10, isActive: true },
  { id: 'prod-6', name: 'Amidon de finition', reference: 'AMI-05', category: 'Assouplissants et finition', unit: 'kg', currentQuantity: 6, alertThreshold: 4, unitCostXof: 1500, isActive: true },
  { id: 'prod-7', name: 'Cintres métal renforcés', reference: 'CIN-M', category: 'Cintres', unit: 'unité', currentQuantity: 340, alertThreshold: 150, unitCostXof: 75, isActive: true },
  { id: 'prod-8', name: 'Housses de protection 120 cm', reference: 'HOU-120', category: 'Housses et emballages', unit: 'unité', currentQuantity: 85, alertThreshold: 100, unitCostXof: 120, isActive: true },
  { id: 'prod-9', name: 'Sacs emballage transparents (x100)', reference: 'SAC-T', category: 'Housses et emballages', unit: 'paquet', currentQuantity: 14, alertThreshold: 6, unitCostXof: 900, isActive: true },
  { id: 'prod-10', name: 'Étiquettes thermiques pour tickets', reference: 'ETI-TH', category: 'Fournitures diverses', unit: 'paquet', currentQuantity: 2, alertThreshold: 3, unitCostXof: 2500, isActive: true },
  { id: 'prod-11', name: 'Adoucissant ancienne formule', reference: 'ADO-ANC', category: 'Assouplissants et finition', unit: 'L', currentQuantity: 4, alertThreshold: 5, unitCostXof: 1100, description: 'Produit arrêté — conservé pour l’historique.', isActive: false },
];

const move = (
  n: number,
  productId: string,
  type: StockMovement['type'],
  quantity: number,
  quantityBefore: number,
  quantityAfter: number,
  offset: number,
  reason: string,
  extra?: Partial<StockMovement>
): StockMovement => ({
  id: `mov-${n}`,
  productId,
  type,
  quantity,
  quantityBefore,
  quantityAfter,
  date: isoDaysFromToday(offset),
  reason,
  ...extra,
});

// Séquence cohérente : le dernier « stock après » de chaque produit = sa quantité actuelle.
export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [
  move(1, 'prod-1', 'in', 60, 0, 60, -14, 'Stock initial (démonstration)', { unitCostXof: 850 }),
  move(2, 'prod-1', 'out', 12, 60, 48, -7, 'Consommation atelier'),
  move(3, 'prod-1', 'out', 6, 48, 42, -1, 'Consommation atelier'),
  move(4, 'prod-2', 'in', 50, 0, 50, -14, 'Stock initial (démonstration)', { unitCostXof: 600 }),
  move(5, 'prod-2', 'out', 32, 50, 18, -4, 'Consommation atelier'),
  move(6, 'prod-3', 'in', 10, 0, 10, -12, 'Stock initial (démonstration)', { unitCostXof: 3200 }),
  move(7, 'prod-3', 'out', 6.5, 10, 3.5, -3, 'Consommation atelier'),
  move(8, 'prod-4', 'in', 20, 0, 20, -12, 'Stock initial (démonstration)', { unitCostXof: 2800 }),
  move(9, 'prod-4', 'out', 20, 20, 0, -2, 'Consommation atelier — bidon terminé'),
  move(10, 'prod-5', 'in', 40, 0, 40, -12, 'Stock initial (démonstration)'),
  move(11, 'prod-5', 'out', 14, 40, 26, -5, 'Consommation atelier'),
  move(12, 'prod-6', 'in', 10, 0, 10, -12, 'Stock initial (démonstration)', { unitCostXof: 1500 }),
  move(13, 'prod-6', 'out', 4, 10, 6, -6, 'Consommation atelier'),
  move(14, 'prod-7', 'in', 500, 0, 500, -14, 'Stock initial (démonstration)', { unitCostXof: 75 }),
  move(15, 'prod-7', 'out', 150, 500, 350, -6, 'Consommation atelier'),
  move(16, 'prod-7', 'adjustment', 340, 350, 340, -4, 'Inventaire — cintres cassés retirés'),
  move(17, 'prod-8', 'in', 200, 0, 200, -14, 'Stock initial (démonstration)', { unitCostXof: 120 }),
  move(18, 'prod-8', 'out', 115, 200, 85, -5, 'Consommation atelier'),
  move(19, 'prod-9', 'in', 20, 0, 20, -12, 'Stock initial (démonstration)', { unitCostXof: 900 }),
  move(20, 'prod-9', 'out', 6, 20, 14, -3, 'Consommation atelier'),
  move(21, 'prod-10', 'in', 8, 0, 8, -12, 'Stock initial (démonstration)', { unitCostXof: 2500 }),
  move(22, 'prod-10', 'out', 6, 8, 2, -2, 'Consommation comptoir'),
  move(23, 'prod-11', 'in', 12, 0, 12, -20, 'Stock initial (démonstration)', { unitCostXof: 1100 }),
  move(24, 'prod-11', 'out', 8, 12, 4, -9, 'Consommation atelier'),
];

export const INITIAL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-elec', label: 'Électricité / énergie', isActive: true },
  { id: 'cat-eau', label: 'Eau', isActive: true },
  { id: 'cat-loyer', label: 'Loyer', isActive: true },
  { id: 'cat-conso', label: 'Consommables', isActive: true },
  { id: 'cat-maint', label: 'Maintenance et réparation', isActive: true },
  { id: 'cat-transp', label: 'Transport et livraison', isActive: true },
  { id: 'cat-sal', label: 'Salaires / rémunérations', isActive: true },
  { id: 'cat-admin', label: 'Frais administratifs', isActive: true },
  { id: 'cat-autre', label: 'Autres dépenses', isActive: true },
  { id: 'cat-ancien-tel', label: 'Téléphone (ancien libellé)', isActive: false },
];

const expense = (
  n: number,
  offset: number,
  data: Omit<Expense, 'id' | 'date' | 'status'> & Partial<Pick<Expense, 'status' | 'cancellationReason'>>
): Expense => {
  const date = isoDaysFromToday(offset);
  return {
    id: `exp-${n}`,
    date,
    status: 'recorded',
    createdAt: `${date}T09:00:00`,
    ...data,
  };
};

export const INITIAL_EXPENSES: Expense[] = [
  expense(1, -28, { label: 'Loyer boutique Cocody (démo)', categoryId: 'cat-loyer', amountXof: 250000, paymentMethod: 'transfer', supplier: 'SCI Les Jardins (démo)', reference: 'LOY-DEMO' }),
  expense(2, -21, { label: 'Facture électricité CIE (démo)', categoryId: 'cat-elec', amountXof: 68500, paymentMethod: 'wave', supplier: 'CIE', reference: 'CIE-DEMO-01' }),
  expense(3, -20, { label: 'Facture électricité CIE — saisie en double', categoryId: 'cat-elec', amountXof: 68500, paymentMethod: 'wave', supplier: 'CIE', status: 'cancelled', cancellationReason: 'Doublon de saisie : facture déjà enregistrée (exp-2).' }),
  expense(4, -18, { label: 'Facture eau SODECI (démo)', categoryId: 'cat-eau', amountXof: 21400, paymentMethod: 'wave', supplier: 'SODECI', reference: 'SODECI-DEMO' }),
  expense(5, -15, { label: 'Achat lessive et détachant (démo)', categoryId: 'cat-conso', amountXof: 47200, paymentMethod: 'mtn_momo', supplier: 'Siprochim CI (démo)', reference: 'BL-DEMO-114' }),
  expense(6, -12, { label: 'Réparation machine L2 — courroie (démo)', categoryId: 'cat-maint', amountXof: 35000, paymentMethod: 'cash', supplier: 'Technicien indépendant (démo)' }),
  expense(7, -9, { label: 'Carburant livraisons Cocody / Plateau', categoryId: 'cat-transp', amountXof: 15000, paymentMethod: 'cash' }),
  expense(8, -7, { label: 'Cintres et housses en gros (démo)', categoryId: 'cat-conso', amountXof: 28600, paymentMethod: 'wave', supplier: 'Adjamé grossiste (démo)' }),
  expense(9, -5, { label: 'Avance salaires équipe atelier (démo)', categoryId: 'cat-sal', amountXof: 120000, paymentMethod: 'transfer' }),
  expense(10, -4, { label: 'Papeterie et étiquettes tickets', categoryId: 'cat-admin', amountXof: 9400, paymentMethod: 'cash' }),
  expense(11, -2, { label: 'Crédit appels boutique', categoryId: 'cat-autre', amountXof: 5000, paymentMethod: 'orange_money' }),
  expense(12, -1, { label: 'Course livraison client hôtel (démo)', categoryId: 'cat-transp', amountXof: 4000, paymentMethod: 'cash' }),
  expense(13, 0, { label: 'Achat détachant en urgence', categoryId: 'cat-conso', amountXof: 8600, paymentMethod: 'cash', supplier: 'Quincaillerie Riviera (démo)' }),
];
