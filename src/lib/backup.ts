/**
 * Sauvegarde locale PressingPro.
 *
 * Tant que les écrans métier vivent dans le localStorage, ce module permet
 * d'exporter un fichier JSON chiffré (AES-GCM + PBKDF2) puis de le restaurer
 * sur le même appareil ou sur un autre navigateur. La restauration remplace
 * uniquement les clés allowlistées ci-dessous et tente un retour arrière si
 * une écriture échoue (quota, stockage indisponible…).
 */

export const BACKUP_FORMAT = 'pressingpro-backup';
export const ENCRYPTED_BACKUP_FORMAT = 'pressingpro-backup-encrypted';
export const BACKUP_VERSION = 1;
export const LAST_BACKUP_EXPORTED_AT_KEY = 'pressingpro_last_backup_exported_at';

const PBKDF2_ITERATIONS = 210_000;
const MIN_PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 1_000_000;
const MAX_BACKUP_FILE_CHARS = 20_000_000;

export type BackupValueKind = 'array' | 'object' | 'number' | 'string' | 'string-array';

export interface BackupKeyDefinition {
  key: string;
  label: string;
  kind: BackupValueKind;
}

export const BACKUP_KEYS: readonly BackupKeyDefinition[] = [
  { key: 'pressingpro_orders', label: 'Commandes', kind: 'array' },
  { key: 'pressingpro_customers', label: 'Clients', kind: 'array' },
  { key: 'pressingpro_cash_register', label: 'Caisse du jour', kind: 'object' },
  { key: 'pressingpro_next_ticket_number', label: 'Compteur de tickets', kind: 'number' },
  { key: 'pressingpro_employees', label: 'Personnel', kind: 'array' },
  { key: 'pressingpro_attendance', label: 'Présences', kind: 'array' },
  { key: 'pressingpro_inventory_products', label: 'Produits de stock', kind: 'array' },
  { key: 'pressingpro_stock_movements', label: 'Mouvements de stock', kind: 'array' },
  { key: 'pressingpro_expenses', label: 'Dépenses', kind: 'array' },
  { key: 'pressingpro_expense_categories', label: 'Catégories de dépenses', kind: 'array' },
  { key: 'pressingpro_logistics_tasks', label: 'Tournées', kind: 'array' },
  { key: 'pressingpro_storage_locations', label: 'Emplacements atelier', kind: 'array' },
  { key: 'pressingpro_shop_settings', label: 'Paramètres de la boutique', kind: 'object' },
  { key: 'pressingpro_custom_colors', label: 'Couleurs personnalisées', kind: 'string-array' },
  { key: 'pressingpro_theme', label: 'Thème de l’interface', kind: 'string' },
];

const BACKUP_KEY_MAP = new Map(BACKUP_KEYS.map((definition) => [definition.key, definition]));

export interface PressingProBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: Record<string, unknown>;
}

export interface EncryptedPressingProBackup {
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  cipher: {
    name: 'AES-GCM';
    iv: string;
  };
  ciphertext: string;
}

