import React, { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { KeyRound, Loader2, LogOut, RefreshCw, Store } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { validateNewPassword } from '../../lib/customerAuth';
import {
  STAFF_ONBOARDING_PATH,
  mapStaffAuthError,
} from '../../lib/staffAuth';
import { getStaffLoginRedirectPath } from '../../lib/routes';
import {
  formatStaffRole,
  getActiveStaffMemberships,
  getStaffAccessEnvironment,
  resolveStaffAccessMode,
} from '../../lib/staffAccess';
import {
  listCurrentMemberships,
  type RemoteMembership,
} from '../../lib/supabaseOrders';
import {
  PasswordField,
  customerPrimaryButtonClassName,
  customerSecondaryButtonClassName,
} from '../customer/CustomerAuthLayout';
import {
  StaffAuthAlert,
  StaffAuthHeader,
  StaffAuthLoading,
  staffPanelClassName,
  staffShellClassName,
} from './StaffAuthCommon';

interface StaffAccessGateProps {
  children: React.ReactNode;
}

/**
 * Frontière d'accès de l'ERP :
 * - démonstration locale explicite (développement ou variable dédiée) :
 *   l'ERP s'ouvre immédiatement, avec des données locales du navigateur ;
 * - production configurée : session Supabase + membership actif exigés.
 *   Sans session, on redirige vers la page /connexion ; sans rattachement,
 *   un propriétaire peut créer son pressing via /bienvenue ;
 * - production non configurée : erreur de configuration, jamais de démo
 *   implicite.
 * Cette garde n'est qu'une frontière d'interface : la RLS et les RPC
 * PostgreSQL restent l'autorité pour chaque donnée et chaque action.
 */
export const StaffAccessGate: React.FC<StaffAccessGateProps> = ({ children }) => {
  const mode = resolveStaffAccessMode(getStaffAccessEnvironment(isSupabaseConfigured));
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<RemoteMembership[]>([]);
  const [loadingSession, setLoadingSession] = useState(
    mode === 'supabase-required' && Boolean(supabase)
  );
  const [checkingMemberships, setCheckingMemberships] = useState(false);
  const [membershipCheckComplete, setMembershipCheckComplete] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'supabase-required') {
      document.title = 'Accès personnel — PressingPro CI';
    }
  }, [mode]);

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

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoadingSession(false);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (!nextSession) {
        setMemberships([]);
        setMembershipCheckComplete(false);
        setRecoveryMode(false);
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [mode]);

  const loadMemberships = useCallback(async () => {
    if (!supabase || !session || recoveryMode) return;
    setCheckingMemberships(true);
    setMembershipCheckComplete(false);
    setError(null);
    try {
      const remoteMemberships = await listCurrentMemberships(session.user.id);
      setMemberships(remoteMemberships);
    } catch (membershipError) {
      setMemberships([]);
      setError(
        membershipError instanceof Error
          ? membershipError.message
          : 'Les autorisations de ce compte sont illisibles.'
      );
    } finally {
      setCheckingMemberships(false);
      setMembershipCheckComplete(true);
    }
  }, [recoveryMode, session]);

  useEffect(() => {
    if (mode !== 'supabase-required' || !session || recoveryMode) return;
    void loadMemberships();
  }, [loadMemberships, mode, recoveryMode, refreshTick, session]);

  // Aucune session établie : la connexion vit sur sa page dédiée. Si le
  // visiteur visait un écran ERP précis (lien profond), la destination est
  // conservée en paramètre `retour` — validée par liste blanche côté
  // connexion — pour l'y ramener après authentification.
  const shouldRedirectToLogin =
    mode === 'supabase-required' && !loadingSession && !session && !recoveryMode;
  useEffect(() => {
    if (shouldRedirectToLogin) {
      window.location.replace(
        getStaffLoginRedirectPath(window.location.pathname)
      );
    }
  }, [shouldRedirectToLogin]);

  if (mode === 'explicit-local-demo') return <>{children}</>;

  if (mode === 'configuration-required') {
    return (
      <main className={staffShellClassName}>
        <section className={staffPanelClassName} aria-labelledby="staff-config-title">
          <StaffAuthHeader
            title="Configuration requise"
            description="Ce build de production ne peut pas ouvrir l’ERP sans le client Supabase du personnel. Aucune donnée de démonstration n’a été chargée."
          />
          <div className="mt-5">
            <StaffAuthAlert tone="error">
              Renseignez `VITE_SUPABASE_URL` et la clé publique Supabase, puis
              redéployez. Le mode local doit être explicitement réservé à une
              démonstration avec `VITE_ALLOW_LOCAL_DEMO=true`.
            </StaffAuthAlert>
          </div>
        </section>
      </main>
    );
  }

  if (!supabase) {
    return (
      <main className={staffShellClassName}>
        <section className={staffPanelClassName}>
          <StaffAuthHeader
            title="Service d’authentification indisponible"
            description="La configuration annonce Supabase, mais le client n’a pas pu être initialisé."
          />
        </section>
      </main>
    );
  }

  const authClient = supabase;
  const activeMemberships = getActiveStaffMemberships(memberships);

  if (!recoveryMode && session && membershipCheckComplete && activeMemberships.length > 0) {
    return <>{children}</>;
  }

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: signOutError } = await authClient.auth.signOut();
    setBusy(false);
    if (signOutError) {
      setError(mapStaffAuthError(signOutError));
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    // La perte de session déclenche la redirection vers /connexion.
  };

  const submitNewPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const validationError = validateNewPassword(newPassword, confirmPassword);
    setMessage(null);
    setError(validationError);
    if (validationError) return;

    setBusy(true);
    const { error: updateError } = await authClient.auth.updateUser({
      password: newPassword,
    });
    setBusy(false);
    setNewPassword('');
    setConfirmPassword('');
    if (updateError) {
      setError(mapStaffAuthError(updateError));
      return;
    }
    setRecoveryMode(false);
    setRefreshTick((value) => value + 1);
    setMessage('Mot de passe modifié. Vérification de vos accès d’agence…');
  };

  if (shouldRedirectToLogin) {
    return <StaffAuthLoading label="Redirection vers la page de connexion…" />;
  }

  if (
    loadingSession ||
    (session && (checkingMemberships || !membershipCheckComplete) && !recoveryMode)
  ) {
    return (
      <StaffAuthLoading label="Vérification de la session et des autorisations…" />
    );
  }

  if (session && recoveryMode) {
    return (
      <main className={staffShellClassName}>
        <section className={staffPanelClassName}>
          <StaffAuthHeader
            title="Nouveau mot de passe"
            description="Choisissez le nouveau mot de passe de votre compte personnel, puis vos accès d’agence seront revérifiés."
          />
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => void submitNewPassword(event)}
            noValidate
          >
            {error && <StaffAuthAlert tone="error">{error}</StaffAuthAlert>}
            {message && <StaffAuthAlert tone="success">{message}</StaffAuthAlert>}
            <PasswordField
              id="staff-new-password"
              label="Nouveau mot de passe"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              disabled={busy}
            />
            <p className="-mt-2 text-[12px] text-zinc-500 dark:text-zinc-400">
              Au moins 8 caractères.
            </p>
            <PasswordField
              id="staff-confirm-password"
              label="Confirmer le mot de passe"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              disabled={busy}
            />
            <button
              type="submit"
              className={customerPrimaryButtonClassName}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              )}
              Enregistrer le mot de passe
            </button>
            <button
              type="button"
              className={customerSecondaryButtonClassName}
              onClick={() => void signOut()}
              disabled={busy}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Fermer cette session
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (session && membershipCheckComplete && activeMemberships.length === 0) {
    return (
      <main className={staffShellClassName}>
        <section className={staffPanelClassName}>
          <StaffAuthHeader
            title="Aucun accès d’agence actif"
            description="Votre compte est authentifié, mais il n’est rattaché à aucun rôle actif d’un pressing. L’ERP reste fermé."
          />
          <div className="mt-5 space-y-4">
            {error ? (
              <StaffAuthAlert tone="error">{error}</StaffAuthAlert>
            ) : (
              <StaffAuthAlert tone="warning">
                Vous gérez un pressing ? Créez votre organisation ci-dessous.
                Vous êtes employé(e) ? Demandez à votre propriétaire ou
                responsable d’activer votre accès. Un compte client ne donne
                pas accès aux écrans du personnel.
              </StaffAuthAlert>
            )}
            <dl className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[13px] dark:border-zinc-800 dark:bg-zinc-800/60">
              <dt className="font-bold text-zinc-500 dark:text-zinc-400">
                Compte connecté
              </dt>
              <dd className="mt-1 break-all font-semibold">
                {session.user.email ?? 'Non renseigné'}
              </dd>
              <dt className="mt-3 font-bold text-zinc-500 dark:text-zinc-400">
                Rôles renvoyés
              </dt>
              <dd className="mt-1 font-semibold">
                {memberships.length > 0
                  ? memberships
                      .map((membership) => formatStaffRole(membership.role))
                      .join(', ')
                  : 'Aucun'}
              </dd>
            </dl>
            <a href={STAFF_ONBOARDING_PATH} className={customerPrimaryButtonClassName}>
              <Store className="h-4 w-4" aria-hidden="true" />
              Créer mon pressing
            </a>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className={customerSecondaryButtonClassName}
                onClick={() => setRefreshTick((value) => value + 1)}
                disabled={busy || checkingMemberships}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Revérifier mes accès
              </button>
              <button
                type="button"
                className={customerSecondaryButtonClassName}
                onClick={() => void signOut()}
                disabled={busy}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Se déconnecter
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return <StaffAuthLoading label="Vérification de la session et des autorisations…" />;
};
