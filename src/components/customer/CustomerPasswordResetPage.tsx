import React, { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import {
  CUSTOMER_HOME_PATH,
  CUSTOMER_LOGIN_PATH,
  mapSupabaseAuthError,
  validateNewPassword,
} from '../../lib/customerAuth';
import { getSupabaseConfigStatus, supabase } from '../../lib/supabase';
import {
  CustomerAuthLayout,
  CustomerFormAlerts,
  CustomerNavLink,
  PasswordField,
  customerPrimaryButtonClassName,
  customerSecondaryButtonClassName,
  type CustomerNavigate,
} from './CustomerAuthLayout';

interface CustomerPasswordResetPageProps {
  session: Session | null;
  onNavigate: CustomerNavigate;
}

export const CustomerPasswordResetPage: React.FC<CustomerPasswordResetPageProps> = ({
  session,
  onNavigate,
}) => {
  const config = getSupabaseConfigStatus();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !session || busy) return;

    const validationError = validateNewPassword(password, confirmPassword);
    if (validationError) {
      setError(validationError);
      setMessage(null);
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    setPassword('');
    setConfirmPassword('');

    if (updateError) {
      setError(mapSupabaseAuthError(updateError));
      return;
    }

    setMessage('Votre mot de passe a été modifié. Vous pouvez maintenant ouvrir votre espace client.');
  };

  return (
    <CustomerAuthLayout
      title="Choisir un nouveau mot de passe"
      subtitle="Cette page doit être ouverte depuis le lien reçu par e-mail. Le lien est temporaire et ne doit pas être partagé."
      active="password"
      onNavigate={onNavigate}
    >
      {!config.configured ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          Le service d’authentification n’est pas configuré dans cet environnement.
        </p>
      ) : !session ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-relaxed text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
            Aucune session de récupération n’est active. Ce lien est peut-être
            expiré, déjà utilisé ou incomplet.
          </p>
          <CustomerNavLink
            href={CUSTOMER_LOGIN_PATH}
            onNavigate={onNavigate}
            className={`${customerSecondaryButtonClassName} w-full`}
          >
            Demander un nouveau lien depuis la connexion
          </CustomerNavLink>
        </div>
      ) : message ? (
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[13px] leading-relaxed text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            {message}
          </p>
          <CustomerNavLink
            href={CUSTOMER_HOME_PATH}
            onNavigate={onNavigate}
            className={customerPrimaryButtonClassName}
          >
            Ouvrir mon espace client
          </CustomerNavLink>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
          <PasswordField
            id="customer-new-password"
            label="Nouveau mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            disabled={busy}
          />
          <PasswordField
            id="customer-confirm-new-password"
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            disabled={busy}
          />
          <CustomerFormAlerts error={error} />
          <button type="submit" disabled={busy} className={customerPrimaryButtonClassName}>
            {busy ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="h-4.5 w-4.5" aria-hidden="true" />
            )}
            Enregistrer le nouveau mot de passe
          </button>
        </form>
      )}
    </CustomerAuthLayout>
  );
};
