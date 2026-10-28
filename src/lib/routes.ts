import {
  isCustomerPath,
  parseCustomerRoute,
  type CustomerRoute,
} from './customerAuth';
import {
  STAFF_LOGIN_PATH,
  parseLegalRoute,
  parseStaffRoute,
  type LegalRoute,
  type StaffRoute,
} from './staffAuth';
import type { ScreenId } from '../context/AppContext';

/**
 * Table des routes de l'application, organisée par contexte d'implémentation :
 *
 * 1. **Espace client** (`/client/*`, alias hérité `/espace-client/*`) —
 *    public, hors shell ERP, défini dans `customerAuth.ts`.
 * 2. **Pages légales** (`/conditions`, `/confidentialite`) — publiques et
 *    statiques, définies dans `staffAuth.ts`.
 * 3. **Accès du personnel** (`/connexion`, `/inscription`, `/bienvenue`) —
 *    public, hors `AppProvider`, défini dans `staffAuth.ts`.
 * 4. **ERP connecté** — les dix écrans métier derrière `StaffAccessGate`,
 *    adressables par des URL françaises stables (voir `ERP_ROUTES`).
 *
 * `resolveAppRoute` centralise la précédence entre ces contextes ;
 * `parseErpRoute`/`erpPathForScreen` font le lien URL ⇄ écran pour l'ERP.
 * Les sous-onglets d'un écran (production/rangement/livraisons dans
 * l'atelier, onglets des paramètres) restent des vues internes à leur
 * écran et n'ont volontairement pas d'URL propre.
 */

const trimTrailingSlashes = (pathname: string): string =>
  pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

/* ------------------------------------------------------------------------- */
/* ERP connecté                                                              */
/* ------------------------------------------------------------------------- */

export interface ErpRouteDefinition {
  screen: ScreenId;
  /** Chemin canonique (celui écrit dans l'URL lors d'une navigation interne). */
  path: string;
  /** Chemins acceptés en lecture (liens profonds, historique) sans réécriture. */
  aliases: readonly string[];
  /** Libellé de l'écran, aligné sur la barre de navigation. */
  label: string;
}

/**
 * Écrans de l'ERP dans l'ordre du workflow d'un pressing : pilotage,
 * réception du dépôt, production, suivi des commandes, puis gestion
 * (clients, personnel, stocks, dépenses, rapports, paramètres).
 */
export const ERP_ROUTES: readonly ErpRouteDefinition[] = [
  { screen: 'dashboard', path: '/', aliases: ['/tableau-de-bord'], label: 'Tableau de bord' },
  { screen: 'pos', path: '/reception', aliases: [], label: 'Réception (POS)' },
  { screen: 'workshop', path: '/atelier', aliases: [], label: 'Production & Suivi' },
  { screen: 'orders', path: '/commandes', aliases: [], label: 'Commandes' },
  { screen: 'clients', path: '/clients', aliases: [], label: 'Clients' },
  { screen: 'employees', path: '/personnel', aliases: [], label: 'Personnel' },
  { screen: 'inventory', path: '/stocks', aliases: [], label: 'Stocks' },
  { screen: 'expenses', path: '/depenses', aliases: [], label: 'Dépenses' },
  { screen: 'reports', path: '/rapports', aliases: [], label: 'Rapports' },
  { screen: 'settings', path: '/parametres', aliases: [], label: 'Paramètres' },
];

export const ERP_HOME_PATH = '/';
export const ERP_NOT_FOUND_TITLE = 'Page introuvable — PressingPro CI';

const erpRouteByPath = new Map<string, ErpRouteDefinition>(
  ERP_ROUTES.flatMap((route) => [
    [route.path, route] as const,
    ...route.aliases.map((alias) => [alias, route] as const),
  ])
);

const erpRouteByScreen = new Map<ScreenId, ErpRouteDefinition>(
  ERP_ROUTES.map((route) => [route.screen, route])
);

/**
 * Écran ERP désigné par un chemin, ou `null` si le chemin n'est pas une
 * route ERP connue (l'appelant affiche alors « Page introuvable » dans le
 * shell ERP, au lieu de retomber silencieusement sur le tableau de bord).
 */
export const parseErpRoute = (pathname: string): ScreenId | null => {
  const normalized = trimTrailingSlashes(pathname || '/');
  return erpRouteByPath.get(normalized)?.screen ?? null;
};

/** Chemin canonique d'un écran ERP (utilisé pour écrire l'URL). */
export const erpPathForScreen = (screen: ScreenId): string =>
  erpRouteByScreen.get(screen)?.path ?? ERP_HOME_PATH;

/** Titre d'onglet/document d'un écran ERP. */
export const getErpScreenTitle = (screen: ScreenId): string => {
  const label = erpRouteByScreen.get(screen)?.label ?? 'PressingPro CI';
  return `${label} — PressingPro CI`;
};

/* ------------------------------------------------------------------------- */
/* Résolution du contexte d'application                                     */
/* ------------------------------------------------------------------------- */

export type AppRoute =
  | { context: 'customer'; route: CustomerRoute }
  | { context: 'legal'; route: LegalRoute }
  | { context: 'staff'; route: StaffRoute }
  | { context: 'erp' };

/**
 * Contexte d'implémentation d'un chemin, dans l'ordre de précédence de
 * l'application : espace client, pages légales, accès du personnel, puis
 * ERP (protégé par la garde) pour tout le reste.
 */
export const resolveAppRoute = (pathname: string): AppRoute => {
  if (isCustomerPath(pathname)) {
    return { context: 'customer', route: parseCustomerRoute(pathname) };
  }
  const legalRoute = parseLegalRoute(pathname);
  if (legalRoute) return { context: 'legal', route: legalRoute };
  const staffRoute = parseStaffRoute(pathname);
  if (staffRoute) return { context: 'staff', route: staffRoute };
  return { context: 'erp' };
};

/* ------------------------------------------------------------------------- */
/* Retour après connexion (lien profond vers un écran ERP)                   */
/* ------------------------------------------------------------------------- */

export const STAFF_RETURN_PARAM = 'retour';

/**
 * Destination « retour » demandée sur la page de connexion. La valeur est
 * validée par liste blanche : seuls les chemins canoniques des écrans ERP
 * sont acceptés, jamais une URL absolue ou un chemin d'un autre contexte —
 * aucune redirection ouverte n'est possible par ce paramètre.
 */
export const resolveStaffReturnPath = (search: string): string | null => {
  const raw = new URLSearchParams(search).get(STAFF_RETURN_PARAM);
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return null;
  }
  const screen = parseErpRoute(raw);
  if (!screen) return null;
  return erpPathForScreen(screen);
};

/**
 * URL de la page de connexion pour un visiteur non authentifié arrivé sur
 * un écran ERP : conserve la destination métier (hors page d'accueil) afin
 * de l'y ramener après connexion réussie.
 */
export const getStaffLoginRedirectPath = (pathname: string): string => {
  const screen = parseErpRoute(pathname);
  if (!screen || screen === 'dashboard') return STAFF_LOGIN_PATH;
  const returnPath = erpPathForScreen(screen);
  return `${STAFF_LOGIN_PATH}?${STAFF_RETURN_PARAM}=${encodeURIComponent(returnPath)}`;
};
