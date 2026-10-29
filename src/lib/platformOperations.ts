import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from './database.types';
import { isSupabaseConfigured, supabase } from './supabase';
import { getStaffAccessEnvironment, resolvePlatformAdminAccessMode } from './staffAccess';
import type { SubscriptionPlanId, SubscriptionStatus } from './subscription';
import type { PlatformAdminOrganization } from './platformAdmin';

type Client = SupabaseClient<Database>;
export type PlatformOperationAction =
  | 'plan_offer.update' | 'promo.save' | 'terms.update'
  | 'invoice.create' | 'invoice.void' | 'payment.record' | 'credit_note.create'
  | 'ticket.create' | 'ticket.update' | 'ticket.reply'
  | 'campaign.save' | 'campaign.status' | 'outbound.cancel'
  | 'notifications.read' | 'automation.run' | 'health.check';

export interface PlatformPlanOffer {
  plan: SubscriptionPlanId;
  monthly_price_xof: number;
  max_shops: number | null;
  max_users: number | null;
  max_orders_month: number | null;
  max_storage: number | null;
  modules: string[];
  trial_days: number;
  active: boolean;
  updated_at: string;
}
export interface PlatformPromoCode {
  code: string;
  discount_type: 'percent' | 'fixed';
  value: number;
  active: boolean;
  starts_on: string | null;
  ends_on: string | null;
  max_uses: number | null;
  created_at: string;
}
export interface PlatformSubscriptionTerms {
  shop_id: string;
  custom_monthly_price_xof: number | null;
  auto_renew: boolean;
  auto_lock: boolean;
  grace_days: number;
  trial_ends_on: string | null;
  scheduled_plan: SubscriptionPlanId | null;
  scheduled_change_on: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}
