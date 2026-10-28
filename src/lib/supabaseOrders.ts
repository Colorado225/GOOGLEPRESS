import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from './database.types';
import { supabase } from './supabase';
import {
  isLogisticsTaskStatus,
  isOrderStatus,
  type OrderEventVisibility,
} from './orderTracking';
import type { LogisticsTaskKind, LogisticsTaskStatus, OrderStatus } from '../types';

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
  const channelSuffix = `${options.shopId ?? 'all'}-${Math.random().toString(36).slice(2, 10)}`;

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
