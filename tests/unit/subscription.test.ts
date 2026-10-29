import { describe, expect, it } from 'vitest';
import {
  SUBSCRIPTION_PLANS,
  buildPlanRequestMessage,
  canUpgradeFrom,
  formatPlanLimit,
  formatXof,
  getSubscriptionPlan,
  formatTrialRemaining,
  getSubscriptionStatusLabel,
  getSubscriptionStatusTone,
  getTrialInfo,
  getYearlySavingXof,
  normalizeSubscription,
  resolveDefaultSubscription,
} from '../../src/lib/subscription';

describe('subscription — les trois formules', () => {
  it('expose Free, Pro et Business dans cet ordre', () => {
    expect(SUBSCRIPTION_PLANS.map((plan) => plan.id)).toEqual(['free', 'pro', 'business']);
    expect(SUBSCRIPTION_PLANS.map((plan) => plan.label)).toEqual(['Free', 'Pro', 'Business']);
  });

  it('garde des prix croissants et une formule gratuite à zéro', () => {
    const [free, pro, business] = SUBSCRIPTION_PLANS;
    expect(free.priceMonthlyXof).toBe(0);
    expect(free.priceYearlyXof).toBe(0);
    expect(pro.priceMonthlyXof).toBeGreaterThan(0);
    expect(business.priceMonthlyXof).toBeGreaterThan(pro.priceMonthlyXof);
  });

  it('offre deux mois sur le paiement annuel', () => {
    for (const plan of SUBSCRIPTION_PLANS.filter((candidate) => candidate.priceMonthlyXof > 0)) {
      expect(getYearlySavingXof(plan)).toBe(plan.priceMonthlyXof * 2);
    }
  });

  it('met en avant une seule formule', () => {
    expect(SUBSCRIPTION_PLANS.filter((plan) => plan.highlighted)).toHaveLength(1);
  });

  it('résout une formule connue et retombe sur la première sinon', () => {
    expect(getSubscriptionPlan('business').label).toBe('Business');
    // @ts-expect-error — valeur inattendue venue d'une sauvegarde ancienne
    expect(getSubscriptionPlan('inconnue').id).toBe('free');
  });

  it('sait s’il reste une formule supérieure', () => {
    expect(canUpgradeFrom('free')).toBe(true);
    expect(canUpgradeFrom('pro')).toBe(true);
    expect(canUpgradeFrom('business')).toBe(false);
  });
});

describe('subscription — état par défaut', () => {
  it('démarre en Free/essai sur un espace réel', () => {
    const start = new Date('2026-10-29T08:00:00.000Z');
    const state = resolveDefaultSubscription({ mode: 'live' }, start);
    expect(state.plan).toBe('free');
    expect(state.status).toBe('essai');
    expect(state.renewsOn).toBeNull();
    expect(state.trialStartedAt).toBe(start.toISOString());
  });

  it('ne prétend jamais à un abonnement payé en démonstration', () => {
    const state = resolveDefaultSubscription({ mode: 'demo' });
    expect(state.plan).toBe('pro');
    expect(state.status).not.toBe('actif');
    // Pas de chronomètre en démonstration.
    expect(state.trialStartedAt).toBeNull();
  });
});

describe('subscription — validation des sauvegardes', () => {
  const fallback = resolveDefaultSubscription({ mode: 'live' });

  it('accepte un état valide et conserve la date d’essai enregistrée', () => {
    expect(
      normalizeSubscription(
        {
          plan: 'business',
          status: 'actif',
          renewsOn: '2026-12-31',
          trialStartedAt: '2026-10-01T10:00:00.000Z',
        },
        fallback
      )
    ).toEqual({
      plan: 'business',
      status: 'actif',
      renewsOn: '2026-12-31',
      trialStartedAt: '2026-10-01T10:00:00.000Z',
    });
  });

  it('garde le départ d’essai du fallback quand la sauvegarde n’en a pas', () => {
    expect(
      normalizeSubscription({ plan: 'free' }, fallback).trialStartedAt
    ).toBe(fallback.trialStartedAt);
  });

  it('relit les anciens noms de formules sans perdre le choix', () => {
    expect(normalizeSubscription({ plan: 'decouverte' }, fallback).plan).toBe('free');
    expect(normalizeSubscription({ plan: 'standard' }, fallback).plan).toBe('pro');
  });

  it('rejette les valeurs douteuses une par une', () => {
    expect(normalizeSubscription({ plan: 'or', status: 'peut-être' }, fallback)).toEqual({
      plan: fallback.plan,
      status: fallback.status,
      renewsOn: null,
      trialStartedAt: fallback.trialStartedAt,
    });
  });

  it('ignore une valeur non-objet', () => {
    expect(normalizeSubscription('texte', fallback)).toEqual(fallback);
    expect(normalizeSubscription(null, fallback)).toEqual(fallback);
  });

  it('vide une échéance qui n’est pas une date lisible', () => {
    expect(normalizeSubscription({ renewsOn: '   ' }, fallback).renewsOn).toBeNull();
  });
});

