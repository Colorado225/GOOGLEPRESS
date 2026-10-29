import { useEffect, useState } from 'react';
import type { ActionResult } from '../../types';
import type { WorkspaceScope } from '../../lib/workspaceScope';
import { scopeStorageKey } from '../../lib/workspaceScope';
import { resolveEffectivePlanId } from '../../lib/planAccess';
import {
  SUBSCRIPTION_STORAGE_KEY,
  resolveDefaultSubscription,
  type SubscriptionPlanId,
  type SubscriptionState,
} from '../../lib/subscription';
import {
  fetchRemoteSubscription,
  requestRemotePlanChange,
  toSubscriptionState,
} from '../../lib/supabaseSubscription';
import { persistString } from '../../lib/localPersistence';
import type { SubscriptionSource } from './types';

export interface SubscriptionStore {
  subscription: SubscriptionState;
  subscriptionSource: SubscriptionSource;
  effectivePlanId: SubscriptionPlanId;
  /** Modules fournis par la RPC ; null = repli historique/local, [] = accès fermé. */
  subscriptionModules: string[] | null;
  chooseSubscriptionPlan: (planId: SubscriptionPlanId) => Promise<ActionResult>;
  refreshSubscription: () => Promise<ActionResult>;
}

/**
 * État d'attente d'un espace réel : Free sans essai, donc sans fonction
 * payante tant que la base n'a pas répondu. On préfère fermer que d'ouvrir
 * une formule que rien ne prouve.
 */
const unverifiedSubscription = (): SubscriptionState => ({
  plan: 'free',
  status: 'essai',
  renewsOn: null,
  trialStartedAt: null,
  trialEndsAt: null,
  effectivePlan: 'free',
  requestedPlan: null,
});

/**
 * Abonnement de l'agence.
 *
 * En espace réel, la formule et la date de départ de l'essai vivent dans la
 * base (`public.shop_subscriptions`). Le navigateur ne conserve donc plus
 * aucune date d'essai : effacer le stockage local ne remet pas le compteur à
 * zéro. La démonstration locale, elle, reste autonome.
 */
export const useSubscriptionStore = (workspace: WorkspaceScope): SubscriptionStore => {
  const [subscription, setSubscription] = useState<SubscriptionState>(() =>
    workspace.mode === 'live' ? unverifiedSubscription() : resolveDefaultSubscription(workspace)
  );
  const [subscriptionSource, setSubscriptionSource] = useState<SubscriptionSource>(() =>
    workspace.mode === 'live' ? 'chargement' : 'local'
  );
  const [subscriptionModules, setSubscriptionModules] = useState<string[] | null>(() =>
    workspace.mode === 'live' ? [] : null
  );

  const subscriptionShopId = workspace.mode === 'live' ? workspace.shopId : null;

  useEffect(() => {
    if (!subscriptionShopId) {
      setSubscription(resolveDefaultSubscription(workspace));
      setSubscriptionSource('local');
      setSubscriptionModules(null);
      return;
    }
    let cancelled = false;
    setSubscription(unverifiedSubscription());
    setSubscriptionModules([]);
    setSubscriptionSource('chargement');
    void (async () => {
      try {
        const remote = await fetchRemoteSubscription(subscriptionShopId);
        if (cancelled) return;
        setSubscription(toSubscriptionState(remote));
        setSubscriptionModules(remote.modules);
        setSubscriptionSource('serveur');
      } catch {
        if (cancelled) return;
        // Repli fermé et assumé : sans état serveur, aucune fonction payante
        // n'est ouverte. L'écran Paramètres l'explique en une phrase.
        setSubscription(unverifiedSubscription());
        setSubscriptionModules([]);
        setSubscriptionSource('indisponible');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionShopId, workspace]);

  // Essai de 14 jours : un compte Free dispose des fonctions Pro jusqu'à
  // l'échéance, puis retombe sur ses plafonds sans rien perdre. La formule
  // effective vient du serveur dès qu'elle est lue.
  const effectivePlanId = resolveEffectivePlanId(subscription);

  const refreshSubscription = async (): Promise<ActionResult> => {
    if (!subscriptionShopId) return { ok: true };
    try {
      const remote = await fetchRemoteSubscription(subscriptionShopId);
      setSubscription(toSubscriptionState(remote));
      setSubscriptionModules(remote.modules);
      setSubscriptionSource('serveur');
      return { ok: true };
    } catch (error) {
      setSubscription(unverifiedSubscription());
      setSubscriptionModules([]);
      setSubscriptionSource('indisponible');
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Abonnement indisponible.',
      };
    }
  };

  const chooseSubscriptionPlan = async (planId: SubscriptionPlanId): Promise<ActionResult> => {
    if (!subscriptionShopId) {
      const next: SubscriptionState = { ...subscription, plan: planId };
      setSubscription(next);
      persistString(
        scopeStorageKey(workspace, SUBSCRIPTION_STORAGE_KEY),
        JSON.stringify(next)
      );
      return { ok: true };
    }
    try {
      // Le client ne fait que déposer une demande : la formule est appliquée
      // par l'éditeur, côté base.
      const remote = await requestRemotePlanChange(subscriptionShopId, planId);
      setSubscription(toSubscriptionState(remote));
      setSubscriptionModules(remote.modules);
      setSubscriptionSource('serveur');
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Demande de formule impossible.',
      };
    }
  };

  return {
    subscription,
    subscriptionSource,
    effectivePlanId,
    subscriptionModules,
    refreshSubscription,
    chooseSubscriptionPlan,
  };
};
