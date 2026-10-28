import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, Tables } from './database.types';
import { supabase } from './supabase';

type Client = SupabaseClient<Database>;

export type RemotePaymentKind = 'payment' | 'refund' | 'reversal';
export type RemotePaymentStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled';
export type RemotePaymentMethod = 'cash' | 'mobile_money' | 'transfer' | 'card' | 'other';
export type RemotePaymentProvider =
  | 'cash'
  | 'wave'
  | 'orange_money'
  | 'mtn_momo'
  | 'bank_transfer'
  | 'bank_card'
  | 'other';

export type RemotePayment = Omit<
  Tables<'payments'>,
  'kind' | 'status' | 'method' | 'provider'
> & {
  kind: RemotePaymentKind;
  status: RemotePaymentStatus;
  method: RemotePaymentMethod;
  provider: RemotePaymentProvider;
};

/**
 * Seules ces métadonnées scalaires et non sensibles sont acceptées par la RPC
 * manuelle. Les payloads fournisseurs devront passer par une intégration
 * serveur dédiée, jamais par un objet libre envoyé par le navigateur.
 */
export interface RemotePaymentMetadata {
  note?: string;
  receipt_reference?: string;
  terminal_reference?: string;
  cash_register_reference?: string;
}

export interface RecordRemoteOrderPaymentInput {
  orderId: string;
  amountXof: number;
  method: RemotePaymentMethod;
  provider: RemotePaymentProvider;
  /**
   * Clé stable de l'intention d'encaissement. Elle doit être conservée par
   * l'écran pendant les reprises réseau : régénérer une clé à chaque clic
   * empêcherait le serveur de reconnaître une répétition.
   */
  idempotencyKey: string;
  externalReference?: string | null;
  metadata?: RemotePaymentMetadata;
}

export interface RefundRemoteOrderPaymentInput {
  paymentId: string;
  amountXof: number;
  idempotencyKey: string;
  reason?: string | null;
  externalReference?: string | null;
}

export interface RemotePaymentTotalsRow {
  method: RemotePaymentMethod;
  provider: RemotePaymentProvider;
  grossXof: number;
  refundsXof: number;
  netXof: number;
}

export interface RemotePaymentTotals {
  shopId: string;
  businessDate: string;
  currency: string;
  rows: RemotePaymentTotalsRow[];
  grossXof: number;
  refundsXof: number;
  netXof: number;
}

const PAYMENT_KINDS = new Set<string>(['payment', 'refund', 'reversal']);
const PAYMENT_STATUSES = new Set<string>(['pending', 'confirmed', 'failed', 'cancelled']);
const PAYMENT_METHODS = new Set<string>(['cash', 'mobile_money', 'transfer', 'card', 'other']);
const PAYMENT_PROVIDERS = new Set<string>([
  'cash',
  'wave',
  'orange_money',
  'mtn_momo',
  'bank_transfer',
  'bank_card',
  'other',
]);

const requireSupabaseClient = (client?: Client | null): Client => {
  const resolved = client ?? supabase;
  if (!resolved) {
    throw new Error('Supabase n’est pas configuré dans cet environnement.');
  }
  return resolved;
};

const assertPaymentInput = (input: {
  amountXof: number;
  idempotencyKey: string;
}): { amountXof: number; idempotencyKey: string } => {
  if (!Number.isSafeInteger(input.amountXof) || input.amountXof <= 0) {
    throw new Error('Le montant doit être un nombre entier de FCFA strictement positif.');
  }
  const idempotencyKey = input.idempotencyKey.trim();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 120) {
    throw new Error('La clé d’idempotence doit contenir entre 8 et 120 caractères.');
  }
  return { amountXof: input.amountXof, idempotencyKey };
};

const normalizeRemotePayment = (row: Tables<'payments'>): RemotePayment => {
  if (
    !PAYMENT_KINDS.has(row.kind) ||
    !PAYMENT_STATUSES.has(row.status) ||
    !PAYMENT_METHODS.has(row.method) ||
    !PAYMENT_PROVIDERS.has(row.provider)
  ) {
    throw new Error('Un paiement renvoyé par Supabase contient une valeur inconnue.');
  }

  return {
    ...row,
    kind: row.kind as RemotePaymentKind,
    status: row.status as RemotePaymentStatus,
    method: row.method as RemotePaymentMethod,
    provider: row.provider as RemotePaymentProvider,
  };
};

