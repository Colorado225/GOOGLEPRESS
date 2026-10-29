import type {
  AttendanceRecord,
  CashRegisterData,
  Customer,
  Employee,
  Expense,
  ExpenseCategory,
  InventoryProduct,
  LaundryOrder,
  LogisticsTask,
  StockMovement,
} from '../types';
import type { StaffRole } from './staffAccess';
import type { Json } from './database.types';
import { getSupabaseClient } from './supabase';

/**
 * Sections métier sauvegardées par agence. Le brouillon POS, le panier et les
 * positions GPS éphémères restent volontairement locaux. Les paramètres et les
 * emplacements ont déjà leur synchronisation normalisée dédiée.
 */
export const WORKSPACE_SECTIONS = [
  'customers',
  'orders',
  'cashRegister',
  'nextTicketNumber',
  'logisticsTasks',
  'employees',
  'attendanceRecords',
  'products',
  'stockMovements',
  'expenses',
  'expenseCategories',
] as const;

export type WorkspaceSection = (typeof WORKSPACE_SECTIONS)[number];

export interface WorkspaceSnapshotData {
  customers: Customer[];
  orders: LaundryOrder[];
  cashRegister: CashRegisterData;
  nextTicketNumber: number;
  logisticsTasks: LogisticsTask[];
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  products: InventoryProduct[];
  stockMovements: StockMovement[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
}

export type WorkspaceSnapshotPatch = Partial<WorkspaceSnapshotData>;

export interface WorkspaceSectionPermission {
  read: boolean;
  write: boolean;
}

export type WorkspacePermissions = Record<WorkspaceSection, WorkspaceSectionPermission>;

export interface WorkspaceSnapshotResponse {
  data: WorkspaceSnapshotPatch;
  permissions: WorkspacePermissions;
  version: number;
  updatedAt: string | null;
}

export interface WorkspaceSaveResponse {
  version: number;
  savedAt: string;
  sections: string[];
}

export type WorkspaceSyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

export interface WorkspaceSyncState {
  /** La première lecture (ou son repli local après erreur) est terminée. */
  initialized: boolean;
  status: WorkspaceSyncStatus;
  error: string | null;
  savedAt: string | null;
  version: number;
  /** Au moins une section peut être écrite par ce rôle. */
  writable: boolean;
}

const OWNER_MANAGER: StaffRole[] = ['organization_owner', 'shop_manager'];
const CASH_DESK: StaffRole[] = [...OWNER_MANAGER, 'cashier'];
const OPERATIONS: StaffRole[] = [...CASH_DESK, 'workshop'];
const STOCK_WRITERS: StaffRole[] = [...OWNER_MANAGER, 'workshop'];

const ROLE_RULES: Record<WorkspaceSection, { read: StaffRole[]; write: StaffRole[] }> = {
  customers: { read: CASH_DESK, write: CASH_DESK },
  orders: { read: OPERATIONS, write: OPERATIONS },
  cashRegister: { read: CASH_DESK, write: CASH_DESK },
  nextTicketNumber: { read: CASH_DESK, write: CASH_DESK },
  logisticsTasks: { read: OPERATIONS, write: OPERATIONS },
  employees: { read: OPERATIONS, write: OWNER_MANAGER },
  attendanceRecords: { read: OWNER_MANAGER, write: OWNER_MANAGER },
  products: { read: OPERATIONS, write: OWNER_MANAGER },
  stockMovements: { read: OPERATIONS, write: STOCK_WRITERS },
  expenses: { read: OWNER_MANAGER, write: OWNER_MANAGER },
  expenseCategories: { read: OWNER_MANAGER, write: OWNER_MANAGER },
};

/**
 * Repli local utilisé uniquement pour savoir quelles modifications marquer en
 * attente. La base reste l'autorité : elle revérifie chaque section à l'écriture.
 */
export const getWorkspacePermissions = (role: StaffRole | null | undefined): WorkspacePermissions =>
  Object.fromEntries(
    WORKSPACE_SECTIONS.map((section) => [
      section,
      {
        read: Boolean(role && ROLE_RULES[section].read.includes(role)),
        write: Boolean(role && ROLE_RULES[section].write.includes(role)),
      },
    ])
  ) as WorkspacePermissions;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseWorkspaceSnapshot = (value: unknown): WorkspaceSnapshotResponse => {
  if (!isObject(value) || !isObject(value.data) || !isObject(value.permissions)) {
    throw new Error('La sauvegarde distante a un format illisible.');
  }
  // La RPC renvoie `null` lorsqu'aucune ligne n'existe encore pour l'agence.
  // C'est l'équivalent fonctionnel de la version 0 attendue à la première
  // écriture. PostgREST peut aussi sérialiser un bigint en texte.
  const version =
    value.version === null
      ? 0
      : typeof value.version === 'number'
        ? value.version
        : typeof value.version === 'string' && value.version.trim()
          ? Number(value.version)
          : Number.NaN;
  if (!Number.isInteger(version) || version < 0) {
    throw new Error('La version de la sauvegarde distante est invalide.');
  }
  const fallback = getWorkspacePermissions(null);
  const permissions = Object.fromEntries(
    WORKSPACE_SECTIONS.map((section) => {
      const candidate = (value.permissions as Record<string, unknown>)[section];
      return [
        section,
        isObject(candidate)
          ? { read: candidate.read === true, write: candidate.write === true }
          : fallback[section],
      ];
    })
  ) as WorkspacePermissions;
  return {
    data: value.data as WorkspaceSnapshotPatch,
    permissions,
    version,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
  };
};

export const parseWorkspaceSaveResponse = (value: unknown): WorkspaceSaveResponse => {
  if (!isObject(value) || typeof value.savedAt !== 'string') {
    throw new Error('La confirmation de sauvegarde est illisible.');
  }
  const version =
    typeof value.version === 'number'
      ? value.version
      : typeof value.version === 'string' && value.version.trim()
        ? Number(value.version)
        : Number.NaN;
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('La confirmation de sauvegarde est illisible.');
  }
  return {
    version,
    savedAt: value.savedAt,
    sections: Array.isArray(value.sections)
      ? value.sections.filter((section): section is string => typeof section === 'string')
      : [],
  };
};

