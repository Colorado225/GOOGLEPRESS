import { describe, expect, it } from 'vitest';
import {
  getWorkspacePermissions,
  isWorkspaceVersionConflict,
  parseWorkspaceSaveResponse,
  parseWorkspaceSnapshot,
  WORKSPACE_SECTIONS,
} from '../../src/lib/workspaceSync';

describe('workspaceSync permissions', () => {
  it('autorise toutes les sections au propriétaire', () => {
    const permissions = getWorkspacePermissions('organization_owner');
    for (const section of WORKSPACE_SECTIONS) {
      expect(permissions[section]).toEqual({ read: true, write: true });
    }
  });

  it('limite la caisse à ses écritures et masque les dépenses', () => {
    const permissions = getWorkspacePermissions('cashier');
    expect(permissions.customers).toEqual({ read: true, write: true });
    expect(permissions.orders).toEqual({ read: true, write: true });
    expect(permissions.cashRegister).toEqual({ read: true, write: true });
    expect(permissions.employees).toEqual({ read: true, write: false });
    expect(permissions.products).toEqual({ read: true, write: false });
    expect(permissions.expenses).toEqual({ read: false, write: false });
    expect(permissions.attendanceRecords).toEqual({ read: false, write: false });
  });

  it('autorise l’atelier sur les commandes et mouvements, sans CRM', () => {
    const permissions = getWorkspacePermissions('workshop');
    expect(permissions.orders.write).toBe(true);
    expect(permissions.logisticsTasks.write).toBe(true);
    expect(permissions.stockMovements.write).toBe(true);
    expect(permissions.products.write).toBe(false);
    expect(permissions.customers.read).toBe(false);
    expect(permissions.expenses.read).toBe(false);
  });

  it('ne donne aucun accès de sauvegarde générique au coursier ou à un rôle inconnu', () => {
    for (const permissions of [getWorkspacePermissions('courier'), getWorkspacePermissions(null)]) {
      for (const section of WORKSPACE_SECTIONS) {
        expect(permissions[section]).toEqual({ read: false, write: false });
      }
    }
  });
});

describe('workspaceSync réponses RPC', () => {
  it('lit une sauvegarde et filtre les permissions mal formées', () => {
    const result = parseWorkspaceSnapshot({
      version: 7,
      updatedAt: '2026-10-29T12:00:00Z',
      data: { orders: [{ id: 'legacy-order-1', ticketNumber: 42 }] },
      permissions: {
        orders: { read: true, write: true },
        customers: { read: 'yes', write: true },
        expenses: null,
      },
    });
    expect(result.version).toBe(7);
    expect(result.data.orders?.[0]).toEqual({ id: 'legacy-order-1', ticketNumber: 42 });
    expect(result.permissions.orders).toEqual({ read: true, write: true });
    expect(result.permissions.customers).toEqual({ read: false, write: true });
    expect(result.permissions.expenses).toEqual({ read: false, write: false });
  });

  it('interprète une version nulle comme la première sauvegarde de l’agence', () => {
    const result = parseWorkspaceSnapshot({
      data: { orders: [] },
      permissions: { orders: { read: true, write: true } },
      version: null,
      updatedAt: null,
    });
    expect(result.version).toBe(0);
    expect(result.updatedAt).toBeNull();
  });

  it('normalise un compteur bigint sérialisé en texte', () => {
    const result = parseWorkspaceSnapshot({
      data: {},
      permissions: {},
      version: '12',
    });
    expect(result.version).toBe(12);
  });

  it('refuse une sauvegarde sans version entière valide', () => {
    expect(() => parseWorkspaceSnapshot({ data: {}, permissions: {}, version: -1 })).toThrow(
      /version/i
    );
    expect(() =>
      parseWorkspaceSnapshot({ data: {}, permissions: {}, version: 'pas-une-version' })
    ).toThrow(/version/i);
  });

  it('refuse une réponse RPC qui ne contient pas de données', () => {
    expect(() => parseWorkspaceSnapshot({ version: 1 })).toThrow(/format illisible/i);
  });

  it('lit la confirmation de version et les sections enregistrées', () => {
    expect(
      parseWorkspaceSaveResponse({
        version: '8',
        savedAt: '2026-10-29T12:05:00Z',
        sections: ['orders', 42, 'customers'],
      })
    ).toEqual({
      version: 8,
      savedAt: '2026-10-29T12:05:00Z',
      sections: ['orders', 'customers'],
    });
  });

  it('détecte le conflit PostgreSQL sans confondre les autres erreurs', () => {
    expect(isWorkspaceVersionConflict({ code: 'P0002' })).toBe(true);
    expect(isWorkspaceVersionConflict({ message: 'Conflit de version : rechargez' })).toBe(true);
    expect(isWorkspaceVersionConflict({ code: '42501', message: 'Accès refusé' })).toBe(false);
  });
});
