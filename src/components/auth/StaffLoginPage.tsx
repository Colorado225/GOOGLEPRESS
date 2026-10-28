import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, LogIn, Mail, Store } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { isValidEmail, validateCustomerLogin } from '../../lib/customerAuth';
import {
  STAFF_REGISTER_PATH,
  mapStaffAuthError,
  resolveStaffPostAuthPath,
} from '../../lib/staffAuth';
import { listCurrentMemberships } from '../../lib/supabaseOrders';
import {
  StaffAuthAlert,
  StaffAuthHeader,
  StaffAuthLink,
  StaffAuthLoading,
} from './StaffAuthCommon';
import {
  StaffAuthLayout,
  StaffPasswordField,
  StaffTextField,
  staffPrimaryButtonClassName,
  staffSecondaryButtonClassName,
} from './StaffAuthLayout';

interface StaffLoginPageProps {
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
}

type AuthView = 'login' | 'forgot';

export const StaffLoginPage: React.FC<StaffLoginPageProps> = ({ onNavigate }) => {
  const authClient = supabase;
  const configured = isSupabaseConfigured && authClient !== null;

  const [authView, setAuthView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Connexion du personnel — PressingPro CI';
  }, []);

  // Session déjà ouverte sur cet appareil : inutile de redemander le mot de
  // passe, on part directement vers l'ERP ou l'onboarding selon les rôles.
  useEffect(() => {
    if (!authClient) return;
    let cancelled = false;

    authClient.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled || !data.session) return;
        const memberships = await listCurrentMemberships(data.session.user.id);
        if (!cancelled) {
          onNavigate(resolveStaffPostAuthPath(memberships), { replace: true });
        }
      })
      .catch(() => {
        // Une session illisible ne bloque pas le formulaire de connexion.
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authClient, onNavigate]);

  if (checkingSession) {
    return <StaffAuthLoading label="Vérification de votre session…" />;
  }

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !authClient) return;
    const validationError = validateCustomerLogin({ email, password });
    setMessage(null);
    setError(validationError);
    if (validationError) return;

    setBusy(true);
    const { data, error: signInError } = await authClient.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setPassword('');
    if (signInError || !data.session) {
      setBusy(false);
      setError(
        signInError
          ? mapStaffAuthError(signInError)
          : 'La connexion n’a pas ouvert de session. Réessayez.'
      );
      return;
    }

    try {
      const memberships = await listCurrentMemberships(data.session.user.id);
      onNavigate(resolveStaffPostAuthPath(memberships), { replace: true });
    } catch (membershipError) {
      setBusy(false);
      setError(
        membershipError instanceof Error
          ? membershipError.message
          : 'Session ouverte, mais vos accès d’agence sont illisibles. Réessayez.'
      );
    }
  };

  const submitResetRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !authClient) return;
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
      setError(mapStaffAuthError(resetError));
      return;
    }
    setMessage(
      'Si un compte personnel correspond à cette adresse, un lien de réinitialisation vient d’être envoyé.'
    );
  };

  const switchView = () => {
    setAuthView((value) => (value === 'login' ? 'forgot' : 'login'));
    setError(null);
    setMessage(null);
    setPassword('');
  };

  return (
    <StaffAuthLayout>
      <StaffAuthHeader
        title={authView === 'login' ? 'Heureux de vous retrouver' : 'Mot de passe oublié'}
        description={
          authView === 'login'
            ? 'Connectez-vous à votre espace PressingPro CI. Les écrans métier ne s’ouvrent qu’avec un rôle actif dans une agence.'
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
        {!configured && (
          <StaffAuthAlert tone="error">
            Le service de connexion n’est pas configuré dans cet
            environnement. Le formulaire est désactivé : aucun compte ne
            peut être vérifié ici.
          </StaffAuthAlert>
        )}
        {error && <StaffAuthAlert tone="error">{error}</StaffAuthAlert>}
        {message && <StaffAuthAlert tone="success">{message}</StaffAuthAlert>}

        <StaffTextField
          id="staff-login-email"
          label="Adresse e-mail"
          icon={Mail}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={setEmail}
          disabled={busy || !configured}
          required
        />

        {authView === 'login' && (
          <StaffPasswordField
            id="staff-login-password"
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            disabled={busy || !configured}
          />
        )}

        {authView === 'login' && (
          <p className="text-right">
            <button
              type="button"
              className="text-[13px] font-bold text-[#C2410C] underline-offset-2 transition hover:underline focus:outline-none focus:ring-4 focus:ring-orange-600/20 disabled:cursor-not-allowed disabled:opacity-55 dark:text-orange-300"
              disabled={busy}
              onClick={switchView}
            >
              Mot de passe oublié ?
            </button>
          </p>
        )}

        <button
          type="submit"
          className={staffPrimaryButtonClassName}
          disabled={busy || !configured}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : authView === 'login' ? (
            <LogIn className="h-4 w-4" aria-hidden="true" />
          ) : (
            <KeyRound className="h-4 w-4" aria-hidden="true" />
          )}
          {authView === 'login' ? 'Se connecter' : 'Envoyer le lien'}
        </button>

        {authView === 'forgot' && (
          <button
            type="button"
            className={staffSecondaryButtonClassName}
            disabled={busy}
            onClick={switchView}
          >
            Retour à la connexion
          </button>
        )}
      </form>

      <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3.5 dark:border-orange-900/60 dark:bg-orange-950/30">
        <p className="flex gap-2 text-[13px] font-semibold text-[#24113D] dark:text-orange-100">
          <Store className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Vous n’avez pas encore de compte ?
        </p>
        <StaffAuthLink
          path={STAFF_REGISTER_PATH}
          onNavigate={onNavigate}
          className="mt-2 inline-flex text-[13px] font-black text-[#C2410C] underline-offset-2 hover:underline focus:outline-none focus:ring-4 focus:ring-orange-600/20 dark:text-orange-300"
        >
          Créer un compte propriétaire
        </StaffAuthLink>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#64748B] dark:text-orange-200/80">
          Employé(e) d’un pressing déjà inscrit : votre accès est activé par
          votre propriétaire ou votre responsable, pas par une inscription
          libre.
        </p>
      </div>
    </StaffAuthLayout>
  );
};
