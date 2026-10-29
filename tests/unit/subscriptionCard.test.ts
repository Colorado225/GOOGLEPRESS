import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SubscriptionPlanCard } from '../../src/components/layout/SubscriptionPlanCard';
import type { SubscriptionState } from '../../src/lib/subscription';

const trialState: SubscriptionState = {
  plan: 'free',
  status: 'essai',
  renewsOn: null,
  trialStartedAt: '2026-10-20T08:00:00.000Z',
  trialEndsAt: '2026-11-03T08:00:00.000Z',
  effectivePlan: 'pro',
  requestedPlan: null,
};

const render = (subscription: SubscriptionState, source: 'local' | 'chargement' | 'serveur' | 'indisponible') =>
  renderToStaticMarkup(
    React.createElement(SubscriptionPlanCard, { subscription, source })
  );

describe('SubscriptionPlanCard — provenance de l’abonnement', () => {
  it('affiche l’essai Pro quand la base a répondu', () => {
    const html = render(trialState, 'serveur');
    expect(html).toContain('Essai Pro');
    expect(html).toContain('Essai de 14 jours');
  });

  it('ne prétend rien pendant la lecture de la base', () => {
    const html = render(
      { plan: 'free', status: 'essai', renewsOn: null, trialStartedAt: null },
      'chargement'
    );
    expect(html).toContain('Lecture de la formule dans la base');
    expect(html).not.toContain('Essai Pro');
  });

  it('signale un abonnement non vérifié et ferme les fonctions payantes', () => {
    const html = render(
      { plan: 'free', status: 'essai', renewsOn: null, trialStartedAt: null },
      'indisponible'
    );
    expect(html).toContain('Abonnement non vérifié');
    expect(html).toContain('Fonctions payantes fermées');
    expect(html).not.toContain('Essai Pro');
  });

  it('affiche la demande de formule en attente', () => {
    const html = render(
      { ...trialState, plan: 'free', requestedPlan: 'business' },
      'serveur'
    );
    expect(html).toContain('Demande envoyée');
    expect(html).toContain('Business');
  });
});
