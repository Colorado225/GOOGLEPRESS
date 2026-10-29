import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { StorageLocation } from '../../types';
import { INITIAL_STORAGE_LOCATIONS } from '../../data/demoData';
import type { WorkspaceScope } from '../../lib/workspaceScope';
import {
  STORAGE_LOCATIONS_STORAGE_KEY,
  normalizeStorageLocations,
} from '../../lib/storage';
import {
  loadRemoteStorageLocations,
  saveRemoteStorageLocations,
  type StorageSyncState,
} from '../../lib/storageLocationsSync';
import { loadPersistedState, persistState } from '../../lib/localPersistence';
import type { StoragePanelView } from './types';

export interface StorageDeps {
  workspace: WorkspaceScope;
  liveWorkspace: boolean;
  storageKey: (name: string) => string;
}

export interface StorageStore {
  storageLocations: StorageLocation[];
  setStorageLocations: Dispatch<SetStateAction<StorageLocation[]>>;
  storageSync: StorageSyncState;
  retryStorageSync: () => void;
  focusedStorageOrderId: string | null;
  setFocusedStorageOrderId: (orderId: string | null) => void;
  storagePanelViewRequest: StoragePanelView | null;
  setStoragePanelViewRequest: Dispatch<SetStateAction<StoragePanelView | null>>;
}

/**
 * Emplacements physiques des commandes terminées. Le plan proposé par
 * défaut est éditable pour correspondre au local réel ; persistance locale.
 * Plan de rangement : configuration matérielle éditable, conservée dans les
 * deux modes (elle ne contient aucun dossier client ni aucune commande).
 *
 * Synchronisation avec la base (compte réel) : lecture initiale au montage,
 * puis envoi différé (800 ms) à chaque modification, sans renvoyer un plan
 * identique à celui du serveur.
 */
export const useStorageStore = ({
  workspace,
  liveWorkspace,
  storageKey,
}: StorageDeps): StorageStore => {
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(() =>
    normalizeStorageLocations(
      loadPersistedState<unknown>(
        storageKey(STORAGE_LOCATIONS_STORAGE_KEY),
        INITIAL_STORAGE_LOCATIONS
      ),
      INITIAL_STORAGE_LOCATIONS
    )
  );
  const [storageSync, setStorageSync] = useState<StorageSyncState>(() => ({
    status: liveWorkspace ? 'loading' : 'idle',
    error: null,
    savedAt: null,
  }));
  // Dernier état connu du serveur : sert à ne pas renvoyer un plan identique.
  const storageSnapshotRef = useRef(JSON.stringify(storageLocations));
  const storageHydratedRef = useRef(!liveWorkspace);
  const storagePushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushStorageLocations = async (next: readonly StorageLocation[]) => {
    const shopId = workspace.shopId;
    const organizationId = workspace.organizationId;
    if (!liveWorkspace || !shopId || !organizationId) return;
    setStorageSync((previous) => ({ ...previous, status: 'saving', error: null }));
    const result = await saveRemoteStorageLocations({
      shopId,
      organizationId,
      locations: next,
    });
    if (!result.ok) {
      setStorageSync({ status: 'error', error: result.error, savedAt: null });
      return;
    }
    storageSnapshotRef.current = JSON.stringify(next);
    setStorageSync({ status: 'saved', error: null, savedAt: new Date().toISOString() });
  };

  const retryStorageSync = () => {
    if (storagePushTimer.current) {
      clearTimeout(storagePushTimer.current);
      storagePushTimer.current = null;
    }
    void flushStorageLocations(storageLocations);
  };

  useEffect(() => {
    const shopId = workspace.shopId;
    if (!liveWorkspace || !shopId) return;
    let cancelled = false;
    setStorageSync({ status: 'loading', error: null, savedAt: null });
    void (async () => {
      const result = await loadRemoteStorageLocations(shopId, storageLocations);
      if (cancelled) return;
      if (!result.ok) {
        setStorageSync({ status: 'error', error: result.error, savedAt: null });
        storageHydratedRef.current = true;
        return;
      }
      storageHydratedRef.current = true;
      if (result.seeded) {
        // Base encore vide : le plan local devient celui de l'agence.
        await flushStorageLocations(result.locations);
        return;
      }
      setStorageLocations(result.locations);
      storageSnapshotRef.current = JSON.stringify(result.locations);
      setStorageSync({ status: 'saved', error: null, savedAt: new Date().toISOString() });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveWorkspace, workspace.shopId]);

  useEffect(() => {
    if (!liveWorkspace || !workspace.shopId || !storageHydratedRef.current) return;
    const serialized = JSON.stringify(storageLocations);
    if (serialized === storageSnapshotRef.current) return;
    if (storagePushTimer.current) clearTimeout(storagePushTimer.current);
    setStorageSync((previous) => ({ ...previous, status: 'saving', error: null }));
    storagePushTimer.current = setTimeout(() => {
      storagePushTimer.current = null;
      void flushStorageLocations(storageLocations);
    }, 800);
    return () => {
      if (storagePushTimer.current) {
        clearTimeout(storagePushTimer.current);
        storagePushTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageLocations, liveWorkspace, workspace.shopId]);

  useEffect(() => {
    persistState(storageKey(STORAGE_LOCATIONS_STORAGE_KEY), storageLocations);
  }, [storageLocations]);

  const [focusedStorageOrderId, setFocusedStorageOrderId] = useState<string | null>(null);
  const [storagePanelViewRequest, setStoragePanelViewRequest] =
    useState<StoragePanelView | null>(null);

  return {
    storageLocations,
    setStorageLocations,
    storageSync,
    retryStorageSync,
    focusedStorageOrderId,
    setFocusedStorageOrderId,
    storagePanelViewRequest,
    setStoragePanelViewRequest,
  };
};
