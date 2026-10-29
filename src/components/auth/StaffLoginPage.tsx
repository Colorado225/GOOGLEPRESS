import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, KeyRound, LogIn, Mail, MailCheck, ShieldCheck } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  STAFF_LOGIN_PATH,
  STAFF_REGISTER_PATH,
  mapStaffAuthError,
  resolveStaffPostAuthPath,
  validateStaffLogin,
} from '../../lib/staffAuth';
import { listCurrentMemberships } from '../../lib/supabaseOrders';
import { resolveStaffReturnPath } from '../../lib/routes';
import { isValidEmail } from '../../lib/customerAuth';
import {
  AuthAlert,
  AuthButton,
  AuthLink,
  AuthLoadingScreen,
  AuthPasswordField,
  AuthShell,
  AuthSpaceSwitch,
  AuthTextField,
  AuthUnconfiguredNotice,
  authLinkClassName,
  type AuthNavigate,
} from './AuthShell';

interface StaffLoginPageProps {
  onNavigate: AuthNavigate;
}

type AuthView = 'login' | 'forgot' | 'recovery';

const UNCONFIGURED_ERROR =
  'Aucune vérification n’a été effectuée : le service d’authentification n’est pas configuré dans cet environnement.';

/** Lien de type bouton (changement de vue sans quitter le formulaire). */
const inlineActionClassName =
  'rounded text-[12px] font-bold text-[#1D4ED8] underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1D4ED8]/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300';

/**
 * Destination après connexion : l'ERP si le compte possède un rôle actif,
 * sinon l'onboarding. Le paramètre `retour` (liste blanche des écrans ERP)
 * n'est utilisé que lorsque la destination par défaut est l'ERP.
 */
const resolveLoginDestination = (
  memberships: Parameters<typeof resolveStaffPostAuthPath>[0]
): string => {
  const fallback = resolveStaffPostAuthPath(memberships);
  if (fallback !== '/') return fallback;
  return resolveStaffReturnPath(window.location.search) ?? '/';
};

