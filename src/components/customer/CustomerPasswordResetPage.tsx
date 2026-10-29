import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, KeyRound, LogIn } from 'lucide-react';
import {
  CUSTOMER_HOME_PATH,
  CUSTOMER_LOGIN_PATH,
  mapSupabaseAuthError,
  validateNewPassword,
} from '../../lib/customerAuth';
import { getSupabaseConfigStatus, supabase } from '../../lib/supabase';
import {
  AuthAlert,
  AuthButton,
  AuthPasswordField,
  AuthShell,
  AuthSpaceSwitch,
  AuthUnconfiguredNotice,
  type AuthNavigate,
} from '../auth/AuthShell';

interface CustomerPasswordResetPageProps {
  session: Session | null;
  onNavigate: AuthNavigate;
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

  useEffect(() => {
    document.title = 'Nouveau mot de passe — PressingPro CI';
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!supabase || !session) {
      setError(
        'Aucune vérification n’a été effectuée : le service d’authentification n’est pas disponible dans cet environnement.'
      );
      return;
    }

    const validationError = validateNewPassword(password, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(mapSupabaseAuthError(updateError));
        return;
      }
      setPassword('');
      setConfirmPassword('');
      setMessage(
        'Votre mot de passe a été modifié. Vous pouvez maintenant ouvrir votre espace client.'
      );
    } catch (unexpectedError) {
      setError(mapSupabaseAuthError(unexpectedError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      audience="customer"
      title={message ? 'Mot de passe mis à jour.' : 'Choisissez un nouveau mot de passe.'}
      subtitle={
        message
          ? 'Votre compte client utilise désormais ce nouveau mot de passe.'
          : 'Cette page s’ouvre depuis le lien reçu par e-mail. Le lien est temporaire et ne doit pas être partagé.'
      }
      notice={!config.configured ? <AuthUnconfiguredNotice audience="customer" /> : undefined}
      footer={<AuthSpaceSwitch audience="customer" onNavigate={onNavigate} />}
    >
      {!config.configured ? (
        <div className="space-y-4">
          <AuthAlert tone="warning">
            La page reste consultable, mais aucun changement de mot de passe ne peut être
            enregistré ici.
          </AuthAlert>
          <AuthButton
            type="button"
            variant="secondary"
            icon={ArrowLeft}
            onClick={() => onNavigate(CUSTOMER_LOGIN_PATH)}
          >
            Retour à la connexion
          </AuthButton>
        </div>
      ) : !session ? (
        <div className="space-y-4">
          <AuthAlert tone="error" title="Lien inutilisable">
            Aucune session de récupération n’est active. Le lien est peut-être expiré, déjà
            utilisé ou incomplet.
          </AuthAlert>
          <AuthButton
            type="button"
            icon={LogIn}
            onClick={() => onNavigate(CUSTOMER_LOGIN_PATH)}
          >
            Demander un nouveau lien
          </AuthButton>
        </div>
      ) : message ? (
        <div className="space-y-4">
          <AuthAlert tone="success" title="C’est enregistré">
            {message}
          </AuthAlert>
          <AuthButton
            type="button"
            icon={LogIn}
            onClick={() => onNavigate(CUSTOMER_HOME_PATH, { replace: true })}
          >
            Ouvrir mon espace client
          </AuthButton>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
          {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}
          <AuthPasswordField
            id="customer-new-password"
            label="Nouveau mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            disabled={busy}
            showStrength
            hint="Au moins 8 caractères."
            autoFocus
          />
          <AuthPasswordField
            id="customer-confirm-new-password"
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            disabled={busy}
          />
          <AuthButton type="submit" busy={busy} icon={KeyRound}>
            Enregistrer le nouveau mot de passe
          </AuthButton>
          <p className="text-center text-[11.5px] leading-relaxed text-[#6B665D] dark:text-zinc-400">
            Vous ne vous attendiez pas à cette page ?{' '}
            <button
              type="button"
              onClick={() => onNavigate(CUSTOMER_LOGIN_PATH)}
              className="rounded font-bold text-[#1D4ED8] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1D4ED8]/20 dark:text-blue-300"
            >
              Revenir à la connexion
            </button>
          </p>
        </form>
      )}
    </AuthShell>
  );
};
