import { describe, expect, it } from 'vitest';
import {
  SUBSCRIPTION_PLANS,
  getSubscriptionPlan,
  getSubscriptionStatusLabel,
  getSubscriptionStatusTone,
  normalizeSubscription,
  resolveDefaultSubscription,
} from '../../src/lib/subscription';

describe('subscription — formules', () => {
  it('expose trois formules identifiables', () => {
    expect(SUBSCRIPTION_PLANS.map((plan) => plan.id)).toEqual([
      'decouverte',
      'standard',
      'pro',
    ]);
  });

  it('résout une formule connue et retombe sur la première sinon', () => {
    expect(getSubscriptionPlan('pro').label).toBe('Formule Pro');
    // @ts-expect-error — valeur inattendue venue d'une sauvegarde ancienne
    expect(getSubscriptionPlan('inconnue').id).toBe('decouverte');
  });
});

describe('subscription — état par défaut', () => {
  it('démarre en Découverte/essai sur un espace réel', () => {
    const state = resolveDefaultSubscription({ mode: 'live' });
    expect(state.plan).toBe('decouverte');
    expect(state.status).toBe('essai');
    expect(state.renewsOn).toBeNull();
  });

  it('ne prétend jamais à un abonnement payé en démonstration', () => {
    const state = resolveDefaultSubscription({ mode: 'demo' });
    expect(state.plan).toBe('pro');
    expect(state.status).not.toBe('actif');
  });
});

describe('subscription — validation des sauvegardes', () => {
  const fallback = resolveDefaultSubscription({ mode: 'live' });

  it('accepte un état valide', () => {
    expect(
      normalizeSubscription({ plan: 'standard', status: 'actif', renewsOn: '2026-12-31' }, fallback)
    ).toEqual({ plan: 'standard', status: 'actif', renewsOn: '2026-12-31' });
  });

  it('rejette les valeurs douteuses une par une', () => {
    expect(normalizeSubscription({ plan: 'or', status: 'peut-être' }, fallback)).toEqual({
      plan: fallback.plan,
      status: fallback.status,
      renewsOn: null,
    });
  });

  it('ignore une valeur non-objet', () => {
    expect(normalizeSubscription('texte', fallback)).toEqual(fallback);
    expect(normalizeSubscription(null, fallback)).toEqual(fallback);
  });

  it('nettoie une échéance vide', () => {
    expect(
      normalizeSubscription({ plan: 'pro', status: 'actif', renewsOn: '   ' }, fallback)
        .renewsOn
    ).toBeNull();
  });
});

describe('subscription — libellés', () => {
  it('distingue clairement essai et abonnement payé', () => {
    expect(getSubscriptionStatusLabel('essai')).toContain('sans facturation');
    expect(getSubscriptionStatusLabel('actif')).toBe('Abonnement actif');
    expect(getSubscriptionStatusLabel('suspendu')).toBe('Abonnement suspendu');
  });

  it('fournit des classes visuelles complètes (aucune concaténation)', () => {
    for (const status of ['essai', 'actif', 'suspendu'] as const) {
      const tone = getSubscriptionStatusTone(status);
      expect(tone.chip).toMatch(/^bg-\S+ .*border-\S+$/);
      expect(tone.dot).toMatch(/^bg-\S+$/);
    }
  });
});
