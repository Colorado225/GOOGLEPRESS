import { describe, expect, it } from 'vitest';
import {
  planStorageLocationSync,
  rowToLocalStorageLocation,
  rowToStorageLocation,
  type RemoteStorageLocationRow,
} from '../../src/lib/storageLocationsSync';
import type { StorageLocation } from '../../src/types';

const local = (overrides: Partial<StorageLocation> = {}): StorageLocation => ({
  id: 'loc-a01',
  code: 'A-01',
  label: 'Portant A-01',
  zone: 'hanging',
  capacityPackages: 20,
  description: '',
  isActive: true,
  ...overrides,
});

const remote = (overrides: Partial<RemoteStorageLocationRow> = {}): RemoteStorageLocationRow => ({
  id: 'db-1',
  legacyId: 'loc-a01',
  code: 'A-01',
  label: 'Portant A-01',
  zone: 'hanging',
  capacityPackages: 20,
  description: undefined,
  isActive: true,
  ...overrides,
});

describe('rowToStorageLocation', () => {
  it('lit une ligne complète et retombe sur le code pour le libellé', () => {
    const row = rowToStorageLocation({
      id: 'db-1',
      legacy_id: 'loc-a01',
      code: 'A-01',
      label: null,
      zone: 'folding',
      capacity_packages: 0,
      is_active: true,
    });
    expect(row).toMatchObject({
      legacyId: 'loc-a01',
      code: 'A-01',
      label: 'A-01',
      // Zone inconnue → « other », capacité bornée à 1.
      zone: 'other',
      capacityPackages: 1,
      isActive: true,
    });
  });

  it('refuse une ligne sans code ou sans identifiant', () => {
    expect(rowToStorageLocation({ id: 'db-1', code: '' })).toBeNull();
    expect(rowToStorageLocation({ code: 'A-01' })).toBeNull();
    expect(rowToStorageLocation(null)).toBeNull();
  });

  it('réutilise l’identifiant local quand il existe', () => {
    expect(rowToLocalStorageLocation(remote()).id).toBe('loc-a01');
    expect(rowToLocalStorageLocation(remote({ legacyId: null })).id).toBe('db-1');
  });
});

describe('planStorageLocationSync', () => {
  it('ne fait rien quand tout est identique', () => {
    const plan = planStorageLocationSync([local()], [remote()]);
    expect(plan).toEqual({ toInsert: [], toUpdate: [], toDeactivate: [] });
  });

  it('crée les casiers absents et modifie ceux qui ont changé', () => {
    const plan = planStorageLocationSync(
      [local({ capacityPackages: 30 }), local({ id: 'loc-b01', code: 'B-01', label: 'Bac B-01' })],
      [remote()]
    );
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0].dbId).toBe('db-1');
    expect(plan.toUpdate[0].location.capacityPackages).toBe(30);
    expect(plan.toInsert.map((entry) => entry.code)).toEqual(['B-01']);
    expect(plan.toDeactivate).toEqual([]);
  });

  it('désactive les casiers retirés du plan local au lieu de les supprimer', () => {
    const plan = planStorageLocationSync(
      [],
      [remote(), remote({ id: 'db-2', legacyId: 'loc-b01', code: 'B-01', isActive: false })]
    );
    expect(plan.toDeactivate).toEqual(['db-1']);
    expect(plan.toInsert).toEqual([]);
  });

  it('retrouve une ligne par son code quand legacy_id manque', () => {
    const plan = planStorageLocationSync(
      [local({ code: 'a-01' })],
      [remote({ legacyId: null })]
    );
    expect(plan.toInsert).toEqual([]);
    expect(plan.toDeactivate).toEqual([]);
  });
});
