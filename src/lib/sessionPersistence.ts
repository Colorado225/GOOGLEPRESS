import { scopeStorageKey, type WorkspaceScope } from './workspaceScope';

/** Données appartenant à la session de travail, et non au fichier métier. */
export const POS_DRAFT_STORAGE_KEY = 'pressingpro_pos_draft';
export const POS_CART_STORAGE_KEY = 'pressingpro_pos_cart';

const SESSION_STORAGE_KEYS = [POS_DRAFT_STORAGE_KEY, POS_CART_STORAGE_KEY] as const;

export interface SessionStorage {
  removeItem(key: string): void;
}

/**
 * Efface uniquement le travail non validé de la session qui se termine.
 *
 * Les commandes, clients, paramètres et autres enregistrements métier ne sont
 * volontairement pas touchés. La portée d'organisation évite également de
 * supprimer le brouillon d'une autre organisation sur le même navigateur.
 * Retourne false si le navigateur refuse au moins une suppression.
 */
export function clearWorkspaceSessionPersistence(
  workspace: WorkspaceScope,
  storage?: SessionStorage
): boolean {
  const target =
    storage ?? (typeof localStorage === 'undefined' ? null : localStorage);
  if (!target) return false;

  let cleared = true;
  for (const key of SESSION_STORAGE_KEYS) {
    try {
      target.removeItem(scopeStorageKey(workspace, key));
    } catch (error) {
      cleared = false;
      console.warn('Session storage cleanup error', error);
    }
  }
  return cleared;
}
