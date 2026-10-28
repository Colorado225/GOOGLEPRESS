import { describe, expect, it } from 'vitest';
import {
  createBackup,
  createBackupFileName,
  decryptBackup,
  encryptBackup,
  getBackupSummary,
  getLastBackupExportedAt,
  markBackupExported,
  parseBackupFile,
  restoreBackup,
  validateBackup,
  type BackupStorage,
} from '../../src/lib/backup';

class MemoryStorage implements BackupStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const seededStorage = (): MemoryStorage => {
  const storage = new MemoryStorage();
  storage.setItem('pressingpro_orders', JSON.stringify([{ id: 'order-1' }]));
  storage.setItem('pressingpro_customers', JSON.stringify([{ id: 'cust-1' }, { id: 'cust-2' }]));
  storage.setItem('pressingpro_cash_register', JSON.stringify({ totalAmount: 15000 }));
  storage.setItem('pressingpro_next_ticket_number', '2855');
  storage.setItem('pressingpro_theme', 'dark');
  storage.setItem('pressingpro_custom_colors', JSON.stringify(['Turquoise']));
  return storage;
};

describe('backup', () => {
  it('collecte uniquement les clés autorisées et résume leur contenu', () => {
    const backup = createBackup(seededStorage(), '2026-10-28T10:15:00.000Z');
    expect(backup.data.pressingpro_next_ticket_number).toBe(2855);
    expect(backup.data.pressingpro_theme).toBe('dark');

    const summary = getBackupSummary(backup);
    expect(summary.find((item) => item.key === 'pressingpro_orders')?.detail).toBe('1 élément(s)');
    expect(summary.find((item) => item.key === 'pressingpro_customers')?.detail).toBe('2 élément(s)');
    expect(summary.find((item) => item.key === 'pressingpro_expenses')?.present).toBe(false);
  });

  it('refuse une clé inconnue et un type inattendu', () => {
    expect(() =>
      validateBackup({
        format: 'pressingpro-backup',
        version: 1,
        exportedAt: '2026-10-28T10:15:00.000Z',
        data: { cle_inconnue: [] },
      })
    ).toThrow('Clé non autorisée');

    expect(() =>
      validateBackup({
        format: 'pressingpro-backup',
        version: 1,
        exportedAt: '2026-10-28T10:15:00.000Z',
        data: { pressingpro_orders: { id: 'pas-un-tableau' } },
      })
    ).toThrow('format inattendu');
  });

  it('chiffre puis relit une sauvegarde avec la bonne phrase secrète', async () => {
    const backup = createBackup(seededStorage(), '2026-10-28T10:15:00.000Z');
    const encrypted = await encryptBackup(backup, 'phrase-secrete-test');

    expect(encrypted.format).toBe('pressingpro-backup-encrypted');
    expect(encrypted.ciphertext).not.toContain('order-1');
    await expect(decryptBackup(encrypted, 'phrase-secrete-test')).resolves.toEqual(backup);
    await expect(decryptBackup(encrypted, 'mauvaise-phrase')).rejects.toThrow('Déchiffrement impossible');
    await expect(
      parseBackupFile(JSON.stringify(encrypted), 'phrase-secrete-test')
    ).resolves.toEqual(backup);
  });

  it('restaure en remplaçant les clés absentes et conserve le compteur brut', () => {
    const source = seededStorage();
    const backup = createBackup(source, '2026-10-28T10:15:00.000Z');
    const target = new MemoryStorage();
    target.setItem('pressingpro_expenses', JSON.stringify([{ id: 'ancienne-depense' }]));

    restoreBackup(backup, target);

    expect(target.getItem('pressingpro_orders')).toContain('order-1');
    expect(target.getItem('pressingpro_next_ticket_number')).toBe('2855');
    expect(target.getItem('pressingpro_theme')).toBe('dark');
    expect(target.getItem('pressingpro_expenses')).toBeNull();
  });

  it('tente un retour arrière si une écriture de restauration échoue', () => {
    const values = new Map<string, string>([
      ['pressingpro_orders', JSON.stringify([{ id: 'ancienne-commande' }])],
      ['pressingpro_customers', JSON.stringify([{ id: 'ancien-client' }])],
    ]);
    let failOnce = true;
    const storage: BackupStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        if (key === 'pressingpro_customers' && failOnce) {
          failOnce = false;
          throw new Error('Quota simulé');
        }
        values.set(key, value);
      },
      removeItem: (key) => values.delete(key),
    };

    expect(() => restoreBackup(createBackup(seededStorage()), storage)).toThrow('retour aux données précédentes');
    expect(values.get('pressingpro_orders')).toContain('ancienne-commande');
    expect(values.get('pressingpro_customers')).toContain('ancien-client');
  });

  it('mémorise la dernière exportation et génère un nom de fichier daté', () => {
    const storage = new MemoryStorage();
    expect(getLastBackupExportedAt(storage)).toBeNull();
    markBackupExported(storage, '2026-10-28T10:15:00.000Z');
    expect(getLastBackupExportedAt(storage)).toBe('2026-10-28T10:15:00.000Z');
    expect(createBackupFileName(new Date(2026, 9, 28, 9, 5))).toBe(
      'pressingpro-sauvegarde-2026-10-28-0905.json'
    );
  });
});
