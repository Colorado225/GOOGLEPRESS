import React, { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Loader2, ShieldAlert } from 'lucide-react';
import {
  CUSTOMER_HOME_PATH,
  CUSTOMER_LOGIN_PATH,
  CUSTOMER_PASSWORD_PATH,
  getCustomerRouteTitle,
  type CustomerRoute,
} from '../../lib/customerAuth';
import { supabase } from '../../lib/supabase';
import { syncCustomerProfile } from '../../lib/supabaseCustomer';
import { CustomerAccountPage } from './CustomerAccountPage';
import {
  CustomerNavLink,
  customerSecondaryButtonClassName,
  type CustomerNavigate,
} from './CustomerAuthLayout';
import { CustomerLoginPage } from './CustomerLoginPage';
import { CustomerPasswordResetPage } from './CustomerPasswordResetPage';
import { CustomerRegisterPage } from './CustomerRegisterPage';

interface CustomerPortalAppProps {
  route: CustomerRoute;
  onNavigate: CustomerNavigate;
}

export const CustomerPortalApp: React.FC<CustomerPortalAppProps> = ({
  route,
  onNavigate,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(supabase));
  const [authError, setAuthError] = useState<string | null>(null);
  const syncedUserIdsRef = useRef(new Set<string>());

  useEffect(() => {
    document.title = getCustomerRouteTitle(route);
  }, [route]);

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false);
      return;
    }

    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setAuthError(error.message);
        setSession(data.session);
      })
      .finally(() => {
        if (!cancelled) setLoadingSession(false);
      });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoadingSession(false);
      if (event === 'PASSWORD_RECOVERY') {
        onNavigate(CUSTOMER_PASSWORD_PATH, { replace: true });
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [onNavigate]);

  useEffect(() => {
    if (!supabase || !session) return;
    if (syncedUserIdsRef.current.has(session.user.id)) return;
    syncedUserIdsRef.current.add(session.user.id);

    void syncCustomerProfile(session.user).catch(() => {
      // La page Mon espace relit ensuite le profil et permet de corriger les
      // coordonnées ; un échec de cette recopie ne doit pas bloquer la session.
      syncedUserIdsRef.current.delete(session.user.id);
    });
  }, [session]);

  useEffect(() => {
    if (loadingSession) return;

    if (route.kind === 'account' && !session) {
      onNavigate(CUSTOMER_LOGIN_PATH, { replace: true });
    }
    if ((route.kind === 'login' || route.kind === 'register') && session) {
      onNavigate(CUSTOMER_HOME_PATH, { replace: true });
    }
  }, [loadingSession, onNavigate, route.kind, session]);

  if (route.kind === 'not-found') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f4f5] px-4 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <section className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-xl shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-600 dark:text-amber-300" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-black">Page client introuvable</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Ce lien ne correspond pas à une page de l’espace client.
          </p>
          <CustomerNavLink
            href={CUSTOMER_LOGIN_PATH}
            onNavigate={onNavigate}
            className={`${customerSecondaryButtonClassName} mt-5 w-full`}
          >
            Aller à la connexion
          </CustomerNavLink>
        </section>
      </main>
    );
  }

  if (loadingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f4f5] px-4 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <p className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-[13.5px] font-semibold shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Vérification de votre session…
        </p>
      </main>
    );
  }

  if (authError && route.kind === 'account') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f4f5] px-4 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <section className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-6 shadow-xl shadow-zinc-950/5 dark:border-red-900 dark:bg-zinc-900">
          <h1 className="text-xl font-black">Session illisible</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-red-700 dark:text-red-300">
            {authError}
          </p>
          <CustomerNavLink
            href={CUSTOMER_LOGIN_PATH}
            onNavigate={onNavigate}
            className={`${customerSecondaryButtonClassName} mt-5 w-full`}
          >
            Retourner à la connexion
          </CustomerNavLink>
        </section>
      </main>
    );
  }

  if (route.kind === 'login') return <CustomerLoginPage onNavigate={onNavigate} />;
  if (route.kind === 'register') return <CustomerRegisterPage onNavigate={onNavigate} />;
  if (route.kind === 'password') {
    return <CustomerPasswordResetPage session={session} onNavigate={onNavigate} />;
  }

  // Pendant la redirection vers la connexion, ne pas afficher l'espace vide.
  if (!session) return null;
  return <CustomerAccountPage session={session} onNavigate={onNavigate} />;
};
