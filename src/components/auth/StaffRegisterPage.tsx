import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Mail,
  MailCheck,
  Phone,
  ShieldCheck,
  Store,
  User,
  UserPlus,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  PRIVACY_POLICY_PATH,
  STAFF_LOGIN_PATH,
  STAFF_ONBOARDING_PATH,
  TERMS_OF_USE_PATH,
  mapStaffAuthError,
  resolveStaffPostAuthPath,
  validateStaffRegistration,
} from '../../lib/staffAuth';
import { listCurrentMemberships } from '../../lib/supabaseOrders';
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

interface StaffRegisterPageProps {
  onNavigate: AuthNavigate;
}

const UNCONFIGURED_ERROR =
  'Aucun compte n’a été créé : le service d’authentification n’est pas configuré dans cet environnement.';

export const StaffRegisterPage: React.FC<StaffRegisterPageProps> = ({ onNavigate }) => {
  const authClient = supabase;
  const configured = isSupabaseConfigured && authClient !== null;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Créer un compte propriétaire — PressingPro CI';
  }, []);

  // Déjà connecté(e) : pas de second compte sur cet appareil sans déconnexion.
  useEffect(() => {
    if (!authClient) {
      setCheckingSession(false);
      return;
    }
    let cancelled = false;

    authClient.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled || !data.session) return;
        const memberships = await listCurrentMemberships(data.session.user.id).catch(() => []);
        if (!cancelled) {
          onNavigate(resolveStaffPostAuthPath(memberships), { replace: true });
        }
      })
      .catch(() => {
        // Une session illisible ne bloque pas le formulaire d'inscription.
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authClient, onNavigate]);

  const submitRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const validationError = validateStaffRegistration({
      fullName,
      email,
      password,
      confirmPassword,
      acceptTerms,
    });
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
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedPhone = phone.replace(/\s+/g, ' ').trim();
      const { data, error: signUpError } = await authClient.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim().replace(/\s+/g, ' '),
            ...(trimmedPhone ? { phone: trimmedPhone } : {}),
          },
          emailRedirectTo: `${window.location.origin}${STAFF_LOGIN_PATH}`,
        },
      });

      if (signUpError) {
        setError(mapStaffAuthError(signUpError));
        return;
      }

      setPassword('');
      setConfirmPassword('');

      // Session immédiate (confirmation e-mail non exigée) : direction
      // l'onboarding pour créer l'organisation et la première agence.
      if (data.session) {
        onNavigate(STAFF_ONBOARDING_PATH, { replace: true });
        return;
      }

      setAwaitingConfirmation(normalizedEmail);
    } catch (unexpectedError) {
      setError(mapStaffAuthError(unexpectedError));
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    if (!authClient || !awaitingConfirmation || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error: resendError } = await authClient.auth.resend({
        type: 'signup',
        email: awaitingConfirmation,
        options: {
          emailRedirectTo: `${window.location.origin}${STAFF_LOGIN_PATH}`,
        },
      });
      if (resendError) {
        setError(mapStaffAuthError(resendError));
        return;
      }
      setMessage('Un nouvel e-mail de confirmation vient d’être demandé.');
    } catch (unexpectedError) {
      setError(mapStaffAuthError(unexpectedError));
    } finally {
      setBusy(false);
    }
  };

  if (checkingSession) {
    return <AuthLoadingScreen label="Vérification de votre session…" />;
  }

  if (awaitingConfirmation) {
    return (
      <AuthShell
        audience="staff"
        title="Vérifiez votre adresse e-mail."
        subtitle="Votre compte propriétaire est créé. Le service demande une confirmation avant la première connexion."
        footer={<AuthSpaceSwitch audience="staff" onNavigate={onNavigate} />}
      >
        <div className="space-y-4">
          {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}
          {message ? <AuthAlert tone="success">{message}</AuthAlert> : null}
          <AuthAlert tone="info" title="Adresse à confirmer">
            Un message a été envoyé à{' '}
            <span className="font-bold">{awaitingConfirmation}</span>. Ouvrez le lien qu’il
            contient, puis connectez-vous : vous serez guidé(e) pour créer votre pressing.
          </AuthAlert>
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-[#6B7280] dark:text-zinc-400">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Pensez à vérifier vos courriers indésirables. Si un compte existe déjà avec cette
            adresse, connectez-vous simplement avec votre mot de passe habituel.
          </p>
          <AuthButton
            type="button"
            icon={Mail}
            busy={busy}
            onClick={() => void resendConfirmation()}
          >
            Renvoyer l’e-mail de confirmation
          </AuthButton>
          <AuthButton
            type="button"
            variant="secondary"
            icon={ArrowLeft}
            onClick={() => onNavigate(STAFF_LOGIN_PATH)}
          >
            Aller à la connexion
          </AuthButton>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      audience="staff"
      title="Créez votre espace professionnel."
      subtitle="Un compte propriétaire ouvre votre organisation et votre première agence. Les accès de votre équipe seront ensuite attribués par vos soins."
      notice={!configured ? <AuthUnconfiguredNotice audience="staff" /> : undefined}
      footer={
        <div className="space-y-4">
          <p className="text-center text-[12.5px] leading-relaxed text-[#6B7280] dark:text-zinc-400">
            Vous avez déjà un compte ?{' '}
            <AuthLink href={STAFF_LOGIN_PATH} onNavigate={onNavigate} className={authLinkClassName}>
              Se connecter
            </AuthLink>
          </p>
          <AuthSpaceSwitch audience="staff" onNavigate={onNavigate} />
        </div>
      }
    >
      <form onSubmit={(event) => void submitRegistration(event)} className="space-y-4" noValidate>
        {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

        <AuthTextField
          id="staff-register-name"
          label="Nom complet"
          icon={User}
          autoComplete="name"
          placeholder="Awa Traoré"
          value={fullName}
          onChange={setFullName}
          disabled={busy}
          required
        />

        <AuthTextField
          id="staff-register-email"
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
          hint="C’est l’adresse de connexion et de récupération du compte."
        />

        <AuthTextField
          id="staff-register-phone"
          label="Téléphone"
          icon={Phone}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="07 00 00 00 00"
          value={phone}
          onChange={setPhone}
          disabled={busy}
          optional
        />

        <AuthPasswordField
          id="staff-register-password"
          label="Mot de passe"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          disabled={busy}
          showStrength
          hint="Au moins 8 caractères. Ce compte administrera votre pressing : choisissez un mot de passe unique."
        />

        <AuthPasswordField
          id="staff-register-confirm-password"
          label="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          disabled={busy}
        />

        <label
          htmlFor="staff-register-terms"
          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#E4DFD6] bg-[#FAF8F4] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#4B5563] transition focus-within:ring-4 focus-within:ring-[#1D4ED8]/15 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300"
        >
          <input
            id="staff-register-terms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(event) => setAcceptTerms(event.target.checked)}
            disabled={busy}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-[#C9C2B6] accent-[#1D4ED8] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1D4ED8]/20 disabled:cursor-not-allowed disabled:opacity-55 dark:accent-blue-400"
          />
          <span>
            J’accepte les{' '}
            <AuthLink
              href={TERMS_OF_USE_PATH}
              onNavigate={onNavigate}
              newTab
              className={authLinkClassName}
            >
              conditions d’utilisation
            </AuthLink>{' '}
            et la{' '}
            <AuthLink
              href={PRIVACY_POLICY_PATH}
              onNavigate={onNavigate}
              newTab
              className={authLinkClassName}
            >
              politique de confidentialité
            </AuthLink>{' '}
            de PressingPro CI.
          </span>
        </label>

        <AuthButton type="submit" busy={busy} icon={UserPlus}>
          Créer mon compte
        </AuthButton>

        <p className="flex items-start gap-2 pt-1 text-[11.5px] leading-relaxed text-[#6B665D] dark:text-zinc-400">
          <Store className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          L’inscription ne donne accès à aucun pressing existant : elle prépare uniquement la
          création du vôtre. Les données d’une autre organisation restent invisibles.
        </p>
        <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-[#6B665D] dark:text-zinc-400">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Aucun rôle métier n’est attribué automatiquement : le rattachement à une agence est
          vérifié côté serveur.
        </p>
      </form>
    </AuthShell>
  );
};