export interface BackupStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BackupSummaryItem {
  key: string;
  label: string;
  present: boolean;
  detail: string;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function getDefaultStorage(): BackupStorage {
  if (typeof localStorage === 'undefined') {
    throw new Error('Le stockage local du navigateur est indisponible.');
  }
  return localStorage;
}

function assertPassphrase(passphrase: string): void {
  if (passphrase.length < 8) {
    throw new Error('La phrase secrète doit contenir au moins 8 caractères.');
  }
  if (passphrase.length > 200) {
    throw new Error('La phrase secrète ne doit pas dépasser 200 caractères.');
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function decodeBase64(value: string, field: string): Uint8Array<ArrayBuffer> {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new Error(`Le champ ${field} de la sauvegarde chiffrée est illisible.`);
  }
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<CryptoKey> {
  assertPassphrase(passphrase);
  if (!globalThis.crypto?.subtle) {
    throw new Error('Le chiffrement Web Crypto est indisponible dans ce navigateur.');
  }
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function assertValueKind(definition: BackupKeyDefinition, value: unknown): void {
  const valid =
    definition.kind === 'array'
      ? Array.isArray(value)
      : definition.kind === 'string-array'
        ? Array.isArray(value) && value.every((item) => typeof item === 'string')
        : definition.kind === 'object'
          ? isPlainObject(value)
          : definition.kind === 'number'
            ? typeof value === 'number' && Number.isInteger(value) && value >= 0
            : typeof value === 'string' && value.trim().length > 0;

  if (!valid) {
    throw new Error(`La donnée « ${definition.label} » (${definition.key}) a un format inattendu.`);
  }
}

export function collectBackupData(
  storage: BackupStorage = getDefaultStorage()
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const definition of BACKUP_KEYS) {
    const raw = storage.getItem(definition.key);
    if (raw === null) continue;

    if (definition.kind === 'number') {
      const numeric = Number(raw);
      data[definition.key] = Number.isInteger(numeric) && numeric >= 0 ? numeric : raw;
    } else if (definition.kind === 'string') {
      data[definition.key] = raw;
    } else {
      try {
        data[definition.key] = JSON.parse(raw) as unknown;
      } catch {
        throw new Error(
          `La donnée locale « ${definition.label} » est illisible ; sauvegarde interrompue pour éviter un fichier incomplet.`
        );
      }
    }

    assertValueKind(definition, data[definition.key]);
  }

  return data;
}

export function createBackup(
  storage: BackupStorage = getDefaultStorage(),
  exportedAt = new Date().toISOString()
): PressingProBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    data: collectBackupData(storage),
  };
}

export function validateBackup(value: unknown): PressingProBackup {
  if (!isPlainObject(value)) throw new Error('Le fichier ne contient pas une sauvegarde valide.');
  if (value.format !== BACKUP_FORMAT) throw new Error('Ce fichier n’est pas une sauvegarde PressingPro.');
  if (value.version !== BACKUP_VERSION) {
    throw new Error(`Version de sauvegarde non prise en charge : ${String(value.version)}.`);
  }
  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) {
    throw new Error('La date d’export de la sauvegarde est illisible.');
  }
  if (!isPlainObject(value.data)) throw new Error('Les données de la sauvegarde sont absentes.');

  for (const [key, dataValue] of Object.entries(value.data)) {
    const definition = BACKUP_KEY_MAP.get(key);
    if (!definition) throw new Error(`Clé non autorisée dans la sauvegarde : ${key}.`);
    assertValueKind(definition, dataValue);
  }

  return value as unknown as PressingProBackup;
}

export async function encryptBackup(
  backup: PressingProBackup,
  passphrase: string
): Promise<EncryptedPressingProBackup> {
  const validBackup = validateBackup(backup);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(validBackup))
  );

  return {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: validBackup.exportedAt,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: encodeBase64(salt),
    },
    cipher: { name: 'AES-GCM', iv: encodeBase64(iv) },
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
  };
}

function validateEncryptedBackup(value: unknown): EncryptedPressingProBackup {
  if (!isPlainObject(value) || value.format !== ENCRYPTED_BACKUP_FORMAT) {
    throw new Error('Ce fichier n’est pas une sauvegarde PressingPro chiffrée.');
  }
  if (value.version !== BACKUP_VERSION) {
    throw new Error(`Version de sauvegarde chiffrée non prise en charge : ${String(value.version)}.`);
  }
  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) {
    throw new Error('La date d’export de la sauvegarde chiffrée est illisible.');
  }
  if (!isPlainObject(value.kdf) || !isPlainObject(value.cipher)) {
    throw new Error('Les paramètres de chiffrement sont absents.');
  }
  if (value.kdf.name !== 'PBKDF2' || value.kdf.hash !== 'SHA-256' || value.cipher.name !== 'AES-GCM') {
    throw new Error('Algorithme de sauvegarde non pris en charge.');
  }
  if (
    typeof value.kdf.iterations !== 'number' ||
    value.kdf.iterations < MIN_PBKDF2_ITERATIONS ||
    value.kdf.iterations > MAX_PBKDF2_ITERATIONS
  ) {
    throw new Error('Le coût de dérivation de clé de cette sauvegarde est invalide.');
  }
  if (typeof value.kdf.salt !== 'string' || typeof value.cipher.iv !== 'string') {
    throw new Error('Le sel ou le vecteur de chiffrement est absent.');
  }
  if (typeof value.ciphertext !== 'string' || value.ciphertext.length > MAX_BACKUP_FILE_CHARS) {
    throw new Error('Le contenu chiffré est absent ou trop volumineux.');
  }
  return value as unknown as EncryptedPressingProBackup;
}

