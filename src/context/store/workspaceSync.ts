import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StaffRole } from '../../lib/staffAccess';
import { cashRegisterNeedsRepair, normalizeCashRegister } from '../../lib/cashRegister';
import {
  getWorkspacePermissions,
  getWorkspaceSyncErrorMessage,
  loadWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  WORKSPACE_SECTIONS,
  type WorkspaceSection,
  type WorkspacePermissions,
  type WorkspaceSnapshotData,
  type WorkspaceSnapshotPatch,
  type WorkspaceSnapshotResponse,
  type WorkspaceSyncState,
} from '../../lib/workspaceSync';

export interface WorkspaceSyncSetters {
  customers: (value: WorkspaceSnapshotData['customers']) => void;
  orders: (value: WorkspaceSnapshotData['orders']) => void;
  cashRegister: (value: WorkspaceSnapshotData['cashRegister']) => void;
  nextTicketNumber: (value: WorkspaceSnapshotData['nextTicketNumber']) => void;
  logisticsTasks: (value: WorkspaceSnapshotData['logisticsTasks']) => void;
  employees: (value: WorkspaceSnapshotData['employees']) => void;
  attendanceRecords: (value: WorkspaceSnapshotData['attendanceRecords']) => void;
  products: (value: WorkspaceSnapshotData['products']) => void;
  stockMovements: (value: WorkspaceSnapshotData['stockMovements']) => void;
  expenses: (value: WorkspaceSnapshotData['expenses']) => void;
  expenseCategories: (value: WorkspaceSnapshotData['expenseCategories']) => void;
}

export interface WorkspaceSyncDeps {
  enabled: boolean;
  shopId: string | null;
  role: StaffRole | null;
  storageKey: (name: string) => string;
  data: WorkspaceSnapshotData;
  setters: WorkspaceSyncSetters;
}

interface WorkspaceSyncMeta {
  version: number;
  dirtySections: WorkspaceSection[];
}

const EMPTY_META: WorkspaceSyncMeta = { version: 0, dirtySections: [] };

const readMeta = (key: string): WorkspaceSyncMeta => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY_META;
    const value = JSON.parse(raw) as Partial<WorkspaceSyncMeta>;
    return {
      version:
        typeof value.version === 'number' && Number.isInteger(value.version) && value.version >= 0
          ? value.version
          : 0,
      dirtySections: Array.isArray(value.dirtySections)
        ? value.dirtySections.filter((section): section is WorkspaceSection =>
            WORKSPACE_SECTIONS.includes(section as WorkspaceSection)
          )
        : [],
    };
  } catch {
    return EMPTY_META;
  }
};

const applySection = (
  setters: WorkspaceSyncSetters,
  section: WorkspaceSection,
  value: WorkspaceSnapshotData[WorkspaceSection],
  fallback?: WorkspaceSnapshotData[WorkspaceSection]
) => {
  switch (section) {
    case 'customers':
      setters.customers(value as WorkspaceSnapshotData['customers']);
      break;
    case 'orders':
      setters.orders(value as WorkspaceSnapshotData['orders']);
      break;
    case 'cashRegister':
      setters.cashRegister(normalizeCashRegister(value, fallback));
      break;
    case 'nextTicketNumber':
      setters.nextTicketNumber(value as WorkspaceSnapshotData['nextTicketNumber']);
      break;
    case 'logisticsTasks':
      setters.logisticsTasks(value as WorkspaceSnapshotData['logisticsTasks']);
      break;
    case 'employees':
      setters.employees(value as WorkspaceSnapshotData['employees']);
      break;
    case 'attendanceRecords':
      setters.attendanceRecords(value as WorkspaceSnapshotData['attendanceRecords']);
      break;
    case 'products':
      setters.products(value as WorkspaceSnapshotData['products']);
      break;
    case 'stockMovements':
      setters.stockMovements(value as WorkspaceSnapshotData['stockMovements']);
      break;
    case 'expenses':
      setters.expenses(value as WorkspaceSnapshotData['expenses']);
      break;
    case 'expenseCategories':
      setters.expenseCategories(value as WorkspaceSnapshotData['expenseCategories']);
      break;
  }
};