export type PlatformPaymentMethod = 'cash' | 'wave' | 'orange_money' | 'mtn_momo' | 'moov_money' | 'bank_transfer' | 'other';
export interface PlatformPayment {
  id: string;
  organization_id: string;
  invoice_id: string;
  amount_xof: number;
  method: PlatformPaymentMethod;
  status: 'recorded' | 'failed' | 'refunded';
  reference: string;
  paid_at: string;
  note: string;
  created_by: string | null;
  created_at: string;
}
export interface PlatformCreditNote {
  id: string;
  organization_id: string;
  invoice_id: string;
  credit_number: string;
  amount_xof: number;
  reason: string;
  created_by: string | null;
  created_at: string;
}
export interface PlatformInvoice {
  id: string;
  organization_id: string;
  shop_id: string;
  organization_name: string;
  shop_name: string;
  invoice_number: string;
  status: 'issued' | 'paid' | 'overdue' | 'void';
  currency: 'XOF';
  period_start: string;
  period_end: string;
  due_on: string;
  subtotal_xof: number;
  discount_xof: number;
  total_xof: number;
  promo_code: string | null;
  note: string;
  created_at: string;
  payments: PlatformPayment[];
  credit_notes: PlatformCreditNote[];
}
export interface PlatformSupportAttachment {
  path: string;
  name: string;
  size: number;
  type: string;
}
export interface PlatformSupportMessage {
  id: string;
  author_type: 'platform' | 'tenant';
  body: string;
  internal: boolean;
  attachments: PlatformSupportAttachment[];
  created_at: string;
  author_user_id?: string | null;
}
export interface PlatformSupportTicket {
  id: string;
  organization_id: string;
  shop_id: string | null;
  organization_name: string | null;
  shop_name: string | null;
  ticket_number: string;
  requester_user_id: string | null;
  subject: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  messages: PlatformSupportMessage[];
}
export interface PlatformCampaign {
  id: string;
  title: string;
  body: string;
  tone: 'info' | 'warning' | 'critical';
  audience_type: 'all' | 'plan' | 'organization';
  audience_value: string | null;
  channels: Array<'in_app' | 'email' | 'whatsapp'>;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  starts_at: string | null;
  ends_at: string | null;
  maintenance: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface PlatformOutboundMessage {
  id: string;
  campaign_id: string | null;
  organization_id: string | null;
  recipient: string;
  channel: 'email' | 'whatsapp';
  subject: string;
  body: string;
  status: 'queued' | 'sent' | 'failed' | 'cancelled';
  provider: string | null;
  provider_reference: string | null;
  error: string | null;
  scheduled_for: string;
  created_at: string;
}
export interface PlatformNotification {
  id: string;
  kind: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  organization_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  dedupe_key: string | null;
  read_at: string | null;
  created_at: string;
}
export interface PlatformAuditEntry {
  id: string;
  organization_id: string | null;
  organization_name: string | null;
  actor_user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
export interface PlatformSecurityEvent {
  id: string;
  user_id: string;
  session_id: string | null;
  event_type: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}
export interface PlatformSession {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  refreshed_at: string | null;
  not_after: string | null;
  ip: string | null;
  user_agent: string | null;
  aal: string | null;
}
export interface PlatformAutomationRun {
  id: string;
  actor_user_id: string | null;
  summary: Record<string, unknown>;
  created_at: string;
}
export interface PlatformHealthCheck {
  id: string;
  component: string;
  status: 'healthy' | 'degraded' | 'down';
  details: Record<string, unknown>;
  checked_at: string;
}
export interface PlatformOperationsSnapshot {
  server_time: string;
  system: {
    database_name: string;
    postgres_version: string;
    latest_migration: string | null;
    automation_scheduled: boolean;
  };
  plan_offers: PlatformPlanOffer[];
  promo_codes: PlatformPromoCode[];
  subscription_terms: PlatformSubscriptionTerms[];
  invoices: PlatformInvoice[];
  tickets: PlatformSupportTicket[];
  campaigns: PlatformCampaign[];
  outbound_messages: PlatformOutboundMessage[];
  notifications: PlatformNotification[];
  audit: PlatformAuditEntry[];
  security_events: PlatformSecurityEvent[];
  sessions: PlatformSession[];
  automation_runs: PlatformAutomationRun[];
  health_checks: PlatformHealthCheck[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const record = (value: unknown, label = 'réponse'): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`Réponse d’opérations invalide : ${label}.`);
  return value;
};
const string = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const nullableString = (value: unknown): string | null => typeof value === 'string' && value ? value : null;
const number = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const nullableNumber = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const boolean = (value: unknown, fallback = false): boolean => typeof value === 'boolean' ? value : fallback;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const strings = (value: unknown): string[] => list(value).filter((entry): entry is string => typeof entry === 'string');
const jsonRecord = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {};
const dateOrNull = (value: unknown): string | null => nullableString(value);

const parsePayment = (raw: unknown): PlatformPayment => {
  const value = record(raw, 'paiement');
  return {
    id: string(value.id), organization_id: string(value.organization_id), invoice_id: string(value.invoice_id),
    amount_xof: number(value.amount_xof), method: string(value.method, 'other') as PlatformPaymentMethod,
    status: string(value.status, 'failed') as PlatformPayment['status'], reference: string(value.reference),
    paid_at: string(value.paid_at), note: string(value.note), created_by: nullableString(value.created_by),
    created_at: string(value.created_at),
  };
};
const parseCreditNote = (raw: unknown): PlatformCreditNote => {
  const value = record(raw, 'avoir');
  return {
    id: string(value.id), organization_id: string(value.organization_id), invoice_id: string(value.invoice_id),
    credit_number: string(value.credit_number), amount_xof: number(value.amount_xof), reason: string(value.reason),
    created_by: nullableString(value.created_by), created_at: string(value.created_at),
  };
};
const parseInvoice = (raw: unknown): PlatformInvoice => {
  const value = record(raw, 'facture');
  return {
    id: string(value.id), organization_id: string(value.organization_id), shop_id: string(value.shop_id),
    organization_name: string(value.organization_name), shop_name: string(value.shop_name),
    invoice_number: string(value.invoice_number), status: string(value.status, 'issued') as PlatformInvoice['status'],
    currency: 'XOF', period_start: string(value.period_start), period_end: string(value.period_end),
    due_on: string(value.due_on), subtotal_xof: number(value.subtotal_xof), discount_xof: number(value.discount_xof),
    total_xof: number(value.total_xof), promo_code: nullableString(value.promo_code), note: string(value.note),
    created_at: string(value.created_at), payments: list(value.payments).map(parsePayment),
    credit_notes: list(value.credit_notes).map(parseCreditNote),
  };
};
const parseAttachment = (raw: unknown): PlatformSupportAttachment => {
  const value = record(raw, 'pièce jointe');
  return { path: string(value.path), name: string(value.name), size: number(value.size), type: string(value.type) };
};
const parseMessage = (raw: unknown): PlatformSupportMessage => {
  const value = record(raw, 'message support');
  return {
    id: string(value.id), author_type: string(value.author_type, 'platform') as PlatformSupportMessage['author_type'],
    body: string(value.body), internal: boolean(value.internal), attachments: list(value.attachments).map(parseAttachment),
    created_at: string(value.created_at), author_user_id: nullableString(value.author_user_id),
  };
};
const parseTicket = (raw: unknown): PlatformSupportTicket => {
  const value = record(raw, 'ticket');
  return {
    id: string(value.id), organization_id: string(value.organization_id), shop_id: nullableString(value.shop_id),
    organization_name: nullableString(value.organization_name), shop_name: nullableString(value.shop_name),
    ticket_number: string(value.ticket_number), requester_user_id: nullableString(value.requester_user_id),
    subject: string(value.subject), status: string(value.status, 'open') as PlatformSupportTicket['status'],
    priority: string(value.priority, 'normal') as PlatformSupportTicket['priority'], created_at: string(value.created_at),
    updated_at: string(value.updated_at), resolved_at: dateOrNull(value.resolved_at), messages: list(value.messages).map(parseMessage),
  };
};
const parsePlanOffer = (raw: unknown): PlatformPlanOffer => {
  const value = record(raw, 'formule');
  return {
    plan: string(value.plan, 'free') as SubscriptionPlanId, monthly_price_xof: number(value.monthly_price_xof),
    max_shops: nullableNumber(value.max_shops), max_users: nullableNumber(value.max_users),
    max_orders_month: nullableNumber(value.max_orders_month), max_storage: nullableNumber(value.max_storage),
    modules: strings(value.modules), trial_days: number(value.trial_days, 14), active: boolean(value.active, true),
    updated_at: string(value.updated_at),
  };
};
const parseTerms = (raw: unknown): PlatformSubscriptionTerms => {
  const value = record(raw, 'conditions');
  return {
    shop_id: string(value.shop_id), custom_monthly_price_xof: nullableNumber(value.custom_monthly_price_xof),
    auto_renew: boolean(value.auto_renew), auto_lock: boolean(value.auto_lock), grace_days: number(value.grace_days, 3),
    trial_ends_on: dateOrNull(value.trial_ends_on), scheduled_plan: nullableString(value.scheduled_plan) as SubscriptionPlanId | null,
    scheduled_change_on: dateOrNull(value.scheduled_change_on), cancelled_at: dateOrNull(value.cancelled_at),
    created_at: string(value.created_at), updated_at: string(value.updated_at),
  };
};
const parseCampaign = (raw: unknown): PlatformCampaign => {
  const value = record(raw, 'campagne');
  return {
    id: string(value.id), title: string(value.title), body: string(value.body),
    tone: string(value.tone, 'info') as PlatformCampaign['tone'],
    audience_type: string(value.audience_type, 'all') as PlatformCampaign['audience_type'],
    audience_value: nullableString(value.audience_value), channels: strings(value.channels) as PlatformCampaign['channels'],
    status: string(value.status, 'draft') as PlatformCampaign['status'], starts_at: dateOrNull(value.starts_at),
    ends_at: dateOrNull(value.ends_at), maintenance: boolean(value.maintenance), created_by: nullableString(value.created_by),
    created_at: string(value.created_at), updated_at: string(value.updated_at),
  };
};

export const parsePlatformOperationsSnapshot = (raw: unknown): PlatformOperationsSnapshot => {
  const value = record(raw, 'instantané');
  const system = record(value.system ?? {}, 'système');
  return {
    server_time: string(value.server_time),
    system: {
      database_name: string(system.database_name), postgres_version: string(system.postgres_version),
      latest_migration: nullableString(system.latest_migration), automation_scheduled: boolean(system.automation_scheduled),
    },
    plan_offers: list(value.plan_offers).map(parsePlanOffer),
    promo_codes: list(value.promo_codes).map((entry) => {
      const promo = record(entry, 'code promo');
      return { code: string(promo.code), discount_type: string(promo.discount_type, 'fixed') as 'percent' | 'fixed', value: number(promo.value), active: boolean(promo.active, true), starts_on: dateOrNull(promo.starts_on), ends_on: dateOrNull(promo.ends_on), max_uses: nullableNumber(promo.max_uses), created_at: string(promo.created_at) };
    }),
    subscription_terms: list(value.subscription_terms).map(parseTerms),
    invoices: list(value.invoices).map(parseInvoice),
    tickets: list(value.tickets).map(parseTicket),
    campaigns: list(value.campaigns).map(parseCampaign),
    outbound_messages: list(value.outbound_messages).map((entry) => {
      const item = record(entry, 'message sortant');
      return { id: string(item.id), campaign_id: nullableString(item.campaign_id), organization_id: nullableString(item.organization_id), recipient: string(item.recipient), channel: string(item.channel, 'email') as 'email' | 'whatsapp', subject: string(item.subject), body: string(item.body), status: string(item.status, 'queued') as PlatformOutboundMessage['status'], provider: nullableString(item.provider), provider_reference: nullableString(item.provider_reference), error: nullableString(item.error), scheduled_for: string(item.scheduled_for), created_at: string(item.created_at) };
    }),
    notifications: list(value.notifications).map((entry) => {
      const item = record(entry, 'notification');
      return { id: string(item.id), kind: string(item.kind), severity: string(item.severity, 'info') as PlatformNotification['severity'], title: string(item.title), body: string(item.body), organization_id: nullableString(item.organization_id), resource_type: nullableString(item.resource_type), resource_id: nullableString(item.resource_id), dedupe_key: nullableString(item.dedupe_key), read_at: dateOrNull(item.read_at), created_at: string(item.created_at) };
    }),
    audit: list(value.audit).map((entry) => {
      const item = record(entry, 'audit');
      return { id: string(item.id), organization_id: nullableString(item.organization_id), organization_name: nullableString(item.organization_name), actor_user_id: nullableString(item.actor_user_id), action: string(item.action), resource_type: nullableString(item.resource_type), resource_id: nullableString(item.resource_id), metadata: jsonRecord(item.metadata), created_at: string(item.created_at) };
    }),
    security_events: list(value.security_events).map((entry) => {
      const item = record(entry, 'événement sécurité');
      return { id: string(item.id), user_id: string(item.user_id), session_id: nullableString(item.session_id), event_type: string(item.event_type), ip: nullableString(item.ip), user_agent: nullableString(item.user_agent), created_at: string(item.created_at) };
    }),
    sessions: list(value.sessions).map((entry) => {
      const item = record(entry, 'session');
      return { id: string(item.id), created_at: dateOrNull(item.created_at), updated_at: dateOrNull(item.updated_at), refreshed_at: dateOrNull(item.refreshed_at), not_after: dateOrNull(item.not_after), ip: nullableString(item.ip), user_agent: nullableString(item.user_agent), aal: nullableString(item.aal) };
    }),
    automation_runs: list(value.automation_runs).map((entry) => {
      const item = record(entry, 'automatisation');
      return { id: string(item.id), actor_user_id: nullableString(item.actor_user_id), summary: jsonRecord(item.summary), created_at: string(item.created_at) };
    }),
    health_checks: list(value.health_checks).map((entry) => {
      const item = record(entry, 'état technique');
      return { id: string(item.id), component: string(item.component), status: string(item.status, 'down') as PlatformHealthCheck['status'], details: jsonRecord(item.details), checked_at: string(item.checked_at) };
    }),
  };
};

const DEMO_KEY = 'pressingpro_platform_operations_demo_v1';
const nowIso = () => new Date().toISOString();
const defaultOffers = (): PlatformPlanOffer[] => [
  { plan: 'free', monthly_price_xof: 0, max_shops: 1, max_users: 2, max_orders_month: 100, max_storage: 10, modules: ['pos', 'catalog', 'daily_reports', 'manual_backup'], trial_days: 14, active: true, updated_at: nowIso() },
  { plan: 'pro', monthly_price_xof: 12000, max_shops: 1, max_users: 8, max_orders_month: null, max_storage: null, modules: ['pos', 'catalog', 'daily_reports', 'manual_backup', 'customer_portal', 'delivery_tracking', 'delivery_proof', 'detailed_reports'], trial_days: 14, active: true, updated_at: nowIso() },
  { plan: 'business', monthly_price_xof: 29000, max_shops: 3, max_users: null, max_orders_month: null, max_storage: null, modules: ['pos', 'catalog', 'daily_reports', 'manual_backup', 'customer_portal', 'delivery_tracking', 'delivery_proof', 'detailed_reports', 'multi_shop', 'priority_support'], trial_days: 14, active: true, updated_at: nowIso() },
];
export const createEmptyOperationsSnapshot = (): PlatformOperationsSnapshot => ({
  server_time: nowIso(), system: { database_name: 'demo', postgres_version: 'Démonstration locale', latest_migration: 'local', automation_scheduled: false },
  plan_offers: defaultOffers(), promo_codes: [], subscription_terms: [], invoices: [], tickets: [], campaigns: [], outbound_messages: [], notifications: [], audit: [], security_events: [], sessions: [], automation_runs: [], health_checks: [],
});
const createDemoOperationsSnapshot = (): PlatformOperationsSnapshot => {
  const empty = createEmptyOperationsSnapshot();
  const invoice: PlatformInvoice = {
    id: 'demo-invoice-1', organization_id: 'demo-org-plateau', shop_id: 'demo-shop-plateau', organization_name: 'Buanderie du Plateau — démonstration', shop_name: 'Buanderie Plateau', invoice_number: 'PP-2026-000001', status: 'issued', currency: 'XOF', period_start: '2026-10-12', period_end: '2026-11-12', due_on: '2026-11-12', subtotal_xof: 29000, discount_xof: 0, total_xof: 29000, promo_code: null, note: 'Facture fictive de démonstration.', created_at: '2026-10-12T09:00:00.000Z', payments: [], credit_notes: [],
  };
  return {
    ...empty,
    promo_codes: [{ code: 'BIENVENUE', discount_type: 'percent' as const, value: 10, active: true, starts_on: null, ends_on: null, max_uses: 20, created_at: '2026-10-01T09:00:00.000Z' }],
    subscription_terms: [{ shop_id: 'demo-shop-plateau', custom_monthly_price_xof: null, auto_renew: true, auto_lock: false, grace_days: 3, trial_ends_on: null, scheduled_plan: null, scheduled_change_on: null, cancelled_at: null, created_at: '2026-10-12T09:00:00.000Z', updated_at: '2026-10-12T09:00:00.000Z' }],
    invoices: [invoice],
    tickets: [{ id: 'demo-ticket-1', organization_id: 'demo-org-harmonie', shop_id: 'demo-shop-harmonie-cocody', organization_name: 'Pressing Harmonie — démonstration', shop_name: 'Harmonie Cocody', ticket_number: 'TCK-000001', requester_user_id: 'demo-owner-harmonie', subject: 'Question fictive sur la configuration', status: 'open' as const, priority: 'normal' as const, created_at: '2026-10-28T10:00:00.000Z', updated_at: '2026-10-28T10:00:00.000Z', resolved_at: null, messages: [{ id: 'demo-message-1', author_type: 'tenant' as const, body: 'Ceci est un ticket entièrement fictif pour valider le parcours support.', internal: false, attachments: [], created_at: '2026-10-28T10:00:00.000Z' }] }],
    campaigns: [],
    notifications: [{ id: 'demo-notification-1', kind: 'plan_request', severity: 'info' as const, title: 'Demande de formule Pro', body: 'Notification fictive liée au compte Harmonie.', organization_id: 'demo-org-harmonie', resource_type: 'shop_subscription', resource_id: 'demo-shop-harmonie-cocody', dedupe_key: 'demo-1', read_at: null, created_at: '2026-10-28T14:30:00.000Z' }],
    health_checks: [{ id: 'demo-health-1', component: 'supabase_api', status: 'healthy' as const, details: { demonstration: true }, checked_at: '2026-10-29T09:00:00.000Z' }],
  };
};
const isLocalDemo = () => resolvePlatformAdminAccessMode(getStaffAccessEnvironment(isSupabaseConfigured)) === 'explicit-local-demo';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const readDemo = (): PlatformOperationsSnapshot => {
  if (typeof window === 'undefined') return createDemoOperationsSnapshot();
  const raw = window.localStorage.getItem(DEMO_KEY);
  if (!raw) return createDemoOperationsSnapshot();
  try { return parsePlatformOperationsSnapshot(JSON.parse(raw)); } catch { return createDemoOperationsSnapshot(); }
};
const writeDemo = (snapshot: PlatformOperationsSnapshot): PlatformOperationsSnapshot => {
  snapshot.server_time = nowIso();
  if (typeof window !== 'undefined') window.localStorage.setItem(DEMO_KEY, JSON.stringify(snapshot));
  return snapshot;
};
const requireClient = (client?: Client | null): Client => {
  const resolved = client ?? supabase;
  if (!resolved) throw new Error('Supabase n’est pas configuré dans cet environnement.');
  return resolved;
};
const throwRpc = (error: { message: string; code?: string } | null) => {
  if (!error) return;
  if (error.code === 'PGRST202' || error.message.includes('get_platform_operations_snapshot')) {
    throw new Error('Le module Opérations nécessite la migration 20261029180000_platform_operations.sql.');
  }
  throw new Error(error.message);
};

export async function fetchPlatformOperationsSnapshot(client?: Client | null): Promise<PlatformOperationsSnapshot> {
  if (isLocalDemo()) return readDemo();
  const { data, error } = await requireClient(client).rpc('get_platform_operations_snapshot');
  throwRpc(error);
  return parsePlatformOperationsSnapshot(data);
}

const demoAudit = (snapshot: PlatformOperationsSnapshot, action: string, resourceId: string | null, organizationId: string | null, before: unknown, after: unknown) => {
  snapshot.audit.unshift({ id: `demo-audit-${Date.now()}-${Math.random()}`, organization_id: organizationId, organization_name: null, actor_user_id: 'demo-admin', action, resource_type: action.split('.')[0], resource_id: resourceId, metadata: { before, after }, created_at: nowIso() });
};

const runDemoOperation = (action: PlatformOperationAction, payload: Record<string, unknown>): PlatformOperationsSnapshot => {
  const snapshot = readDemo();
  const id = () => `demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  if (action === 'plan_offer.update') {
    const offer = snapshot.plan_offers.find((entry) => entry.plan === payload.plan);
    if (!offer) throw new Error('Formule introuvable.');
    const before = clone(offer);
    Object.assign(offer, { monthly_price_xof: number(payload.monthly_price_xof), max_shops: nullableNumber(payload.max_shops), max_users: nullableNumber(payload.max_users), max_orders_month: nullableNumber(payload.max_orders_month), max_storage: nullableNumber(payload.max_storage), modules: strings(payload.modules), trial_days: number(payload.trial_days, 14), active: boolean(payload.active, true), updated_at: nowIso() });
    demoAudit(snapshot, action, offer.plan, null, before, offer);
  } else if (action === 'promo.save') {
    const code = string(payload.code).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new Error('Code promotionnel invalide.');
    const before = snapshot.promo_codes.find((entry) => entry.code === code) ?? null;
    const promo: PlatformPromoCode = { code, discount_type: string(payload.discount_type, 'fixed') as 'percent' | 'fixed', value: number(payload.value), active: boolean(payload.active, true), starts_on: nullableString(payload.starts_on), ends_on: nullableString(payload.ends_on), max_uses: nullableNumber(payload.max_uses), created_at: before?.created_at ?? nowIso() };
    snapshot.promo_codes = [...snapshot.promo_codes.filter((entry) => entry.code !== code), promo];
    demoAudit(snapshot, action, code, null, before, promo);
  } else if (action === 'terms.update') {
    const shopId = string(payload.shop_id);
    const before = snapshot.subscription_terms.find((entry) => entry.shop_id === shopId) ?? null;
    const terms: PlatformSubscriptionTerms = { shop_id: shopId, custom_monthly_price_xof: nullableNumber(payload.custom_monthly_price_xof), auto_renew: boolean(payload.auto_renew), auto_lock: boolean(payload.auto_lock), grace_days: number(payload.grace_days, 3), trial_ends_on: nullableString(payload.trial_ends_on), scheduled_plan: nullableString(payload.scheduled_plan) as SubscriptionPlanId | null, scheduled_change_on: nullableString(payload.scheduled_change_on), cancelled_at: boolean(payload.cancelled) ? nullableString(payload.cancelled_at) ?? nowIso() : null, created_at: before?.created_at ?? nowIso(), updated_at: nowIso() };
    snapshot.subscription_terms = [...snapshot.subscription_terms.filter((entry) => entry.shop_id !== shopId), terms];
    demoAudit(snapshot, action, shopId, null, before, terms);
  } else if (action === 'invoice.create') {
    const subtotal = number(payload.subtotal_xof);
    const discount = number(payload.discount_xof);
    if (subtotal <= 0 || discount < 0 || discount > subtotal) throw new Error('Montants de facture invalides.');
    const invoice: PlatformInvoice = { id: id(), organization_id: string(payload.organization_id), shop_id: string(payload.shop_id), organization_name: string(payload.organization_name, 'Client de démonstration'), shop_name: string(payload.shop_name, 'Agence de démonstration'), invoice_number: `PP-2026-${String(snapshot.invoices.length + 1).padStart(6, '0')}`, status: 'issued', currency: 'XOF', period_start: string(payload.period_start), period_end: string(payload.period_end), due_on: string(payload.due_on), subtotal_xof: subtotal, discount_xof: discount, total_xof: subtotal - discount, promo_code: nullableString(payload.promo_code), note: string(payload.note), created_at: nowIso(), payments: [], credit_notes: [] };
    snapshot.invoices.unshift(invoice);
    demoAudit(snapshot, action, invoice.id, invoice.organization_id, null, invoice);
  } else if (action === 'invoice.void') {
    const invoice = snapshot.invoices.find((entry) => entry.id === payload.invoice_id);
    if (!invoice || invoice.payments.some((entry) => entry.status === 'recorded')) throw new Error('Facture introuvable ou déjà encaissée.');
    const before = clone(invoice); invoice.status = 'void'; demoAudit(snapshot, action, invoice.id, invoice.organization_id, before, invoice);
  } else if (action === 'payment.record') {
    const invoice = snapshot.invoices.find((entry) => entry.id === payload.invoice_id);
    if (!invoice || invoice.status === 'void') throw new Error('Facture introuvable ou annulée.');
    const payment: PlatformPayment = { id: id(), organization_id: invoice.organization_id, invoice_id: invoice.id, amount_xof: number(payload.amount_xof), method: string(payload.method, 'other') as PlatformPaymentMethod, status: string(payload.status, 'recorded') as PlatformPayment['status'], reference: string(payload.reference), paid_at: nullableString(payload.paid_at) ?? nowIso(), note: string(payload.note), created_by: 'demo-admin', created_at: nowIso() };
    if (payment.amount_xof <= 0) throw new Error('Le montant doit être positif.');
    if (payment.status !== 'failed' && ['wave', 'orange_money', 'mtn_momo', 'moov_money'].includes(payment.method) && payment.reference.trim().length < 2) throw new Error('La référence opérateur est obligatoire pour cette transaction Mobile Money.');
    invoice.payments.unshift(payment);
    const net = invoice.payments.reduce((sum, entry) => sum + (entry.status === 'recorded' ? entry.amount_xof : entry.status === 'refunded' ? -entry.amount_xof : 0), 0);
    const credits = invoice.credit_notes.reduce((sum, entry) => sum + entry.amount_xof, 0);
    if (net < 0) { invoice.payments.shift(); throw new Error('Le remboursement dépasse les encaissements nets.'); }
    if (net + credits > invoice.total_xof) { invoice.payments.shift(); throw new Error('Le paiement dépasse le solde de la facture.'); }
    if (payment.status !== 'failed') invoice.status = net + credits >= invoice.total_xof ? 'paid' : invoice.due_on < nowIso().slice(0, 10) ? 'overdue' : 'issued';
    if (payment.status === 'failed') snapshot.notifications.unshift({ id: id(), kind: 'payment', severity: 'critical', title: 'Paiement en échec', body: `${invoice.invoice_number} · ${payment.note}`, organization_id: invoice.organization_id, resource_type: 'platform_invoice', resource_id: invoice.id, dedupe_key: payment.id, read_at: null, created_at: nowIso() });
    demoAudit(snapshot, action, payment.id, invoice.organization_id, null, payment);
  } else if (action === 'credit_note.create') {
    const invoice = snapshot.invoices.find((entry) => entry.id === payload.invoice_id);
    if (!invoice || invoice.status === 'void') throw new Error('Facture introuvable ou annulée.');
    const credit: PlatformCreditNote = { id: id(), organization_id: invoice.organization_id, invoice_id: invoice.id, credit_number: `AV-2026-${String(invoice.credit_notes.length + 1).padStart(6, '0')}`, amount_xof: number(payload.amount_xof), reason: string(payload.reason), created_by: 'demo-admin', created_at: nowIso() };
    const net = invoice.payments.reduce((sum, entry) => sum + (entry.status === 'recorded' ? entry.amount_xof : entry.status === 'refunded' ? -entry.amount_xof : 0), 0);
    const credits = invoice.credit_notes.reduce((sum, entry) => sum + entry.amount_xof, 0);
    if (credit.amount_xof <= 0 || net + credits + credit.amount_xof > invoice.total_xof) throw new Error('L’avoir dépasse le solde restant de la facture.');
    if (credit.reason.trim().length < 2) throw new Error('Le motif de l’avoir est obligatoire.');
    invoice.credit_notes.unshift(credit);
    invoice.status = net + credits + credit.amount_xof >= invoice.total_xof ? 'paid' : invoice.due_on < nowIso().slice(0, 10) ? 'overdue' : 'issued';
    demoAudit(snapshot, action, credit.id, invoice.organization_id, null, credit);
  } else if (action === 'ticket.create') {
    const ticket: PlatformSupportTicket = { id: id(), organization_id: string(payload.organization_id), shop_id: nullableString(payload.shop_id), organization_name: nullableString(payload.organization_name), shop_name: nullableString(payload.shop_name), ticket_number: `TCK-${String(snapshot.tickets.length + 1).padStart(6, '0')}`, requester_user_id: null, subject: string(payload.subject), status: 'open', priority: string(payload.priority, 'normal') as PlatformSupportTicket['priority'], created_at: nowIso(), updated_at: nowIso(), resolved_at: null, messages: string(payload.body).trim() ? [{ id: id(), author_type: 'platform', body: string(payload.body), internal: boolean(payload.internal), attachments: list(payload.attachments).map(parseAttachment), created_at: nowIso() }] : [] };
    snapshot.tickets.unshift(ticket); demoAudit(snapshot, action, ticket.id, ticket.organization_id, null, ticket);
  } else if (action === 'ticket.update') {
    const ticket = snapshot.tickets.find((entry) => entry.id === payload.ticket_id);
    if (!ticket) throw new Error('Ticket introuvable.');
    const before = clone(ticket); ticket.status = string(payload.status, ticket.status) as PlatformSupportTicket['status']; ticket.priority = string(payload.priority, ticket.priority) as PlatformSupportTicket['priority']; ticket.updated_at = nowIso(); ticket.resolved_at = ['resolved', 'closed'].includes(ticket.status) ? nowIso() : null;
    demoAudit(snapshot, action, ticket.id, ticket.organization_id, before, ticket);
  } else if (action === 'ticket.reply') {
    const ticket = snapshot.tickets.find((entry) => entry.id === payload.ticket_id);
    if (!ticket) throw new Error('Ticket introuvable.');
    const message: PlatformSupportMessage = { id: id(), author_type: 'platform', body: string(payload.body), internal: boolean(payload.internal), attachments: list(payload.attachments).map(parseAttachment), created_at: nowIso() };
    ticket.messages.push(message); ticket.updated_at = nowIso(); if (!message.internal) ticket.status = 'pending';
    demoAudit(snapshot, action, message.id, ticket.organization_id, null, message);
  } else if (action === 'campaign.save' || action === 'campaign.status') {
    let campaign = snapshot.campaigns.find((entry) => entry.id === payload.id);
    const before = campaign ? clone(campaign) : null;
    if (!campaign && action === 'campaign.save') {
      campaign = { id: id(), title: '', body: '', tone: 'info', audience_type: 'all', audience_value: null, channels: ['in_app'], status: 'draft', starts_at: null, ends_at: null, maintenance: false, created_by: 'demo-admin', created_at: nowIso(), updated_at: nowIso() };
      snapshot.campaigns.unshift(campaign);
    }
    if (!campaign) throw new Error('Campagne introuvable.');
    if (action === 'campaign.status') campaign.status = string(payload.status, campaign.status) as PlatformCampaign['status'];
    else Object.assign(campaign, { title: string(payload.title), body: string(payload.body), tone: string(payload.tone, 'info'), audience_type: string(payload.audience_type, 'all'), audience_value: nullableString(payload.audience_value), channels: strings(payload.channels), status: string(payload.status, 'draft'), starts_at: nullableString(payload.starts_at), ends_at: nullableString(payload.ends_at), maintenance: boolean(payload.maintenance), updated_at: nowIso() });
    demoAudit(snapshot, action, campaign.id, null, before, campaign);
  } else if (action === 'outbound.cancel') {
    const message = snapshot.outbound_messages.find((entry) => entry.id === payload.id); if (message?.status === 'queued') message.status = 'cancelled';
  } else if (action === 'notifications.read') {
    snapshot.notifications.forEach((entry) => { if (boolean(payload.all) || strings(payload.ids).includes(entry.id)) entry.read_at = nowIso(); });
  } else if (action === 'automation.run') {
    snapshot.automation_runs.unshift({ id: id(), actor_user_id: 'demo-admin', summary: { overdue_invoices: 0, renewal_invoices: 0, trials_closed: 0, campaigns_published: 0, organizations_locked: 0 }, created_at: nowIso() });
  } else if (action === 'health.check') {
    snapshot.health_checks.unshift({ id: id(), component: 'supabase_api', status: 'healthy', details: { demonstration: true, checked_at: nowIso() }, checked_at: nowIso() });
  }
  return writeDemo(snapshot);
};

export async function runPlatformOperation(
  action: PlatformOperationAction,
  payload: Record<string, unknown> = {},
  client?: Client | null,
): Promise<PlatformOperationsSnapshot> {
  if (isLocalDemo()) return runDemoOperation(action, payload);
  const { data, error } = await requireClient(client).rpc('admin_platform_command', { p_action: action, p_payload: payload as unknown as Json });
  throwRpc(error);
  return parsePlatformOperationsSnapshot(data);
}

export async function fetchMySupportSnapshot(client?: Client | null): Promise<PlatformSupportTicket[]> {
  if (isLocalDemo()) return [];
  const { data, error } = await requireClient(client).rpc('get_my_support_snapshot');
  throwRpc(error);
  return list(record(data).tickets).map(parseTicket);
}
export async function runTenantSupportCommand(action: 'create' | 'reply', payload: Record<string, unknown>, client?: Client | null): Promise<PlatformSupportTicket[]> {
  if (isLocalDemo()) throw new Error('Le support serveur est disponible avec un compte Supabase réel.');
  const { data, error } = await requireClient(client).rpc('tenant_support_command', { p_action: action, p_payload: payload as unknown as Json });
  throwRpc(error);
  return list(record(data).tickets).map(parseTicket);
}

export const getInvoiceNetPaid = (invoice: PlatformInvoice): number =>
  invoice.payments.reduce((sum, payment) => sum + (payment.status === 'recorded' ? payment.amount_xof : payment.status === 'refunded' ? -payment.amount_xof : 0), 0);
export const getInvoiceCredits = (invoice: PlatformInvoice): number => invoice.credit_notes.reduce((sum, credit) => sum + credit.amount_xof, 0);
export const getInvoiceBalance = (invoice: PlatformInvoice): number => Math.max(0, invoice.total_xof - getInvoiceNetPaid(invoice) - getInvoiceCredits(invoice));

export const getPlatformCommercialMetrics = (
  organizations: readonly PlatformAdminOrganization[],
  operations: PlatformOperationsSnapshot,
  now = new Date(),
) => {
  const terms = new Map(operations.subscription_terms.map((entry) => [entry.shop_id, entry]));
  const prices = new Map(operations.plan_offers.map((entry) => [entry.plan, entry.monthly_price_xof]));
  const shops = organizations.flatMap((organization) => organization.shops.map((shop) => ({ organization, shop })));
  const month = now.toISOString().slice(0, 7);
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
  const in30Key = in30.toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const payments = operations.invoices.flatMap((invoice) => invoice.payments);
  return {
    mrr: shops.reduce((sum, { organization, shop }) => organization.status === 'active' && shop.subscription.status === 'actif' && shop.subscription.plan !== 'free' ? sum + (terms.get(shop.id)?.custom_monthly_price_xof ?? prices.get(shop.subscription.plan) ?? 0) : sum, 0),
    collectedThisMonth: payments.filter((payment) => payment.paid_at.startsWith(month)).reduce((sum, payment) => sum + (payment.status === 'recorded' ? payment.amount_xof : payment.status === 'refunded' ? -payment.amount_xof : 0), 0),
    overdue: operations.invoices.filter((invoice) => invoice.status === 'overdue').length,
    outstanding: operations.invoices.filter((invoice) => ['issued', 'overdue'].includes(invoice.status)).reduce((sum, invoice) => sum + getInvoiceBalance(invoice), 0),
    trials: shops.filter(({ shop }) => shop.subscription.status === 'essai').length,
    active: organizations.filter((organization) => organization.status === 'active').length,
    suspended: organizations.filter((organization) => organization.status === 'suspended').length,
    registrations30: organizations.filter((organization) => organization.created_at.slice(0, 10) >= new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)).length,
    cancellations: operations.subscription_terms.filter((entry) => entry.cancelled_at !== null).length,
    renewals30: shops.filter(({ shop }) => shop.subscription.renews_on && shop.subscription.renews_on >= today && shop.subscription.renews_on <= in30Key).length,
    openTickets: operations.tickets.filter((ticket) => ['open', 'pending'].includes(ticket.status)).length,
    unreadNotifications: operations.notifications.filter((notification) => !notification.read_at).length,
    planDistribution: (['free', 'pro', 'business'] as const).map((plan) => ({ plan, count: shops.filter(({ shop }) => shop.subscription.plan === plan).length })),
  };
};

const csvCell = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
export const buildOperationsCsv = (headers: readonly string[], rows: readonly (readonly unknown[])[]): string =>
  `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
export const downloadOperationsCsv = (filename: string, headers: readonly string[], rows: readonly (readonly unknown[])[]): void => {
  const blob = new Blob([buildOperationsCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
export const buildInvoicePrintHtml = (invoice: PlatformInvoice, receipt = false): string => {
  const payments = invoice.payments.filter((payment) => payment.status !== 'failed');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoice_number)}</title><style>body{font:14px Arial,sans-serif;color:#18181b;max-width:800px;margin:40px auto;padding:0 24px}header{display:flex;justify-content:space-between;border-bottom:3px solid #2563eb;padding-bottom:20px}h1{font-size:26px}table{width:100%;border-collapse:collapse;margin-top:28px}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}th{background:#f4f4f5}.right{text-align:right}.total{font-size:20px;font-weight:bold}.muted{color:#71717a}@media print{body{margin:0}}</style></head><body><header><div><h1>PressingPro CI</h1><div class="muted">Administration des abonnements</div></div><div><strong>${receipt ? 'REÇU' : 'FACTURE'}</strong><br>${escapeHtml(invoice.invoice_number)}<br>${escapeHtml(invoice.created_at.slice(0, 10))}</div></header><h2>${escapeHtml(invoice.organization_name)}</h2><p>${escapeHtml(invoice.shop_name)} · Période ${escapeHtml(invoice.period_start)} → ${escapeHtml(invoice.period_end)}<br>Échéance : ${escapeHtml(invoice.due_on)}</p><table><thead><tr><th>Description</th><th class="right">Montant</th></tr></thead><tbody><tr><td>Abonnement PressingPro CI</td><td class="right">${invoice.subtotal_xof.toLocaleString('fr-FR')} FCFA</td></tr><tr><td>Remise ${invoice.promo_code ? `(${escapeHtml(invoice.promo_code)})` : ''}</td><td class="right">−${invoice.discount_xof.toLocaleString('fr-FR')} FCFA</td></tr><tr class="total"><td>Total</td><td class="right">${invoice.total_xof.toLocaleString('fr-FR')} FCFA</td></tr><tr><td>Solde</td><td class="right">${getInvoiceBalance(invoice).toLocaleString('fr-FR')} FCFA</td></tr></tbody></table>${receipt ? `<h3>Règlements</h3><table><tbody>${payments.map((payment) => `<tr><td>${escapeHtml(payment.paid_at.slice(0, 10))} · ${escapeHtml(payment.method)} · ${escapeHtml(payment.status)}<br><span class="muted">${escapeHtml(payment.reference)}</span></td><td class="right">${payment.status === 'refunded' ? '−' : ''}${payment.amount_xof.toLocaleString('fr-FR')} FCFA</td></tr>`).join('')}</tbody></table>` : ''}<p class="muted">${escapeHtml(invoice.note)}</p><script>window.addEventListener('load',()=>window.print())</script></body></html>`;
};
export const printPlatformInvoice = (invoice: PlatformInvoice, receipt = false): void => {
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Autorisez les fenêtres contextuelles pour imprimer le document.');
  popup.document.write(buildInvoicePrintHtml(invoice, receipt));
  popup.document.close();
};

export const PLATFORM_PAYMENT_METHOD_LABELS: Record<PlatformPaymentMethod, string> = {
  cash: 'Espèces', wave: 'Wave', orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', moov_money: 'Moov Money', bank_transfer: 'Virement bancaire', other: 'Autre',
};
export const formatPlatformDate = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
};
export const formatXof = (value: number): string => `${value.toLocaleString('fr-FR')} FCFA`;
export type { SubscriptionStatus };