export async function decryptBackup(
  encryptedValue: unknown,
  passphrase: string
): Promise<PressingProBackup> {
  const encrypted = validateEncryptedBackup(encryptedValue);
  const salt = decodeBase64(encrypted.kdf.salt, 'sel');
  const iv = decodeBase64(encrypted.cipher.iv, 'vecteur');
  if (salt.length < 16 || salt.length > 64) throw new Error('Le sel de chiffrement est invalide.');
  if (iv.length < 12 || iv.length > 16) throw new Error('Le vecteur de chiffrement est invalide.');

  const key = await deriveAesKey(passphrase, salt, encrypted.kdf.iterations);
  try {
    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      decodeBase64(encrypted.ciphertext, 'contenu chiffré')
    );
    return validateBackup(JSON.parse(new TextDecoder().decode(plaintext)) as unknown);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('La donnée')) throw error;
    throw new Error('Déchiffrement impossible : phrase secrète incorrecte ou fichier modifié.');
  }
}

export async function parseBackupFile(
  fileText: string,
  passphrase?: string
): Promise<PressingProBackup> {
  if (fileText.length > MAX_BACKUP_FILE_CHARS) {
    throw new Error('Le fichier de sauvegarde est trop volumineux (20 Mo maximum).');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText) as unknown;
  } catch {
    throw new Error('Le fichier sélectionné n’est pas un JSON lisible.');
  }

  if (isPlainObject(parsed) && parsed.format === ENCRYPTED_BACKUP_FORMAT) {
    if (!passphrase) throw new Error('Cette sauvegarde est chiffrée : saisissez sa phrase secrète.');
    return decryptBackup(parsed, passphrase);
  }

  return validateBackup(parsed);
}

function serializeBackupValue(definition: BackupKeyDefinition, value: unknown): string {
  assertValueKind(definition, value);
  if (definition.kind === 'number') return String(value);
  if (definition.kind === 'string') return String(value);
  return JSON.stringify(value);
}

export function restoreBackup(
  backup: PressingProBackup,
  storage: BackupStorage = getDefaultStorage()
): void {
  const validBackup = validateBackup(backup);
  const previous = new Map<string, string | null>();
  const next = new Map<string, string | null>();

  for (const definition of BACKUP_KEYS) {
    previous.set(definition.key, storage.getItem(definition.key));
    next.set(
      definition.key,
      Object.prototype.hasOwnProperty.call(validBackup.data, definition.key)
        ? serializeBackupValue(definition, validBackup.data[definition.key])
        : null
    );
  }

  try {
    for (const definition of BACKUP_KEYS) {
      const value = next.get(definition.key);
      if (value === null || value === undefined) storage.removeItem(definition.key);
      else storage.setItem(definition.key, value);
    }
  } catch (error) {
    for (const definition of BACKUP_KEYS) {
      const value = previous.get(definition.key);
      try {
        if (value === null || value === undefined) storage.removeItem(definition.key);
        else storage.setItem(definition.key, value);
      } catch {
        // Le retour arrière est best-effort ; l'erreur d'origine reste remontée.
      }
    }
    throw new Error(
      `Restauration interrompue ; tentative de retour aux données précédentes effectuée. Cause : ${
        error instanceof Error ? error.message : 'stockage indisponible'
      }`
    );
  }
}

export function getBackupSummary(backup: PressingProBackup): BackupSummaryItem[] {
  const validBackup = validateBackup(backup);
  return BACKUP_KEYS.map((definition) => {
    const present = Object.prototype.hasOwnProperty.call(validBackup.data, definition.key);
    const value = validBackup.data[definition.key];
    let detail = 'Absent du fichier';
    if (present) {
      if (Array.isArray(value)) detail = `${value.length} élément(s)`;
      else if (definition.kind === 'number') detail = `Prochain numéro : ${String(value)}`;
      else if (definition.kind === 'string') detail = String(value);
      else detail = 'Présent';
    }
    return { key: definition.key, label: definition.label, present, detail };
  });
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

export function createBackupFileName(date = new Date()): string {
  return `pressingpro-sauvegarde-${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}-${pad2(date.getHours())}${pad2(date.getMinutes())}.json`;
}

export function markBackupExported(
  storage: BackupStorage = getDefaultStorage(),
  exportedAt = new Date().toISOString()
): void {
  storage.setItem(LAST_BACKUP_EXPORTED_AT_KEY, exportedAt);
}

export function getLastBackupExportedAt(
  storage: BackupStorage = getDefaultStorage()
): string | null {
  const value = storage.getItem(LAST_BACKUP_EXPORTED_AT_KEY);
  return value && !Number.isNaN(Date.parse(value)) ? value : null;
}
