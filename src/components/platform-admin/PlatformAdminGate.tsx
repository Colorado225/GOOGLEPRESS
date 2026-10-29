import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { getStaffAccessEnvironment, resolvePlatformAdminAccessMode } from '../../lib/staffAccess';
import { isPlatformAdminUser } from '../../lib/platformAdmin';
import { PLATFORM_ADMIN_PATH } from '../../lib/platformAdminAuth';
import { STAFF_LOGIN_PATH, mapStaffAuthError } from '../../lib/staffAuth';
import {
  StaffAuthAlert,
  StaffAuthHeader,
  StaffAuthLoading,
  staffPanelClassName,
  staffShellClassName,
} from '../auth/StaffAuthCommon';
import {
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from '../auth/authStyles';
import { PlatformMfaGate } from './PlatformMfaGate';

/**
 * Frontière de l'éditeur SaaS. Elle ne monte jamais AppProvider : un
 * super-admin n'hérite ni des données de démonstration ni d'un workspace
 * tenant. La table platform_admins et les RPC restent l'autorité serveur.
 */
export const PlatformAdminGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mode = resolvePlatformAdminAccessMode(getStaffAccessEnvironment(isSupabaseConfigured));
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(mode === 'supabase-required');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const sessionUserId = session?.user.id ?? null;

  useEffect(() => {
    document.title = 'Administration plateforme — PressingPro CI';
  }, []);

  useEffect(() => {
    if (mode !== 'supabase-required' || !supabase) return;
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (cancelled) return;
        if (sessionError) setError(mapStaffAuthError(sessionError));
        setSession(data.session);
      })
      .finally(() => {
        if (!cancelled) setLoadingSession(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoadingSession(false);
      if (!nextSession) setIsAdmin(null);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'supabase-required' || !sessionUserId) return;
    let cancelled = false;
    setIsAdmin(null);
    setError(null);
    isPlatformAdminUser(sessionUserId)
      .then((allowed) => {
        if (!cancelled) setIsAdmin(allowed);
      })
      .catch((adminError) => {
        if (cancelled) return;
        setIsAdmin(false);
        setError(
          adminError instanceof Error
            ? adminError.message
            : 'La vérification du rôle super-admin a échoué.'
        );
      });
    return () => {
      cancelled = true;
    };
  }, [mode, refreshTick, sessionUserId]);

  const shouldRedirect =
    mode === 'supabase-required' && !loadingSession && session === null;
  useEffect(() => {
    if (shouldRedirect) {
      window.location.replace(
        `${STAFF_LOGIN_PATH}?retour=${encodeURIComponent(PLATFORM_ADMIN_PATH)}`
      );
    }
  }, [shouldRedirect]);

  if (mode === 'explicit-local-demo') return <>{children}</>;
  if (shouldRedirect) return <StaffAuthLoading label="Redirection vers la connexion…" />;

  if (mode === 'configuration-required' || !supabase) {
    return (
      <main className={staffShellClassName}>
        <section className={staffPanelClassName}>
          <StaffAuthHeader
            title="Administration indisponible"
            description="L’espace super-admin exige Supabase et une session authentifiée. Aucune donnée de démonstration n’est chargée dans ce build."
          />
        </section>
      </main>
    );
  }

  if (loadingSession || (session && isAdmin === null)) {
    return <StaffAuthLoading label="Vérification exclusive du super-admin…" />;
  }

  const signOut = async () => {
    if (signingOut || !supabase) return;
    setSigningOut(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(mapStaffAuthError(signOutError));
      setSigningOut(false);
    }
  };

  if (session && isAdmin === true) return <PlatformMfaGate>{children}</PlatformMfaGate>;

  return (
    <main className={staffShellClassName}>
      <section className={staffPanelClassName} aria-labelledby="platform-admin-denied-title">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </div>
        <div id="platform-admin-denied-title">
          <StaffAuthHeader
            title="Accès super-admin refusé"
            description="Cet espace est réservé à l’unique administrateur actif enregistré dans platform_admins. Un propriétaire, un employé ou un client de pressing ne peut pas y entrer."
          />
        </div>
        <div className="mt-5 space-y-4">
          {error && <StaffAuthAlert tone="error">{error}</StaffAuthAlert>}
          {session?.user.email && (
            <p className="break-all rounded-xl bg-zinc-50 px-3 py-2 text-[12.5px] text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">
              Compte vérifié : <strong>{session.user.email}</strong>
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className={authSecondaryButtonClassName}
              onClick={() => setRefreshTick((value) => value + 1)}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Revérifier
            </button>
            <button
              type="button"
              className={authPrimaryButtonClassName}
              onClick={() => void signOut()}
              disabled={signingOut}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Fermer cette session
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};
