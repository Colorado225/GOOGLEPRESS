import { describe, expect, it } from 'vitest';
import {
  buildInvoicePrintHtml,
  buildOperationsCsv,
  createEmptyOperationsSnapshot,
  getInvoiceBalance,
  getInvoiceNetPaid,
  getPlatformCommercialMetrics,
  parsePlatformOperationsSnapshot,
  type PlatformInvoice,
} from '../../src/lib/platformOperations';
import type { PlatformAdminOrganization } from '../../src/lib/platformAdmin';

const invoice: PlatformInvoice = {
  id: 'inv-1', organization_id: 'org-1', shop_id: 'shop-1', organization_name: 'Pressing <script>',
  shop_name: 'Cocody', invoice_number: 'PP-2026-000001', status: 'issued', currency: 'XOF',
  period_start: '2026-10-01', period_end: '2026-11-01', due_on: '2026-11-01', subtotal_xof: 12000,
  discount_xof: 2000, total_xof: 10000, promo_code: null, note: 'Abonnement', created_at: '2026-10-15T10:00:00.000Z',
  payments: [
    { id: 'pay-1', organization_id: 'org-1', invoice_id: 'inv-1', amount_xof: 6000, method: 'wave', status: 'recorded', reference: 'W-1', paid_at: '2026-10-20T10:00:00.000Z', note: '', created_by: null, created_at: '2026-10-20T10:00:00.000Z' },
    { id: 'pay-2', organization_id: 'org-1', invoice_id: 'inv-1', amount_xof: 1000, method: 'wave', status: 'refunded', reference: 'R-1', paid_at: '2026-10-21T10:00:00.000Z', note: '', created_by: null, created_at: '2026-10-21T10:00:00.000Z' },
  ],
  credit_notes: [{ id: 'credit-1', organization_id: 'org-1', invoice_id: 'inv-1', credit_number: 'AV-1', amount_xof: 1000, reason: 'Geste commercial', created_by: null, created_at: '2026-10-21T10:00:00.000Z' }],
};
const organization: PlatformAdminOrganization = {
  id: 'org-1', name: 'Pressing <script>', slug: 'pressing', status: 'active', created_at: '2026-10-01T09:00:00.000Z', owner: null,
  shops: [{ id: 'shop-1', name: 'Cocody', slug: 'cocody', status: 'active', city: null, phone_display: null, email: null, subscription: { plan: 'pro', status: 'actif', requested_plan: null, requested_at: null, trial_started_at: null, renews_on: '2026-11-01' } }],
  support_notes: [],
};

describe('opérations commerciales de la plateforme', () => {
  it('valide un instantané vide sans inventer de données métier', () => {
    const parsed = parsePlatformOperationsSnapshot(createEmptyOperationsSnapshot());
    expect(parsed.invoices).toEqual([]);
    expect(parsed.plan_offers.map((offer) => offer.plan)).toEqual(['free', 'pro', 'business']);
    expect(parsed).not.toHaveProperty('orders');
    expect(parsed).not.toHaveProperty('customers');
    expect(() => parsePlatformOperationsSnapshot(null)).toThrow(/invalide/i);
  });

  it('calcule le net payé, les avoirs et le solde', () => {
    expect(getInvoiceNetPaid(invoice)).toBe(5000);
    expect(getInvoiceBalance(invoice)).toBe(4000);
  });

  it('utilise le tarif personnalisé dans le MRR et agrège les indicateurs', () => {
    const operations = createEmptyOperationsSnapshot();
    operations.invoices = [invoice];
    operations.subscription_terms = [{ shop_id: 'shop-1', custom_monthly_price_xof: 10000, auto_renew: true, auto_lock: false, grace_days: 3, trial_ends_on: null, scheduled_plan: null, scheduled_change_on: null, cancelled_at: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' }];
    const metrics = getPlatformCommercialMetrics([organization], operations, new Date('2026-10-29T12:00:00.000Z'));
    expect(metrics.mrr).toBe(10000);
    expect(metrics.collectedThisMonth).toBe(5000);
    expect(metrics.active).toBe(1);
    expect(metrics.renewals30).toBe(1);
    expect(metrics.outstanding).toBe(4000);
    expect(metrics.planDistribution).toEqual([{ plan: 'free', count: 0 }, { plan: 'pro', count: 1 }, { plan: 'business', count: 0 }]);
  });

  it('exporte un CSV Excel sûr avec séparateurs et guillemets échappés', () => {
    const csv = buildOperationsCsv(['Nom', 'Note'], [['Pressing "Alpha"', 'Ligne 1; Ligne 2']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Pressing ""Alpha"""');
    expect(csv).toContain('"Ligne 1; Ligne 2"');
  });

  it('échappe le contenu des documents imprimables', () => {
    const html = buildInvoicePrintHtml(invoice, true);
    expect(html).toContain('Pressing &lt;script&gt;');
    expect(html).not.toContain('Pressing <script>');
    expect(html).toContain('REÇU');
    expect(html).toContain('W-1');
  });
});
