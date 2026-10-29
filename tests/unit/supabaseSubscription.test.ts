import { describe, expect, it } from 'vitest';
import {
  fetchRemoteSubscription,
  getRemoteTrialDays,
  parseRemoteSubscription,
  requestRemotePlanChange,
  toSubscriptionState,
} from '../../src/lib/supabaseSubscription';

/** Réponse de `get_shop_subscription_state` pour une agence en essai. */
const remotePayload = () => ({
  plan: 'free',
  status: 'essai',
  effective_plan: 'pro',
  requested_plan: null,
  requested_at: null,
  renews_on: null,
  trial_started_at: '2026-10-20T08:00:00+00:00',
  trial_ends_at: '2026-11-03T08:00:00+00:00',
  trial_active: true,
  trial_days_left: 5,
  limits: { users: 8, orders_per_month: null, storage_locations: null },
  usage: { users: 2, orders_this_month: 12, storage_locations: 3 },
});

const fakeClient = (result: { data?: unknown; error?: { message: string } | null }) => {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return { data: result.data ?? null, error: result.error ?? null };
    },
  };
  return { client: client as never, calls };
};

describe('supabaseSubscription — lecture de l’état', () => {
  it('accepte une réponse complète et la traduit pour l’affichage', () => {
    const remote = parseRemoteSubscription(remotePayload());
    expect(remote.plan).toBe('free');
    expect(remote.effectivePlan).toBe('pro');
    expect(remote.trialActive).toBe(true);
    expect(remote.trialDaysLeft).toBe(5);
    expect(remote.limits.ordersPerMonth).toBeNull();
    expect(remote.modules).toBeNull();

    const state = toSubscriptionState(remote);
    expect(state.plan).toBe('free');
    expect(state.effectivePlan).toBe('pro');
    expect(state.trialStartedAt).toBe('2026-10-20T08:00:00+00:00');
    expect(state.trialEndsAt).toBe('2026-11-03T08:00:00+00:00');
    expect(state.requestedPlan).toBeNull();
  });

  it('lit une demande en attente', () => {
    const remote = parseRemoteSubscription({
      ...remotePayload(),
      plan: 'business',
      requested_plan: 'pro',
      requested_at: '2026-10-25T10:00:00+00:00',
    });
    expect(remote.requestedPlan).toBe('pro');
    expect(toSubscriptionState(remote).requestedAt).toBe('2026-10-25T10:00:00+00:00');
  });

  it('valide les modules serveur et conserve la compatibilité avec leur absence', () => {
    expect(parseRemoteSubscription({ ...remotePayload(), modules: ['pos', 'delivery_tracking'] }).modules)
      .toEqual(['pos', 'delivery_tracking']);
    expect(parseRemoteSubscription({ ...remotePayload(), modules: [] }).modules).toEqual([]);
    expect(parseRemoteSubscription(remotePayload()).modules).toBeNull();
    expect(() => parseRemoteSubscription({ ...remotePayload(), modules: ['pos', 42] })).toThrow(/modules/i);
  });

  it('refuse une formule ou un statut inconnus', () => {
    expect(() => parseRemoteSubscription({ ...remotePayload(), plan: 'platinum' })).toThrow(
      /formule plan inconnue/i
    );
    expect(() => parseRemoteSubscription({ ...remotePayload(), status: 'perdu' })).toThrow(
      /statut inconnu/i
    );
  });

  it('refuse des quotas ou un essai mal formés', () => {
    expect(() =>
      parseRemoteSubscription({
        ...remotePayload(),
        limits: { users: 'huit', orders_per_month: null, storage_locations: null },
      })
    ).toThrow(/plafond users/i);
    expect(() => parseRemoteSubscription({ ...remotePayload(), trial_days_left: -2 })).toThrow(
      /nombre trial_days_left/i
    );
    expect(() => parseRemoteSubscription('pas un objet')).toThrow(/invalide/i);
  });

  it('calcule la durée d’essai annoncée par la base', () => {
    expect(
      getRemoteTrialDays({
        trialStartedAt: '2026-10-20T08:00:00+00:00',
        trialEndsAt: '2026-11-03T08:00:00+00:00',
      })
    ).toBe(14);
    expect(
      getRemoteTrialDays({ trialStartedAt: 'date invalide', trialEndsAt: '2026-11-03T08:00:00Z' })
    ).toBe(14);
  });
});

describe('supabaseSubscription — appels', () => {
  it('lit l’abonnement de l’agence demandée', async () => {
    const { client, calls } = fakeClient({ data: remotePayload() });
    const state = await fetchRemoteSubscription('shop-1', client);
    expect(calls).toEqual([
      { fn: 'get_shop_subscription_state', args: { p_shop_id: 'shop-1' } },
    ]);
    expect(state.effectivePlan).toBe('pro');
  });

  it('remonte le message d’erreur de la base', async () => {
    const { client } = fakeClient({ error: { message: 'Accès refusé à cette agence' } });
    await expect(fetchRemoteSubscription('shop-1', client)).rejects.toThrow(
      /Accès refusé à cette agence/
    );
  });

  it('dépose une demande sans appliquer la formule', async () => {
    const { client, calls } = fakeClient({
      data: { ...remotePayload(), requested_plan: 'pro', requested_at: '2026-10-29T09:00:00Z' },
    });
    const state = await requestRemotePlanChange('shop-1', 'pro', client);
    expect(calls).toEqual([
      { fn: 'request_subscription_plan', args: { p_shop_id: 'shop-1', p_plan: 'pro' } },
    ]);
    expect(state.plan).toBe('free');
    expect(state.requestedPlan).toBe('pro');
  });
});