/**
 * Restaure puis sauvegarde les sections métier d'une agence réelle.
 *
 * La copie locale reste toujours écrite par les magasins existants. Un marqueur
 * de sections « dirty » survit donc à une fermeture hors ligne ; à la reconnexion
 * seules ces sections sont privilégiées face à la copie distante.
 */
export const useWorkspaceSyncStore = ({
  enabled,
  shopId,
  role,
  storageKey,
  data,
  setters,
}: WorkspaceSyncDeps) => {
  const metaKey = storageKey('pressingpro_workspace_sync_meta');
  const [syncState, setSyncState] = useState<WorkspaceSyncState>({
    initialized: !enabled,
    status: enabled ? 'loading' : 'idle',
    error: null,
    savedAt: null,
    version: 0,
    writable: false,
  });

  const dataRef = useRef(data);
  dataRef.current = data;
  const settersRef = useRef(setters);
  settersRef.current = setters;

  const serialized = useMemo(
    () =>
      Object.fromEntries(
        WORKSPACE_SECTIONS.map((section) => [section, JSON.stringify(data[section])])
      ) as Record<WorkspaceSection, string>,
    [
      data.customers,
      data.orders,
      data.cashRegister,
      data.nextTicketNumber,
      data.logisticsTasks,
      data.employees,
      data.attendanceRecords,
      data.products,
      data.stockMovements,
      data.expenses,
      data.expenseCategories,
    ]
  );
  const serializedRef = useRef(serialized);
  serializedRef.current = serialized;

  const fallbackPermissions = useMemo(() => getWorkspacePermissions(role), [role]);
  const permissionsRef = useRef<WorkspacePermissions>(fallbackPermissions);
  const acknowledgedRef = useRef<Partial<Record<WorkspaceSection, string>>>({});
  const dirtyRef = useRef<Set<WorkspaceSection>>(new Set());
  const versionRef = useRef(0);
  const hasRemoteRef = useRef(false);
  const initializedRef = useRef(!enabled);
  const generationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const flushRef = useRef<() => Promise<boolean>>(async () => false);

  const persistMeta = useCallback(() => {
    try {
      const meta: WorkspaceSyncMeta = {
        version: versionRef.current,
        dirtySections: [...dirtyRef.current],
      };
      window.localStorage.setItem(metaKey, JSON.stringify(meta));
    } catch {
      // Les magasins métier restent persistés même si ce seul marqueur ne tient pas.
    }
  }, [metaKey]);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flushRef.current();
    }, 450);
  }, []);

  const applyRemote = useCallback(
    (snapshot: WorkspaceSnapshotResponse) => {
      permissionsRef.current = snapshot.permissions;
      versionRef.current = snapshot.version;
      hasRemoteRef.current = true;
      const currentData = dataRef.current;
      const currentSerialized = serializedRef.current;
      const dirty = dirtyRef.current;
      let needsSave = snapshot.version === 0;

      if (snapshot.version === 0) {
        // Premier compte réel : les enregistrements locaux existants deviennent
        // la première sauvegarde, sans changer leurs identifiants ni leurs liens.
        for (const section of WORKSPACE_SECTIONS) {
          acknowledgedRef.current[section] = currentSerialized[section];
          if (snapshot.permissions[section].write) {
            dirty.add(section);
            delete acknowledgedRef.current[section];
          }
        }
      } else {
        for (const section of WORKSPACE_SECTIONS) {
          const permission = snapshot.permissions[section];
          const remoteValue = snapshot.data[section];
          if (!permission.read || remoteValue === undefined) {
            acknowledgedRef.current[section] = currentSerialized[section];
            continue;
          }

          if (dirty.has(section) && permission.write) {
            // Une modification hors ligne est conservée et sera enregistrée avec
            // la version distante qui vient d'être relue.
            applySection(settersRef.current, section, currentData[section]);
            delete acknowledgedRef.current[section];
            needsSave = true;
          } else {
            const normalizedValue =
              section === 'cashRegister'
                ? normalizeCashRegister(remoteValue, currentData.cashRegister)
                : remoteValue;
            applySection(
              settersRef.current,
              section,
              normalizedValue,
              currentData[section]
            );
            if (
              section === 'cashRegister' &&
              permission.write &&
              cashRegisterNeedsRepair(remoteValue)
            ) {
              // Une ancienne caisse partielle est réparée puis réenregistrée ;
              // les montants déjà valides sont conservés par la normalisation.
              dirty.add(section);
              delete acknowledgedRef.current[section];
              needsSave = true;
            } else {
              acknowledgedRef.current[section] = JSON.stringify(normalizedValue);
            }
          }
        }
      }

      initializedRef.current = true;
      persistMeta();
      const writable = WORKSPACE_SECTIONS.some((section) => snapshot.permissions[section].write);
      setSyncState({
        initialized: true,
        status: writable ? (needsSave ? 'saving' : 'saved') : 'idle',
        error: null,
        savedAt: snapshot.updatedAt,
        version: snapshot.version,
        writable,
      });
      if (needsSave && writable) scheduleFlush();
    },
    [persistMeta, scheduleFlush]
  );

  const loadRemote = useCallback(async (): Promise<boolean> => {
    if (!enabled || !shopId) return true;
    const generation = generationRef.current;
    setSyncState((previous) => ({
      ...previous,
      status: 'loading',
      error: null,
    }));
    try {
      const snapshot = await loadWorkspaceSnapshot(shopId);
      if (generation !== generationRef.current) return false;
      applyRemote(snapshot);
      return true;
    } catch (error) {
      if (generation !== generationRef.current) return false;
      if (!initializedRef.current) {
        // Mode hors ligne : ouvrir la copie locale, sans prétendre qu'elle est
        // synchronisée. Les prochaines modifications seront marquées dirty.
        permissionsRef.current = fallbackPermissions;
        acknowledgedRef.current = { ...serializedRef.current };
        initializedRef.current = true;
      }
      setSyncState((previous) => ({
        ...previous,
        initialized: true,
        status: 'error',
        error: getWorkspaceSyncErrorMessage(error),
        writable: WORKSPACE_SECTIONS.some((section) => permissionsRef.current[section].write),
      }));
      return false;
    }
  }, [applyRemote, enabled, fallbackPermissions, shopId]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (!enabled || !shopId || !initializedRef.current) return true;
    if (inFlightRef.current) return inFlightRef.current;
    if (!hasRemoteRef.current) return false;

    const permissions = permissionsRef.current;
    const patch: WorkspaceSnapshotPatch = {};
    const sent: Partial<Record<WorkspaceSection, string>> = {};
    for (const section of WORKSPACE_SECTIONS) {
      if (!permissions[section].write) continue;
      const current = serializedRef.current[section];
      if (acknowledgedRef.current[section] === current && !dirtyRef.current.has(section)) continue;
      if (acknowledgedRef.current[section] === current && dirtyRef.current.has(section)) {
        dirtyRef.current.delete(section);
        continue;
      }
      Object.assign(patch, { [section]: dataRef.current[section] });
      sent[section] = current;
    }

    if (Object.keys(patch).length === 0) {
      persistMeta();
      const writable = WORKSPACE_SECTIONS.some((section) => permissions[section].write);
      setSyncState((previous) => ({
        ...previous,
        initialized: true,
        status: writable ? 'saved' : 'idle',
        error: null,
        version: versionRef.current,
        writable,
      }));
      return true;
    }

    const generation = generationRef.current;
    const operation = (async () => {
      setSyncState((previous) => ({ ...previous, status: 'saving', error: null }));
      try {
        const response = await saveWorkspaceSnapshot(shopId, patch, versionRef.current);
        if (generation !== generationRef.current) return false;
        hasRemoteRef.current = true;
        versionRef.current = response.version;
        for (const section of Object.keys(sent) as WorkspaceSection[]) {
          const sentValue = sent[section];
          if (sentValue === undefined) continue;
          acknowledgedRef.current[section] = sentValue;
          if (serializedRef.current[section] === sentValue) dirtyRef.current.delete(section);
        }
        persistMeta();
        const stillPending = WORKSPACE_SECTIONS.some(
          (section) => permissionsRef.current[section].write && dirtyRef.current.has(section)
        );
        setSyncState((previous) => ({
          ...previous,
          initialized: true,
          status: stillPending ? 'saving' : 'saved',
          error: null,
          savedAt: response.savedAt,
          version: response.version,
          writable: true,
        }));
        if (stillPending) scheduleFlush();
        return true;
      } catch (error) {
        if (generation !== generationRef.current) return false;
        persistMeta();
        setSyncState((previous) => ({
          ...previous,
          initialized: true,
          status: 'error',
          error: getWorkspaceSyncErrorMessage(error),
        }));
        return false;
      }
    })();
    inFlightRef.current = operation;
    try {
      return await operation;
    } finally {
      if (inFlightRef.current === operation) inFlightRef.current = null;
    }
  }, [enabled, persistMeta, scheduleFlush, shopId]);
  flushRef.current = flush;

  // Réinitialisation complète quand le compte ou l'agence change.
  useEffect(() => {
    generationRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    inFlightRef.current = null;
    acknowledgedRef.current = {};
    permissionsRef.current = fallbackPermissions;
    hasRemoteRef.current = false;

    if (!enabled || !shopId) {
      initializedRef.current = true;
      dirtyRef.current = new Set();
      versionRef.current = 0;
      setSyncState({
        initialized: true,
        status: 'idle',
        error: null,
        savedAt: null,
        version: 0,
        writable: false,
      });
      return;
    }

    const meta = readMeta(metaKey);
    dirtyRef.current = new Set(meta.dirtySections);
    versionRef.current = meta.version;
    initializedRef.current = false;
    setSyncState({
      initialized: false,
      status: 'loading',
      error: null,
      savedAt: null,
      version: meta.version,
      writable: WORKSPACE_SECTIONS.some((section) => fallbackPermissions[section].write),
    });
    void loadRemote();

    return () => {
      generationRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    // loadRemote est recréé avec la même portée que cet effet.
  }, [enabled, fallbackPermissions, loadRemote, metaKey, shopId]);

  // Marque immédiatement toute évolution locale, même si le réseau est coupé.
  useEffect(() => {
    if (!enabled || !initializedRef.current) return;
    let changed = false;
    for (const section of WORKSPACE_SECTIONS) {
      if (!permissionsRef.current[section].write) continue;
      if (acknowledgedRef.current[section] !== serialized[section]) {
        if (!dirtyRef.current.has(section)) changed = true;
        dirtyRef.current.add(section);
      }
    }
    if (changed) {
      persistMeta();
      setSyncState((previous) => ({ ...previous, status: 'saving', error: null }));
      scheduleFlush();
    }
  }, [enabled, persistMeta, scheduleFlush, serialized]);

  const retryWorkspaceSync = useCallback(() => {
    void (async () => {
      const loaded = await loadRemote();
      if (loaded) await flushRef.current();
    })();
  }, [loadRemote]);

  const flushWorkspaceSync = useCallback(async (): Promise<boolean> => {
    if (!enabled) return true;
    if (!hasRemoteRef.current) {
      const loaded = await loadRemote();
      if (!loaded) return false;
    }
    return flushRef.current();
  }, [enabled, loadRemote]);

  return { workspaceSync: syncState, retryWorkspaceSync, flushWorkspaceSync };
};
