import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, Tables } from './database.types';
import { supabase } from './supabase';
import { createLocalId } from './localPersistence';
import {
  isLogisticsTaskStatus,
  isOrderStatus,
  type OrderEventVisibility,
} from './orderTracking';
import type {
  LogisticsTaskKind,
  LogisticsTaskStatus,
  LogisticsTimeSlot,
  OrderStatus,
  PickupOption,
  ServiceCategory,
} from '../types';

type Client = SupabaseClient<Database>;

export type RemoteOrder = Omit<Tables<'orders'>, 'status'> & {
  status: OrderStatus;
};

export type RemoteOrderEvent = Tables<'order_events'>;

export type RemoteLogisticsTask = Omit<Tables<'logistics_tasks'>, 'kind' | 'status'> & {
  kind: LogisticsTaskKind;
  status: LogisticsTaskStatus;
};

export type RemoteShop = Pick<
  Tables<'shops'>,
  'id' | 'organization_id' | 'name' | 'slug' | 'status'
>;

export type RemoteMembership = Pick<
  Tables<'memberships'>,
  'id' | 'organization_id' | 'shop_id' | 'role' | 'status'
>;

export interface RemoteOrderTrackingSnapshot {
  orders: RemoteOrder[];
  logisticsTasks: RemoteLogisticsTask[];
}

export interface TransitionRemoteOrderInput {
  orderId: string;
  targetStatus: OrderStatus;
  expectedStatus?: OrderStatus | null;
  note?: string | null;
  visibility?: OrderEventVisibility;
}

export interface CreateRemoteOrderLineInput {
  catalogItemId?: string;
  legacyKey?: string;
  quantity: number;
  color?: string | null;
  serviceType?: string | null;
  /** Délai de cette ligne ; absent = repli sur l'option globale historique. */
  isExpress?: boolean | null;
}

export interface CreateRemoteOrderInput {
  shopId: string;
  customerId: string;
  lines: CreateRemoteOrderLineInput[];
  promisedAt: string;
  /**
   * Clé stable du brouillon/intention de commande. L'écran doit la conserver
   * pendant une reprise réseau ; la RPC renverra alors la même commande.
   */
  idempotencyKey: string;
  serviceCategory?: ServiceCategory;
  pickupOption?: PickupOption;
  discountPercent?: number | null;
  collectionFeeXof?: number | null;
  deliveryFeeXof?: number | null;
  notes?: string | null;
  origin?: 'counter' | 'home_pickup';
  fulfillmentMethod?: 'counter_pickup' | 'home_delivery';
  collectionAddress?: string | null;
  collectionAddressDetails?: string | null;
  collectionDate?: string | null;
  collectionTimeSlot?: LogisticsTimeSlot | null;
  deliveryAddress?: string | null;
  deliveryAddressDetails?: string | null;
  deliveryDate?: string | null;
  deliveryTimeSlot?: LogisticsTimeSlot | null;
}

const requireSupabaseClient = (client?: Client | null): Client => {
  const resolved = client ?? supabase;
  if (!resolved) {
    throw new Error('Supabase n’est pas configuré dans cet environnement.');
  }
  return resolved;
};

const normalizeRemoteOrder = (row: Tables<'orders'>): RemoteOrder | null =>
  isOrderStatus(row.status) ? { ...row, status: row.status } : null;

const normalizeRemoteLogisticsTask = (
  row: Tables<'logistics_tasks'>
): RemoteLogisticsTask | null => {
  if (!isLogisticsTaskStatus(row.status)) return null;
  if (row.kind !== 'pickup' && row.kind !== 'delivery') return null;
  return { ...row, kind: row.kind, status: row.status };
};

export type RemoteOrganization = Pick<
  Tables<'organizations'>,
  'id' | 'name' | 'slug' | 'status'
>;

/**
 * Organisations visibles par la session courante (RLS : rattachement actif,
 * client lié ou administration plateforme). Sert uniquement à afficher le nom
 * réel de l'enseigne dans la navigation.
 */
