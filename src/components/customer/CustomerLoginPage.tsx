import React, { useState } from 'react';
import { ArrowLeft, Loader2, LogIn, MailQuestion } from 'lucide-react';
import {
  CUSTOMER_HOME_PATH,
  CUSTOMER_PASSWORD_PATH,
  CUSTOMER_REGISTER_PATH,
  isValidEmail,
  mapSupabaseAuthError,
  validateCustomerLogin,
} from '../../lib/customerAuth';
import { getSupabaseConfigStatus, supabase } from '../../lib/supabase';
import {
  CustomerAuthLayout,
  CustomerFormAlerts,
  CustomerNavLink,
  PasswordField,
  customerInputClassName,
  customerPrimaryButtonClassName,
  customerSecondaryButtonClassName,
  type CustomerNavigate,
} from './CustomerAuthLayout';

interface CustomerLoginPageProps {
  onNavigate: CustomerNavigate;
}

export const CustomerLoginPage: React.FC<CustomerLoginPageProps> = ({ onNavigate }) => {
  const config = getSupabaseConfigStatus();
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy) return;

    const validationError = validateCustomerLogin({ email, password });
    if (validationError) {
      setError(validationError);
      setMessage(null);
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setBusy(false);
    setPassword('');

    if (signInError) {
      setError(mapSupabaseAuthError(signInError));
      return;
    }

    if (data.session) onNavigate(CUSTOMER_HOME_PATH, { replace: true });
  };

  const submitReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy) return;

    if (!isValidEmail(email)) {
      setError('Saisissez l’adresse e-mail de votre compte.');
      setMessage(null);
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}${CUSTOMER_PASSWORD_PATH}` }
    );
    setBusy(false);

    if (resetError) {
      setError(mapSupabaseAuthError(resetError));
      return;
    }

    setMessage(
      'Si un compte existe avec cette adresse, un e-mail de réinitialisation vient d’être demandé. Vérifiez votre boîte de réception et vos courriers indésirables.'
    );
  };

  return (
    <CustomerAuthLayout
      title={mode === 'login' ? 'Connexion' : 'Mot de passe oublié'}
      subtitle={
        mode === 'login'
          ? 'Connectez-vous pour consulter les commandes liées à votre numéro de téléphone vérifié.'
          : 'Saisissez l’e-mail de votre compte : Supabase vous enverra un lien pour choisir un nouveau mot de passe.'
      }
      active="login"
      onNavigate={onNavigate}
    >
      {!config.configured && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          Le service de connexion n’est pas configuré dans cet environnement.
          Les formulaires sont visibles, mais aucune demande ne sera envoyée.
        </p>
      )}

      {mode === 'login' ? (
        <form onSubmit={(event) => void submitLogin(event)} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="customer-login-email"
              className="mb-1.5 block text-[12px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
            >
              Adresse e-mail
            </label>
            <input
              id="customer-login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="vous@exemple.com"
              disabled={!config.configured || busy}
              className={customerInputClassName}
            />
          </div>

          <PasswordField
            id="customer-login-password"
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            disabled={!config.configured || busy}
          />

          <CustomerFormAlerts error={error} message={message} />

          <button
            type="submit"
            disabled={!config.configured || busy || !email.trim() || !password}
            className={customerPrimaryButtonClassName}
          >
            {busy ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="h-4.5 w-4.5" aria-hidden="true" />
            )}
            Se connecter
          </button>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[13px]">
            <button
              type="button"
              onClick={() => {
                setMode('reset');
                setError(null);
                setMessage(null);
                setPassword('');
              }}
              className="font-bold text-blue-700 underline-offset-4 hover:underline focus:outline-none focus:ring-4 focus:ring-blue-600/20 dark:text-blue-300"
            >
              Mot de passe oublié ?
            </button>
            <CustomerNavLink
              href={CUSTOMER_REGISTER_PATH}
              onNavigate={onNavigate}
              className="font-bold text-zinc-900 underline-offset-4 hover:text-blue-700 hover:underline focus:outline-none focus:ring-4 focus:ring-blue-600/20 dark:text-zinc-100 dark:hover:text-blue-300"
            >
              Créer un compte client
            </CustomerNavLink>
          </div>
        </form>
      ) : (
        <form onSubmit={(event) => void submitReset(event)} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="customer-reset-email"
              className="mb-1.5 block text-[12px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
            >
              Adresse e-mail du compte
            </label>
            <input
              id="customer-reset-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="vous@exemple.com"
              disabled={!config.configured || busy}
              className={customerInputClassName}
            />
          </div>

          <CustomerFormAlerts error={error} message={message} />

          <button
            type="submit"
            disabled={!config.configured || busy || !email.trim()}
            className={customerPrimaryButtonClassName}
          >
            {busy ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden="true" />
            ) : (
              <MailQuestion className="h-4.5 w-4.5" aria-hidden="true" />
            )}
            Envoyer le lien de réinitialisation
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setMessage(null);
            }}
            className={`${customerSecondaryButtonClassName} w-full`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Retour à la connexion
          </button>
        </form>
      )}
    </CustomerAuthLayout>
  );
};