export const loadWorkspaceSnapshot = async (shopId: string): Promise<WorkspaceSnapshotResponse> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Le service de sauvegarde Supabase est indisponible.');
  const { data, error } = await client.rpc('get_workspace_snapshot', { target_shop_id: shopId });
  if (error) throw error;
  return parseWorkspaceSnapshot(data);
};

export const saveWorkspaceSnapshot = async (
  shopId: string,
  patch: WorkspaceSnapshotPatch,
  expectedVersion: number
): Promise<WorkspaceSaveResponse> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Le service de sauvegarde Supabase est indisponible.');
  const { data, error } = await client.rpc('save_workspace_snapshot', {
    target_shop_id: shopId,
    patch: patch as unknown as Json,
    expected_version: expectedVersion,
  });
  if (error) throw error;
  return parseWorkspaceSaveResponse(data);
};

export const isWorkspaceVersionConflict = (error: unknown): boolean => {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  return (
    candidate?.code === 'P0002' ||
    (typeof candidate?.message === 'string' && candidate.message.includes('Conflit de version'))
  );
};

export const getWorkspaceSyncErrorMessage = (error: unknown): string => {
  if (isWorkspaceVersionConflict(error)) {
    return 'Une autre session a enregistré des modifications. Utilisez « Réessayer » pour fusionner la copie locale avec la dernière version.';
  }
  const candidate = error as { message?: unknown } | null;
  if (typeof candidate?.message === 'string' && candidate.message.trim()) {
    return candidate.message;
  }
  return 'La sauvegarde distante est momentanément indisponible. Vos données restent conservées sur cet appareil.';
};