describe('subscription — affichage', () => {
  it('formate les montants en FCFA avec des espaces', () => {
    expect(formatXof(12_000)).toBe('12 000 FCFA');
    expect(formatXof(0)).toBe('0 FCFA');
    expect(formatXof(-500)).toBe('0 FCFA');
  });

  it('écrit les limites lisibles', () => {
    expect(formatPlanLimit('illimite')).toBe('Illimité');
    expect(formatPlanLimit(100)).toBe('100');
  });

  it('nomme les statuts sans jamais promettre un paiement', () => {
    expect(getSubscriptionStatusLabel('essai')).toContain('sans facturation');
    expect(getSubscriptionStatusTone('actif').dot).toContain('emerald');
    expect(getSubscriptionStatusTone('suspendu').dot).toContain('red');
  });
});

describe('subscription — demande envoyée à l’équipe', () => {
  it('récapitule la formule, le prix et l’agence', () => {
    const message = buildPlanRequestMessage({
      planId: 'pro',
      yearly: true,
      shopName: 'Press COCO',
    });
    expect(message).toContain('formule Pro');
    expect(message).toContain('Press COCO');
    expect(message).toContain('120 000 FCFA');
    expect(message).toContain('/ an');
  });

  it('ne parle pas d’argent pour la formule gratuite', () => {
    const message = buildPlanRequestMessage({
      planId: 'free',
      yearly: false,
      shopName: 'Press COCO',
    });
    expect(message).toContain('formule gratuite');
    expect(message).not.toContain('FCFA');
  });
});

describe('subscription — chronomètre de 14 jours', () => {
  const startedAt = '2026-10-01T09:00:00.000Z';
  const day = 24 * 60 * 60 * 1000;

  it('affiche 14 jours au démarrage', () => {
    const info = getTrialInfo({ trialStartedAt: startedAt }, new Date(startedAt));
    expect(info.active).toBe(true);
    expect(info.totalDays).toBe(14);
    expect(info.daysLeft).toBe(14);
    expect(info.elapsedPercent).toBe(0);
    expect(formatTrialRemaining(info)).toBe('14 jours restants');
  });

  it('décompte les jours et les heures', () => {
    const fiveDaysLater = new Date(new Date(startedAt).getTime() + 5 * day);
    const info = getTrialInfo({ trialStartedAt: startedAt }, fiveDaysLater);
    expect(info.daysLeft).toBe(9);
    expect(formatTrialRemaining(info)).toBe('9 jours restants');

    const lastHalfDay = new Date(new Date(startedAt).getTime() + 13.5 * day);
    const nearly = getTrialInfo({ trialStartedAt: startedAt }, lastHalfDay);
    expect(nearly.daysLeft).toBe(1);
    expect(nearly.hoursLeft).toBe(12);
    expect(formatTrialRemaining(nearly)).toBe('12 h restantes');
  });

  it('s’arrête pile à l’échéance', () => {
    const expiry = new Date(new Date(startedAt).getTime() + 14 * day);
    const info = getTrialInfo({ trialStartedAt: startedAt }, expiry);
    expect(info.active).toBe(false);
    expect(info.daysLeft).toBe(0);
    expect(info.elapsedPercent).toBe(100);
    expect(formatTrialRemaining(info)).toBe('Essai terminé');
  });

  it('ne démarre pas sans date valide', () => {
    const info = getTrialInfo({ trialStartedAt: 'date invalide' });
    expect(info.active).toBe(false);
    expect(info.daysLeft).toBe(0);
    expect(info.endsAt).toBeNull();
  });
});