/** Détecte l'ouverture de la page par un lien de récupération Supabase. */
const openFromRecoveryLink = (): boolean =>
  /(?:^|[#&?])type=recovery(?:&|$)/.test(window.location.hash) ||
  /(?:^|[?&])type=recovery(?:&|$)/.test(window.location.search);

const VIEW_TITLES: Record<AuthView, string> = {
  login: 'Connexion — PressingPro CI',
  forgot: 'Mot de passe oublié — PressingPro CI',
  recovery: 'Nouveau mot de passe — PressingPro CI',
};

export const StaffLoginPage: React.FC<StaffLoginPageProps> = ({ onNavigate }) => {
  const authClient = supabase;
  const configured = isSupabaseConfigured && authClient !== null;

  const [view, setView] = useState<AuthView>(() =>
    openFromRecoveryLink() ? 'recovery' : 'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [recoveryDone, setRecoveryDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const recoveryFlowRef = useRef(view === 'recovery');

  useEffect(() => {
    document.title = VIEW_TITLES[view];
  }, [view]);

  // Session déjà ouverte : on ne redemande pas les identifiants. Un lien de
  // récupération, lui, garde la page ouverte pour choisir un mot de passe.
  useEffect(() => {
    if (!authClient) {
      setCheckingSession(false);
      return;
    }
    let cancelled = false;

    const { data } = authClient.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryFlowRef.current = true;
        setView('recovery');
        setCheckingSession(false);
      }
    });

    authClient.auth
      .getSession()
      .then(async ({ data: sessionData }) => {
        if (cancelled || !sessionData.session || recoveryFlowRef.current) return;
        const memberships = await listCurrentMemberships(sessionData.session.user.id).catch(
          () => []
        );
        if (!cancelled) {
          onNavigate(resolveLoginDestination(memberships), { replace: true });
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
      data.subscription.unsubscribe();
    };
  }, [authClient, onNavigate]);

  const resetFeedback = () => {
    setError(null);
    setMessage(null);
  };

  const switchTo = (next: AuthView) => {
    resetFeedback();
    setResetSentTo(null);
    setBusy(false);
    setView(next);
  };

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    const validationError = validateStaffLogin({ email, password });
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!authClient) {
      setError(UNCONFIGURED_ERROR);
      return;
    }

    setBusy(true);
    try {
      const { data, error: signInError } = await authClient.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) {
        setError(mapStaffAuthError(signInError));
        return;
      }
      setPassword('');
      if (!data.session) {
        setError('La connexion n’a pas pu être confirmée. Réessayez dans un instant.');
        return;
      }
      setMessage('Connexion réussie. Ouverture de votre espace…');
      const memberships = await listCurrentMemberships(data.session.user.id).catch(() => []);
      onNavigate(resolveLoginDestination(memberships), { replace: true });
    } catch (unexpectedError) {
      setError(mapStaffAuthError(unexpectedError));
    } finally {
      setBusy(false);
    }
  };

  const sendResetLink = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    resetFeedback();
    if (!isValidEmail(email)) {
      setError('Saisissez l’adresse e-mail de votre compte.');
      return;
    }
    if (!authClient) {
      setError(UNCONFIGURED_ERROR);
      return;
    }

    setBusy(true);
    try {
      const { error: resetError } = await authClient.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}${STAFF_LOGIN_PATH}` }
      );
      if (resetError) {
        setError(mapStaffAuthError(resetError));
        return;
      }
      setResetSentTo(email.trim().toLowerCase());
    } catch (unexpectedError) {
      setError(mapStaffAuthError(unexpectedError));
    } finally {
      setBusy(false);
    }
  };

  const submitNewPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword.length > 72) {
      setError('Le nouveau mot de passe ne peut pas dépasser 72 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (!authClient) {
      setError(UNCONFIGURED_ERROR);
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await authClient.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(mapStaffAuthError(updateError));
        return;
      }
      setNewPassword('');
      setConfirmPassword('');
      setRecoveryDone(true);
    } catch (unexpectedError) {
      setError(mapStaffAuthError(unexpectedError));
    } finally {
      setBusy(false);
    }
  };

  const closeRecoverySession = async () => {
    if (!authClient || busy) return;
    setBusy(true);
    await authClient.auth.signOut().catch(() => undefined);
    setBusy(false);
    switchTo('login');
  };

  if (checkingSession) {
    return <AuthLoadingScreen label="Vérification de votre session…" />;
  }

  /* ——— Connexion ——— */
  if (view === 'login') {
    return (
      <AuthShell
        audience="staff"
        title="Heureux de vous retrouver."
        subtitle="Connectez-vous à votre espace de gestion. Vos écrans dépendent du rôle que votre pressing vous a attribué."
        notice={!configured ? <AuthUnconfiguredNotice audience="staff" /> : undefined}
        footer={
          <div className="space-y-4">
            <p className="text-center text-[12.5px] leading-relaxed text-[#6B7280] dark:text-zinc-400">
              Nouveau sur PressingPro CI ?{' '}
              <AuthLink
                href={STAFF_REGISTER_PATH}
                onNavigate={onNavigate}
                className={authLinkClassName}
              >
                Créer un compte propriétaire
              </AuthLink>
            </p>
            <AuthSpaceSwitch
              audience="staff"
              onNavigate={onNavigate}
              note="Employé(e) d’un pressing déjà inscrit : votre accès est activé par votre propriétaire ou votre responsable."
            />
          </div>
        }
      >
        <form onSubmit={(event) => void submitLogin(event)} className="space-y-4" noValidate>
          {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}
          {message ? <AuthAlert tone="success">{message}</AuthAlert> : null}

          <AuthTextField
            id="staff-login-email"
            label="Adresse e-mail"
            icon={Mail}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="vous@pressing.ci"
            value={email}
            onChange={setEmail}
            disabled={busy}
            required
          />

          <AuthPasswordField
            id="staff-login-password"
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            disabled={busy}
            trailing={
              <button
                type="button"
                onClick={() => switchTo('forgot')}
                disabled={busy}
                className={inlineActionClassName}
              >
                Mot de passe oublié ?
              </button>
            }
          />

          <AuthButton type="submit" busy={busy} icon={LogIn}>
            Se connecter
          </AuthButton>

          <p className="flex items-start gap-2 pt-1 text-[11.5px] leading-relaxed text-[#6B665D] dark:text-zinc-400">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Un compte client ne donne jamais accès aux écrans du personnel : les
            autorisations sont vérifiées côté serveur à chaque requête.
          </p>
        </form>
      </AuthShell>
    );
  }

  /* ——— Mot de passe oublié : demande envoyée ——— */
  if (view === 'forgot' && resetSentTo) {
    return (
      <AuthShell
        audience="staff"
        title="Vérifiez votre boîte de réception."
        subtitle="Par sécurité, le message n’indique jamais si un compte existe : suivez simplement le lien reçu pour choisir un nouveau mot de passe."
        footer={
          <div className="space-y-3">
            <AuthButton
              type="button"
              variant="secondary"
              icon={ArrowLeft}
              onClick={() => switchTo('login')}
            >
              Retour à la connexion
            </AuthButton>
            <AuthSpaceSwitch audience="staff" onNavigate={onNavigate} />
          </div>
        }
      >
        <div className="space-y-4">
          {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}
          <AuthAlert tone="info" title="Lien de réinitialisation">
            Si un compte existe pour <span className="font-bold">{resetSentTo}</span>, un e-mail
            vient d’être demandé. Le lien est temporaire : vérifiez aussi vos courriers
            indésirables.
          </AuthAlert>
          <AuthButton
            type="button"
            variant="secondary"
            icon={Mail}
            busy={busy}
            onClick={() => void sendResetLink()}
          >
            Renvoyer le lien
          </AuthButton>
          <button
            type="button"
            onClick={() => {
              resetFeedback();
              setResetSentTo(null);
            }}
            className="mx-auto block rounded text-[12px] font-bold text-[#5C6472] underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-[#111827]/10 dark:text-zinc-400"
          >
            Utiliser une autre adresse
          </button>
        </div>
      </AuthShell>
    );
  }

  /* ——— Mot de passe oublié : saisie de l'adresse ——— */
  if (view === 'forgot') {
    return (
      <AuthShell
        audience="staff"
        title="Mot de passe oublié ?"
        subtitle="Saisissez l’adresse e-mail de votre compte personnel : un lien vous permettra de choisir un nouveau mot de passe."
        notice={!configured ? <AuthUnconfiguredNotice audience="staff" /> : undefined}
        footer={
          <AuthButton
            type="button"
            variant="secondary"
            icon={ArrowLeft}
            onClick={() => switchTo('login')}
          >
            Retour à la connexion
          </AuthButton>
        }
      >
        <form onSubmit={(event) => void sendResetLink(event)} className="space-y-4" noValidate>
          {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}
          <AuthAlert tone="info">
            Par précaution, la réponse est identique que l’adresse corresponde ou non à un
            compte existant.
          </AuthAlert>
          <AuthTextField
            id="staff-reset-email"
            label="Adresse e-mail du compte"
            icon={Mail}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="vous@pressing.ci"
            value={email}
            onChange={setEmail}
            disabled={busy}
            required
            autoFocus
          />
          <AuthButton type="submit" busy={busy} icon={Mail}>
            Envoyer le lien de réinitialisation
          </AuthButton>
        </form>
      </AuthShell>
    );
  }

  /* ——— Nouveau mot de passe (lien de récupération) ——— */
  if (recoveryDone) {
    return (
      <AuthShell
        audience="staff"
        title="Mot de passe mis à jour."
        subtitle="Votre compte personnel utilise désormais ce nouveau mot de passe. La session ouverte par le lien de récupération reste active."
        footer={<AuthSpaceSwitch audience="staff" onNavigate={onNavigate} />}
      >
        <div className="space-y-4">
          <AuthAlert tone="success" title="C’est enregistré">
            Conservez ce mot de passe en lieu sûr : il n’est jamais affiché en clair dans
            l’application.
          </AuthAlert>
          <AuthButton
            type="button"
            icon={LogIn}
            onClick={() => onNavigate('/', { replace: true })}
          >
            Ouvrir mon espace
          </AuthButton>
          <AuthButton
            type="button"
            variant="secondary"
            busy={busy}
            onClick={() => void closeRecoverySession()}
          >
            Fermer cette session et revenir à la connexion
          </AuthButton>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      audience="staff"
      title="Choisissez un nouveau mot de passe."
      subtitle="Le lien de récupération est actif. Définissez un mot de passe unique pour votre compte personnel."
      notice={!configured ? <AuthUnconfiguredNotice audience="staff" /> : undefined}
      footer={
        <div className="space-y-3 text-center">
          <p className="text-[11.5px] leading-relaxed text-[#6B665D] dark:text-zinc-400">
            Lien expiré ou déjà utilisé ?{' '}
            <button
              type="button"
              onClick={() => switchTo('forgot')}
              className={inlineActionClassName}
            >
              Demander un nouveau lien
            </button>
          </p>
          <AuthSpaceSwitch audience="staff" onNavigate={onNavigate} />
        </div>
      }
    >
      <form onSubmit={(event) => void submitNewPassword(event)} className="space-y-4" noValidate>
        {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}
        <AuthPasswordField
          id="staff-recovery-password"
          label="Nouveau mot de passe"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          disabled={busy}
          showStrength
          hint="Au moins 8 caractères. Évitez un mot de passe déjà utilisé ailleurs."
          autoFocus
        />
        <AuthPasswordField
          id="staff-recovery-confirm-password"
          label="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          disabled={busy}
        />
        <AuthButton type="submit" busy={busy} icon={KeyRound}>
          Enregistrer le mot de passe
        </AuthButton>
      </form>
    </AuthShell>
  );
};
