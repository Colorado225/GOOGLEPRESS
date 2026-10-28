import React, { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  isValidEmail,
  mapSupabaseAuthError,
  validateCustomerLogin,
  validateNewPassword,
} from '../../lib/customerAuth';
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
  customerInputClassName,
  customerPrimaryButtonClassName,
  customerSecondaryButtonClassName,
} from '../customer/CustomerAuthLayout';

const staffLabelClassName =
  'mb-1.5 block text-[12px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300';

interface StaffAccessGateProps {
  children: React.ReactNode;
}

type AuthView = 'login' | 'forgot';

const shellClassName =
  'flex min-h-screen items-center justify-center bg-[#f4f4f5] px-4 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50';
const panelClassName =
  'w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900';

const AlertMessage: React.FC<{ tone: 'error' | 'success' | 'warning'; children: React.ReactNode }> = ({
  tone,
  children,
}) => {
  const classes =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-2 rounded-2xl border px-3.5 py-3 text-[13px] font-medium ${classes}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
};

const GateHeader: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <header>
    <p className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">
      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      PressingPro CI — accès personnel
    </p>
    <h1 className="mt-3 text-2xl font-black tracking-tight">{title}</h1>
    <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
      {description}
    </p>
  </header>
);

export const StaffAccessGate: React.FC<StaffAccessGateProps> = ({ children }) => {
  const mode = resolveStaffAccessMode(getStaffAccessEnvironment(isSupabaseConfigured));
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<RemoteMembership[]>([]);
  const [loadingSession, setLoadingSession] = useState(mode === 'supabase-required' && Boolean(supabase));
  const [checkingMemberships, setCheckingMemberships] = useState(false);
  const [membershipCheckComplete, setMembershipCheckComplete] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [refreshTick, setRefreshTick] = useState(0);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'supabase-required') {
      document.title = 'Connexion personnel — PressingPro CI';
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'supabase-required' || !supabase) return;

    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (cancelled) return;
        if (sessionError) setError(mapSupabaseAuthError(sessionError));
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

  if (mode === 'explicit-local-demo') return <>{children}</>;

  if (mode === 'configuration-required') {
    return (
      <main className={shellClassName}>
        <section className={panelClassName} aria-labelledby="staff-config-title">
          <GateHeader
            title="Configuration requise"
            description="Ce build de production ne peut pas ouvrir l’ERP sans le client Supabase du personnel. Aucune donnée de démonstration n’a été chargée."
          />
          <div className="mt-5">
            <AlertMessage tone="error">
              Renseignez `VITE_SUPABASE_URL` et la clé publique Supabase, puis
              redéployez. Le mode local doit être explicitement réservé à une
              démonstration avec `VITE_ALLOW_LOCAL_DEMO=true`.
            </AlertMessage>
          </div>
        </section>
      </main>
    );
  }

  if (!supabase) {
    return (
      <main className={shellClassName}>
        <section className={panelClassName}>
          <GateHeader
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
      setError(mapSupabaseAuthError(signOutError));
      return;
    }
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage('Session fermée sur cet appareil.');
  };

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const validationError = validateCustomerLogin({ email, password });
    setMessage(null);
    setError(validationError);
    if (validationError) return;

    setBusy(true);
    const { error: signInError } = await authClient.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    setPassword('');
    if (signInError) {
      setError(mapSupabaseAuthError(signInError));
      return;
    }
    setMessage('Session ouverte. Vérification de vos accès d’agence…');
  };

  const submitResetRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setMessage(null);
    if (!isValidEmail(email)) {
      setError('Saisissez une adresse e-mail valide.');
      return;
    }
    setError(null);
    setBusy(true);
    const { error: resetError } = await authClient.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/` }
    );
    setBusy(false);
    if (resetError) {
      setError(mapSupabaseAuthError(resetError));
      return;
    }
    setMessage(
      'Si un compte personnel correspond à cette adresse, un lien de réinitialisation vient d’être envoyé.'
    );
  };

  const submitNewPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const validationError = validateNewPassword(newPassword, confirmPassword);
    setMessage(null);
    setError(validationError);
    if (validationError) return;

    setBusy(true);
    const { error: updateError } = await authClient.auth.updateUser({ password: newPassword });
    setBusy(false);
    setNewPassword('');
    setConfirmPassword('');
    if (updateError) {
      setError(mapSupabaseAuthError(updateError));
      return;
    }
    setRecoveryMode(false);
    setRefreshTick((value) => value + 1);
    setMessage('Mot de passe modifié. Vérification de vos accès d’agence…');
  };

  if (loadingSession || (session && (checkingMemberships || !membershipCheckComplete) && !recoveryMode)) {
    return (
      <main className={shellClassName}>
        <p className={`${panelClassName} flex items-center justify-center gap-2 text-center text-[13.5px] font-semibold`}>
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Vérification de la session et des autorisations…
        </p>
      </main>
    );
  }

  if (session && recoveryMode) {
    return (
      <main className={shellClassName}>
        <section className={panelClassName}>
          <GateHeader
            title="Nouveau mot de passe"
            description="Choisissez le nouveau mot de passe de votre compte personnel, puis vos accès d’agence seront revérifiés."
          />
          <form className="mt-6 space-y-4" onSubmit={(event) => void submitNewPassword(event)} noValidate>
            {error && <AlertMessage tone="error">{error}</AlertMessage>}
            {message && <AlertMessage tone="success">{message}</AlertMessage>}
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
            <button type="submit" className={customerPrimaryButtonClassName} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
              Enregistrer le mot de passe
            </button>
            <button type="button" className={customerSecondaryButtonClassName} onClick={() => void signOut()} disabled={busy}>
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
      <main className={shellClassName}>
        <section className={panelClassName}>
          <GateHeader
            title="Aucun accès d’agence actif"
            description="Votre compte est authentifié, mais il n’est rattaché à aucun rôle actif d’un pressing. L’ERP reste fermé."
          />
          <div className="mt-5 space-y-4">
            {error ? (
              <AlertMessage tone="error">{error}</AlertMessage>
            ) : (
              <AlertMessage tone="warning">
                Demandez au propriétaire ou à l’administrateur de créer ou de
                réactiver votre membership. Un compte client ne donne pas
                accès aux écrans du personnel.
              </AlertMessage>
            )}
            <dl className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[13px] dark:border-zinc-800 dark:bg-zinc-800/60">
              <dt className="font-bold text-zinc-500 dark:text-zinc-400">Compte connecté</dt>
              <dd className="mt-1 break-all font-semibold">{session.user.email ?? 'Non renseigné'}</dd>
              <dt className="mt-3 font-bold text-zinc-500 dark:text-zinc-400">Rôles renvoyés</dt>
              <dd className="mt-1 font-semibold">
                {memberships.length > 0
                  ? memberships.map((membership) => formatStaffRole(membership.role)).join(', ')
                  : 'Aucun'}
              </dd>
            </dl>
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

  return (
    <main className={shellClassName}>
      <section className={panelClassName}>
        <GateHeader
          title={authView === 'login' ? 'Connexion du personnel' : 'Mot de passe oublié'}
          description={
            authView === 'login'
              ? 'Connectez-vous avec le compte créé par le propriétaire de votre pressing. Les écrans métier ne s’ouvrent qu’avec un rôle actif.'
              : 'Nous enverrons un lien de réinitialisation si cette adresse correspond à un compte personnel.'
          }
        />

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) =>
            void (authView === 'login' ? submitLogin(event) : submitResetRequest(event))
          }
          noValidate
        >
          {error && <AlertMessage tone="error">{error}</AlertMessage>}
          {message && <AlertMessage tone="success">{message}</AlertMessage>}

          <div>
            <label htmlFor="staff-email" className={staffLabelClassName}>
              Adresse e-mail
            </label>
            <input
              id="staff-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={customerInputClassName}
              disabled={busy}
              required
            />
          </div>

          {authView === 'login' && (
            <PasswordField
              id="staff-password"
              label="Mot de passe"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              disabled={busy}
            />
          )}

          <button type="submit" className={customerPrimaryButtonClassName} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : authView === 'login' ? (
              <LogIn className="h-4 w-4" aria-hidden="true" />
            ) : (
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            )}
            {authView === 'login' ? 'Se connecter' : 'Envoyer le lien'}
          </button>

          <button
            type="button"
            className={customerSecondaryButtonClassName}
            disabled={busy}
            onClick={() => {
              setAuthView((value) => (value === 'login' ? 'forgot' : 'login'));
              setError(null);
              setMessage(null);
              setPassword('');
            }}
          >
            {authView === 'login' ? 'Mot de passe oublié' : 'Retour à la connexion'}
          </button>
        </form>

        <p className="mt-5 flex gap-2 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Il n’y a pas d’inscription libre du personnel ni de mot de passe par
          défaut. Les comptes et rôles sont attribués de façon contrôlée par le
          propriétaire ou l’administrateur de la plateforme.
        </p>
      </section>
    </main>
  );
};