export async function listRemoteOrderPayments(
  orderId: string,
  client?: Client | null
): Promise<RemotePayment[]> {
  const resolved = requireSupabaseClient(client);
  const { data, error } = await resolved
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeRemotePayment);
}

/**
 * Enregistre un paiement confirmé manuellement au comptoir. Cette fonction ne
 * prétend pas confirmer un paiement en ligne : pour Wave/Orange/MTN, la
 * référence fournisseur vérifiée par un membre du personnel est obligatoire
 * et la RPC reste l'autorité finale.
 */
export async function recordRemoteOrderPayment(
  input: RecordRemoteOrderPaymentInput,
  client?: Client | null
): Promise<RemotePayment> {
  const resolved = requireSupabaseClient(client);
  const { amountXof, idempotencyKey } = assertPaymentInput(input);
  const externalReference = input.externalReference?.trim() || null;

  if (input.method !== 'cash' && !externalReference) {
    throw new Error('Une référence fournisseur est requise pour ce paiement.');
  }

  const { data, error } = await resolved.rpc('record_order_payment', {
    p_order_id: input.orderId,
    p_amount_xof: amountXof,
    p_method: input.method,
    p_provider: input.provider,
    p_idempotency_key: idempotencyKey,
    p_external_reference: externalReference,
    p_metadata: (input.metadata ?? {}) as Json,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('La RPC de paiement n’a renvoyé aucune écriture.');
  return normalizeRemotePayment(data);
}

export async function refundRemoteOrderPayment(
  input: RefundRemoteOrderPaymentInput,
  client?: Client | null
): Promise<RemotePayment> {
  const resolved = requireSupabaseClient(client);
  const { amountXof, idempotencyKey } = assertPaymentInput(input);

  const { data, error } = await resolved.rpc('refund_order_payment', {
    p_payment_id: input.paymentId,
    p_amount_xof: amountXof,
    p_idempotency_key: idempotencyKey,
    p_reason: input.reason?.trim() || null,
    p_external_reference: input.externalReference?.trim() || null,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('La RPC de remboursement n’a renvoyé aucune écriture.');
  return normalizeRemotePayment(data);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (record: Record<string, unknown>, key: string): string => {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`Réponse de totaux Supabase invalide : champ ${key}.`);
  }
  return value;
};

const readAmount = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`Réponse de totaux Supabase invalide : montant ${key}.`);
  }
  return value;
};

export async function getRemotePaymentTotals(
  shopId: string,
  businessDate: string,
  client?: Client | null
): Promise<RemotePaymentTotals> {
  const resolved = requireSupabaseClient(client);
  const { data, error } = await resolved.rpc('get_payment_totals', {
    p_shop_id: shopId,
    p_business_date: businessDate,
  });

  if (error) throw new Error(error.message);
  const raw: unknown = data;
  if (!isRecord(raw) || !Array.isArray(raw.rows)) {
    throw new Error('Réponse de totaux Supabase invalide.');
  }

  const rows = raw.rows.map((row): RemotePaymentTotalsRow => {
    if (!isRecord(row)) throw new Error('Réponse de totaux Supabase invalide.');
    const method = readString(row, 'method');
    const provider = readString(row, 'provider');
    if (!PAYMENT_METHODS.has(method) || !PAYMENT_PROVIDERS.has(provider)) {
      throw new Error('Réponse de totaux Supabase invalide : fournisseur inconnu.');
    }
    return {
      method: method as RemotePaymentMethod,
      provider: provider as RemotePaymentProvider,
      grossXof: readAmount(row, 'gross_xof'),
      refundsXof: readAmount(row, 'refunds_xof'),
      netXof: readAmount(row, 'net_xof'),
    };
  });

  return {
    shopId: readString(raw, 'shop_id'),
    businessDate: readString(raw, 'business_date'),
    currency: readString(raw, 'currency'),
    rows,
    grossXof: readAmount(raw, 'gross_xof'),
    refundsXof: readAmount(raw, 'refunds_xof'),
    netXof: readAmount(raw, 'net_xof'),
  };
}
