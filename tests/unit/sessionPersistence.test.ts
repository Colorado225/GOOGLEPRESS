import { describe, expect, it, vi } from 'vitest';
import {
  clearWorkspaceSessionPersistence,
  POS_CART_STORAGE_KEY,
  POS_DRAFT_STORAGE_KEY,
} from '../../src/lib/sessionPersistence';
import {
  DEMO_WORKSPACE_SCOPE,
  scopeStorageKey,
  type WorkspaceScope,
} from '../../src/lib/workspaceScope';

class MemoryStorage {
  readonly values = new Map<string, string>();

  removeItem(key: string): void {
    this.values.delete(key);
  }

  seed(key: string, value = 'présent'): void {
    this.values.set(key, value);
  }

  has(key: string): boolean {
    return this.values.has(key);
  }
}

const liveScope = (organizationId = 'org-1'): WorkspaceScope => ({
  mode: 'live',
  organizationId,
  shopId: 'shop-1',
  organizationName: 'Organisation',
  shopName: 'Agence',
  userName: 'Utilisateur',
  userRoleLabel: 'Propriétaire',
});

describe('persistance de la session de travail', () => {
  it('efface le brouillon et le panier de la seule organisation déconnectée', () => {
    const storage = new MemoryStorage();
    const current = liveScope('org-current');
    const other = liveScope('org-other');
    const draftKey = scopeStorageKey(current, POS_DRAFT_STORAGE_KEY);
    const cartKey = scopeStorageKey(current, POS_CART_STORAGE_KEY);
    const ordersKey = scopeStorageKey(current, 'pressingpro_orders');
    const otherDraftKey = scopeStorageKey(other, POS_DRAFT_STORAGE_KEY);

    storage.seed(draftKey);
    storage.seed(cartKey);
    storage.seed(ordersKey);
    storage.seed(otherDraftKey);
    storage.seed(scopeStorageKey(DEMO_WORKSPACE_SCOPE, POS_DRAFT_STORAGE_KEY));

    expect(clearWorkspaceSessionPersistence(current, storage)).toBe(true);
    expect(storage.has(draftKey)).toBe(false);
    expect(storage.has(cartKey)).toBe(false);
    expect(storage.has(ordersKey)).toBe(true);
    expect(storage.has(otherDraftKey)).toBe(true);
    expect(storage.has(scopeStorageKey(DEMO_WORKSPACE_SCOPE, POS_DRAFT_STORAGE_KEY))).toBe(
      true
    );
  });

  it('utilise les clés historiques pour une déconnexion de démonstration', () => {
    const storage = new MemoryStorage();
    storage.seed(POS_DRAFT_STORAGE_KEY);
    storage.seed(POS_CART_STORAGE_KEY);
    storage.seed('pressingpro_customers');

    expect(clearWorkspaceSessionPersistence(DEMO_WORKSPACE_SCOPE, storage)).toBe(true);
    expect(storage.has(POS_DRAFT_STORAGE_KEY)).toBe(false);
    expect(storage.has(POS_CART_STORAGE_KEY)).toBe(false);
    expect(storage.has('pressingpro_customers')).toBe(true);
  });

  it('signale un refus du stockage sans interrompre la déconnexion', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const storage = {
      removeItem: () => {
        throw new Error('Stockage refusé');
      },
    };

    expect(clearWorkspaceSessionPersistence(liveScope(), storage)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