export async function listAccessibleOrganizations(
  client?: Client | null
): Promise<RemoteOrganization[]> {
  const resolved = requireSupabaseClient(client);
  const { data, error } = await resolved
    .from('organizations')
    .select('id, name, slug, status')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listAccessibleShops(client?: Client | null): Promise<RemoteShop[]> {
  const resolved = requireSupabaseClient(client);
  const { data, error } = await resolved
    .from('shops')
    .select('id, organization_id, name, slug, status')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listCurrentMemberships(
  userId: string,
  client?: Client | null
): Promise<RemoteMembership[]> {
  const resolved = requireSupabaseClient(client);
  const { data, error } = await resolved
    .from('memberships')
    .select('id, organization_id, shop_id, role, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listRemoteOrders(
  options: { shopId?: string | null; limit?: number } = {},
  client?: Client | null
): Promise<RemoteOrder[]> {
  const resolved = requireSupabaseClient(client);
  let query = resolved
    .from('orders')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(options.limit ?? 100);

  if (options.shopId) query = query.eq('shop_id', options.shopId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map(normalizeRemoteOrder)
    .filter((order): order is RemoteOrder => order !== null);
}

export async function listRemoteLogisticsTasksForOrders(
  orderIds: readonly string[],
  client?: Client | null
): Promise<RemoteLogisticsTask[]> {
  if (orderIds.length === 0) return [];

  const resolved = requireSupabaseClient(client);
  const { data, error } = await resolved
    .from('logistics_tasks')
    .select('*')
    .in('order_id', [...orderIds])
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map(normalizeRemoteLogisticsTask)
    .filter((task): task is RemoteLogisticsTask => task !== null);
}

export async function loadRemoteOrderTrackingSnapshot(
  shopId?: string | null,
  client?: Client | null
): Promise<RemoteOrderTrackingSnapshot> {
  const orders = await listRemoteOrders({ shopId, limit: 100 }, client);
  const logisticsTasks = await listRemoteLogisticsTasksForOrders(
    orders.map((order) => order.id),
    client
  );
  return { orders, logisticsTasks };
}

export async function listRemoteOrderEvents(
  orderId: string,
  client?: Client | null
): Promise<RemoteOrderEvent[]> {
  const resolved = requireSupabaseClient(client);
  const { data, error } = await resolved
    .from('order_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Crée une commande via la RPC serveur. Le navigateur envoie uniquement les
 * références catalogue et quantités : tarifs, remise, frais, total et ticket
 * sont recalculés/attribués par PostgreSQL dans une seule transaction.
 */
export async function createRemoteOrder(
  input: CreateRemoteOrderInput,
  client?: Client | null
): Promise<RemoteOrder> {
  const resolved = requireSupabaseClient(client);
  const idempotencyKey = input.idempotencyKey.trim();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 120) {
    throw new Error('La clé d’idempotence doit contenir entre 8 et 120 caractères.');
  }
  if (input.lines.length === 0) {
    throw new Error('La commande doit contenir au moins une ligne.');
  }

  const lines = input.lines.map((line) => ({
    catalogItemId: line.catalogItemId ?? null,
    legacyKey: line.legacyKey ?? null,
    quantity: line.quantity,
    color: line.color?.trim() || null,
    serviceType: line.serviceType?.trim() || null,
    isExpress: line.isExpress ?? null,
  })) as unknown as Json;

  const { data, error } = await resolved.rpc('create_order', {
    p_shop_id: input.shopId,
    p_customer_id: input.customerId,
    p_lines: lines,
    p_promised_at: input.promisedAt,
    p_idempotency_key: idempotencyKey,
    p_service_category: input.serviceCategory ?? 'pressing',
    p_pickup_option: input.pickupOption ?? 'standard',
    p_discount_percent: input.discountPercent ?? null,
    p_collection_fee_xof: input.collectionFeeXof ?? null,
    p_delivery_fee_xof: input.deliveryFeeXof ?? null,
    p_notes: input.notes?.trim() || null,
    p_origin: input.origin ?? 'counter',
    p_fulfillment_method: input.fulfillmentMethod ?? 'counter_pickup',
    p_collection_address: input.collectionAddress?.trim() || null,
    p_collection_address_details: input.collectionAddressDetails?.trim() || null,
    p_collection_date: input.collectionDate ?? null,
    p_collection_time_slot: input.collectionTimeSlot ?? null,
    p_delivery_address: input.deliveryAddress?.trim() || null,
    p_delivery_address_details: input.deliveryAddressDetails?.trim() || null,
    p_delivery_date: input.deliveryDate ?? null,
    p_delivery_time_slot: input.deliveryTimeSlot ?? null,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('La RPC de création n’a renvoyé aucune commande.');

  const normalized = normalizeRemoteOrder(data);
  if (!normalized) throw new Error('La commande renvoyée par Supabase a un statut inconnu.');
  return normalized;
}

export async function transitionRemoteOrderStatus(
  input: TransitionRemoteOrderInput,
  client?: Client | null
): Promise<RemoteOrder> {
  const resolved = requireSupabaseClient(client);
  const note = input.note?.trim() ? input.note.trim() : null;

  const { data, error } = await resolved.rpc('transition_order_status', {
    p_order_id: input.orderId,
    p_target_status: input.targetStatus,
    p_expected_status: input.expectedStatus ?? null,
    p_note: note,
    p_visibility: input.visibility ?? 'customer',
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error('La RPC de transition n’a renvoyé aucune commande.');

  const normalized = normalizeRemoteOrder(data);
  if (!normalized) throw new Error('La commande renvoyée par Supabase a un statut inconnu.');
  return normalized;
}

export type RemoteTrackingRealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'subscribed'
  | 'closed'
  | 'error';

export interface RemoteOrderTrackingSubscriptionOptions {
  shopId?: string | null;
  onChange: () => void;
  onStatus?: (status: RemoteTrackingRealtimeStatus) => void;
}

/**
 * Abonnement volontairement simple et robuste : chaque événement autorisé
 * par RLS déclenche un rechargement du périmètre affiché. Cela évite de
 * reconstruire côté navigateur un état partiel à partir de payloads
 * Realtime incomplets, notamment après une reconnexion.
 */
export function subscribeToRemoteOrderTracking(
  options: RemoteOrderTrackingSubscriptionOptions,
  client?: Client | null
): () => void {
  const resolved = requireSupabaseClient(client);
  const filter = options.shopId ? `shop_id=eq.${options.shopId}` : undefined;
  const channelSuffix = `${options.shopId ?? 'all'}-${createLocalId('channel')}`;

  options.onStatus?.('connecting');

  let channel: RealtimeChannel = resolved.channel(
    `pressingpro-order-tracking-${channelSuffix}`
  );

  const subscribeToTable = (table: 'orders' | 'order_events' | 'logistics_tasks') => {
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        ...(filter ? { filter } : {}),
      },
      () => options.onChange()
    );
  };

  subscribeToTable('orders');
  subscribeToTable('order_events');
  subscribeToTable('logistics_tasks');

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') options.onStatus?.('subscribed');
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') options.onStatus?.('error');
    else if (status === 'CLOSED') options.onStatus?.('closed');
  });

  return () => {
    options.onStatus?.('closed');
    void resolved.removeChannel(channel);
  };
}
