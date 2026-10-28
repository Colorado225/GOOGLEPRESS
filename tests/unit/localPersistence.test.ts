import { describe, expect, it, vi } from 'vitest';
import {
  createLocalId,
  loadPersistedState,
  parseTicketNumber,
  persistState,
  type JsonStorage,
} from '../../src/lib/localPersistence';

class MemoryStorage implements JsonStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('localPersistence', () => {
  it('extrait le numéro final d’un ticket', () => {
    expect(parseTicketNumber('#TK-2854')).toBe(2854);
    expect(parseTicketNumber('TK-0007 ')).toBe(7);
    expect(parseTicketNumber('sans-numero')).toBe(0);
  });

  it('écrit puis relit un JSON persisté', () => {
    const storage = new MemoryStorage();
    expect(persistState('cle', [{ id: 1 }], storage)).toBe(true);
    expect(loadPersistedState('cle', [], storage)).toEqual([{ id: 1 }]);
    expect(loadPersistedState('absente', ['repli'], storage)).toEqual(['repli']);
  });

  it('retombe sur la valeur initiale si le JSON local est corrompu', () => {
    const storage = new MemoryStorage();
    storage.setItem('cle', '{json-invalide');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(loadPersistedState('cle', ['repli'], storage)).toEqual(['repli']);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('signale une écriture refusée sans lever d’exception', () => {
    const storage: JsonStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('Quota simulé');
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(persistState('cle', { ok: true }, storage)).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('génère un identifiant local déterministe pour les tests', () => {
    expect(createLocalId('ord', 1761667200000, 0.123456789)).toMatch(/^ord-1761667200000-[a-z0-9]+$/);
  });
});
