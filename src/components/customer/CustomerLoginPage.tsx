import React, { useEffect, useState } from 'react';
import { ArrowLeft, LogIn, Mail, MailCheck, ShieldCheck } from 'lucide-react';
import {
  CUSTOMER_HOME_PATH,
  CUSTOMER_LOGIN_PATH,
  CUSTOMER_PASSWORD_PATH,
  CUSTOMER_REGISTER_PATH,
  isValidEmail,
  mapSupabaseAuthError,
  validateCustomerLogin,
} from '../../lib/customerAuth';
import { getSupabaseConfigStatus, supabase } from '../../lib/supabase';
import {
  AuthAlert,
  AuthButton,
  AuthLink,
  AuthPasswordField,
  AuthShell,
  AuthSpaceSwitch,
  AuthTabs,
  AuthTextField,
  AuthUnconfiguredNotice,
  authLinkClassName,
  type AuthNavigate,
} from '../auth/AuthShell';

interface CustomerLoginPageProps {
  onNavigate: AuthNavigate;
}

type AuthView = 'login' | 'forgot';

const UNCONFIGURED_ERROR =
  'Aucune vérification n’a été effectuée : le service d’authentification n’est pas configuré dans cet environnement.';

const inlineActionClassName =
  'rounded text-[12px] font-bold text-[#1D4ED8] underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1D4ED8]/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300';

const VIEW_TITLES: Record<AuthView, string> = {
  login: 'Connexion — Espace client PressingPro CI',
  forgot: 'Mot de passe oublié — Espace client PressingPro CI',
};

export const CustomerLoginPage: React.FC<CustomerLoginPageProps> = ({ onNavigate }) => {
  const config = getSupabaseConfigStatus();
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = VIEW_TITLES[view];
  }, [view]);

  const resetFeedback = () => {
    setError(null);
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

    const validationError = validateCustomerLogin({ email, password });
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!supabase) {
      setError(UNCONFIGURED_ERROR);
      return;
    }

    setBusy(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) {
        setError(mapSupabaseAuthError(signInError));
        return;
      }
      setPassword('');
      if (data.session) onNavigate(CUSTOMER_HOME_PATH, { replace: true });
    } catch (unexpectedError) {
      setError(mapSupabaseAuthError(unexpectedError));
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
    if (!supabase) {
      setError(UNCONFIGURED_ERROR);
      return;
    }

    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}${CUSTOMER_PASSWORD_PATH}` }
      );
      if (resetError) {
        setError(mapSupabaseAuthError(resetError));
        return;
      }
      setResetSentTo(email.trim().toLowerCase());
    } catch (unexpectedError) {
      setError(mapSupabaseAuthError(unexpectedError));
    } finally {
      setBusy(false);
    }
  };

  const tabs = (
    <AuthTabs
      items={[
        { label: 'Connexion', href: CUSTOMER_LOGIN_PATH, active: true },
        { label: 'Inscription', href: CUSTOMER_REGISTER_PATH, active: false },
      ]}
      onNavigate={onNavigate}
    />
  );

  const footer = (
    <div className="space-y-4">
      <p className="text-center text-[12.5px] leading-relaxed text-[#6B7280] dark:text-zinc-400">
        Pas encore de compte ?{' '}
        <AuthLink
          href={CUSTOMER_REGISTER_PATH}
          onNavigate={onNavigate}
          className={authLinkClassName}
        >
          Créer un compte client
        </AuthLink>
      </p>
      <AuthSpaceSwitch
        audience="customer"
        onNavigate={onNavigate}
        note="Le personnel du pressing utilise un compte distinct pour son espace de gestion."
      />
    </div>
  );

  if (view === 'forgot' && resetSentTo) {
    return (
      <AuthShell
        audience="customer"
        title="Vérifiez votre boîte de réception."
        subtitle="Par sécurité, le message n’indique jamais si un compte existe : suivez le lien reçu pour choisir un nouveau mot de passe."
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

  if (view === 'forgot') {
    return (
      <AuthShell
        audience="customer"
        title="Mot de passe oublié ?"
        subtitle="Saisissez l’adresse e-mail de votre compte client : un lien vous permettra de choisir un nouveau mot de passe."
        notice={!config.configured ? <AuthUnconfiguredNotice audience="customer" /> : undefined}
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
            Le lien reçu doit être ouvert sur cet appareil : il ouvre la page qui permet de
            choisir un nouveau mot de passe.
          </AuthAlert>
          <AuthTextField
            id="customer-reset-email"
            label="Adresse e-mail du compte"
            icon={Mail}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="vous@exemple.com"
            value={email}
            onChange={setEmail}
            disabled={busy}
            required
          />
          <AuthButton type="submit" busy={busy} icon={Mail}>
            Envoyer le lien de réinitialisation
          </AuthButton>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      audience="customer"
      title="Bon retour parmi nous."
      subtitle="Connectez-vous pour suivre vos commandes et retrouver l’historique de vos dépôts."
      tabs={tabs}
      notice={!config.configured ? <AuthUnconfiguredNotice audience="customer" /> : undefined}
      footer={footer}
    >
      <form onSubmit={(event) => void submitLogin(event)} className="space-y-4" noValidate>
        {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

        <AuthTextField
          id="customer-login-email"
          label="Adresse e-mail"
          icon={Mail}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="vous@exemple.com"
          value={email}
          onChange={setEmail}
          disabled={busy}
          required
          autoFocus
        />

        <AuthPasswordField
          id="customer-login-password"
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
          Vos commandes restent invisibles tant que le pressing n’a pas vérifié votre numéro et
          relié votre fiche.
        </p>
        <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-[#6B665D] dark:text-zinc-400">
          <MailCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Compte non confirmé ? Ouvrez l’e-mail de confirmation reçu à l’inscription.
        </p>
      </form>
    </AuthShell>
  );
};
