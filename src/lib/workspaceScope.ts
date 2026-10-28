/**
 * Portée des données de l'ERP.
 *
 * L'application conserve encore ses données métier dans le navigateur pendant
 * la migration progressive vers Supabase. Deux situations doivent donc rester
 * strictement séparées :
 *
 * - `demo` : démonstration locale explicite, amorcée avec les jeux d'exemple
 *   (`INITIAL_ORDERS`, `INITIAL_CUSTOMERS`, …) ;
 * - `live` : compte réel authentifié et rattaché à une organisation. Rien
 *   n'est inventé : un pressing qui vient d'être créé démarre avec un tableau
 *   de bord vide.
 *
 * La portée réelle est également préfixée par l'identifiant d'organisation
 * dans la persistance locale, afin que deux comptes réels ouverts dans le même
 * navigateur ne partagent jamais leurs saisies, et qu'aucune donnée de
 * démonstration ne puisse « remonter » dans un espace réel.
 */

export type WorkspaceDataScope = 'demo' | 'live';

export interface WorkspaceScope {
  mode: WorkspaceDataScope;
  organizationId: string | null;
  organizationName: string | null;
  shopName: string | null;
}

/** Portée par défaut : démonstration locale, aucun rattachement. */
export const DEMO_WORKSPACE_SCOPE: WorkspaceScope = {
  mode: 'demo',
  organizationId: null,
  organizationName: null,
  shopName: null,
};

const WORKSPACE_STORAGE_ROOT = 'pressingpro_workspace_';

/**
 * Préfixe appliqué aux clés de `localStorage`.
 *
 * Vide en démonstration : les clés historiques (`pressingpro_orders`, …)
 * restent valables pour ne pas perdre les données d'un poste de démonstration.
 * En espace réel, le préfixe contient l'organisation, ce qui isole les comptes
 * entre eux sur un même navigateur.
 */
export const getWorkspaceStoragePrefix = (scope: WorkspaceScope): string => {
  const organizationId = scope.organizationId?.trim();
  if (scope.mode !== 'live' || !organizationId) return '';
  return `${WORKSPACE_STORAGE_ROOT}${organizationId.replace(/[^a-zA-Z0-9-]/g, '')}__`;
};

/** Construit une clé de persistance pour la portée courante. */
export const scopeStorageKey = (scope: WorkspaceScope, key: string): string =>
  `${getWorkspaceStoragePrefix(scope)}${key}`;

export const isLiveWorkspace = (scope: WorkspaceScope): boolean =>
  scope.mode === 'live';

/**
 * Libellé affiché dans la navigation : « Organisation — Agence ».
 *
 * Aucun nom d'exemple n'est utilisé en repli. Tant que le nom serveur n'est pas
 * chargé, l'interface reste neutre plutôt que d'afficher l'enseigne d'un autre
 * pressing.
 */
export const getWorkspaceLabel = (
  scope: WorkspaceScope,
  fallback = 'Espace professionnel'
): string => {
  const organization = scope.organizationName?.trim() ?? '';
  const shop = scope.shopName?.trim() ?? '';
  if (organization && shop && shop !== organization) return `${organization} — ${shop}`;
  return shop || organization || fallback;
};
