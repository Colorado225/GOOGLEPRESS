import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Mail,
  MailCheck,
  MapPin,
  Phone,
  User,
  UserRoundPlus,
} from 'lucide-react';
import {
  CUSTOMER_HOME_PATH,
  CUSTOMER_LOGIN_PATH,
  CUSTOMER_REGISTER_PATH,
  mapSupabaseAuthError,
  normalizePhoneToE164,
  validateCustomerRegistration,
} from '../../lib/customerAuth';
import {
  PRIVACY_POLICY_PATH,
  TERMS_OF_USE_PATH,
} from '../../lib/staffAuth';
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

interface CustomerRegisterPageProps {
  onNavigate: AuthNavigate;
}

const UNCONFIGURED_ERROR =
  'Aucun compte n’a été créé : le service d’authentification n’est pas configuré dans cet environnement.';

export const CustomerRegisterPage: React.FC<CustomerRegisterPageProps> = ({ onNavigate }) => {
  const config = getSupabaseConfigStatus();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmsDepositPhone, setConfirmsDepositPhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Inscription — Espace client PressingPro CI';
  }, []);

  const submitRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const validationError = validateCustomerRegistration({
      fullName,
      phone,
      email,
      password,
      confirmPassword,
      confirmsDepositPhone,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    const phoneE164 = normalizePhoneToE164(phone);
    if (!phoneE164) {
      setError('Saisissez un numéro de téléphone valide.');
      return;
    }
    if (!supabase) {
      setError(UNCONFIGURED_ERROR);
      return;
    }

    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${CUSTOMER_LOGIN_PATH}`,
          data: {
            full_name: fullName.trim().replace(/\s+/g, ' '),
            phone_e164: phoneE164,
            account_type: 'customer',
          },
        },
      });

      if (signUpError) {
        setError(mapSupabaseAuthError(signUpError));
        return;
      }

      setPassword('');
      setConfirmPassword('');

      if (data.session) {
        onNavigate(CUSTOMER_HOME_PATH, { replace: true });
        return;
      }

      setAwaitingConfirmation(normalizedEmail);
    } catch (unexpectedError) {
      setError(mapSupabaseAuthError(unexpectedError));
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    if (!supabase || !awaitingConfirmation || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: awaitingConfirmation,
        options: { emailRedirectTo: `${window.location.origin}${CUSTOMER_LOGIN_PATH}` },
      });
      if (resendError) {
        setError(mapSupabaseAuthError(resendError));
        return;
      }
      setMessage('Un nouvel e-mail de confirmation vient d’être demandé.');
    } catch (unexpectedError) {
      setError(mapSupabaseAuthError(unexpectedError));
    } finally {
      setBusy(false);
    }
  };

  if (awaitingConfirmation) {
    return (
      <AuthShell
        audience="customer"
        title="Vérifiez votre adresse e-mail."
        subtitle="Votre compte client est enregistré. Ouvrez l’e-mail de confirmation pour l’activer, puis connectez-vous."
        footer={<AuthSpaceSwitch audience="customer" onNavigate={onNavigate} />}
      >
        <div className="space-y-4">
          {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}
          {message ? <AuthAlert tone="success">{message}</AuthAlert> : null}
          <AuthAlert tone="info" title="Adresse à confirmer">
            Un message a été envoyé à{' '}
            <span className="font-bold">{awaitingConfirmation}</span>. Le lien active votre
            compte et vous ramène à la connexion.
          </AuthAlert>
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-[#6B7280] dark:text-zinc-400">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Votre pressing devra ensuite vérifier votre numéro avant de relier vos commandes :
            l’inscription seule n’ouvre aucun historique.
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
            onClick={() => onNavigate(CUSTOMER_LOGIN_PATH)}
          >
            Aller à la connexion
          </AuthButton>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      audience="customer"
      title="Créez votre compte client."
      subtitle="Utilisez le numéro de téléphone communiqué au pressing lors de vos dépôts : c’est lui qui permettra de relier vos commandes."
      tabs={
        <AuthTabs
          items={[
            { label: 'Connexion', href: CUSTOMER_LOGIN_PATH, active: false },
            { label: 'Inscription', href: CUSTOMER_REGISTER_PATH, active: true },
          ]}
          onNavigate={onNavigate}
        />
      }
      notice={!config.configured ? <AuthUnconfiguredNotice audience="customer" /> : undefined}
      footer={
        <div className="space-y-4">
          <p className="text-center text-[12.5px] leading-relaxed text-[#6B7280] dark:text-zinc-400">
            Vous avez déjà un compte ?{' '}
            <AuthLink
              href={CUSTOMER_LOGIN_PATH}
              onNavigate={onNavigate}
              className={authLinkClassName}
            >
              Se connecter
            </AuthLink>
          </p>
          <AuthSpaceSwitch audience="customer" onNavigate={onNavigate} />
        </div>
      }
    >
      <form onSubmit={(event) => void submitRegistration(event)} className="space-y-4" noValidate>
        {error ? <AuthAlert tone="error">{error}</AuthAlert> : null}

        <AuthTextField
          id="customer-register-name"
          label="Nom complet"
          icon={User}
          autoComplete="name"
          placeholder="Awa Koné"
          value={fullName}
          onChange={setFullName}
          disabled={busy}
          required
        />

        <AuthTextField
          id="customer-register-phone"
          label="Téléphone utilisé pour vos dépôts"
          icon={Phone}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="07 00 00 00 00"
          value={phone}
          onChange={setPhone}
          disabled={busy}
          required
          hint="Format ivoirien à 10 chiffres ou international (ex. +225 07 00 00 00 00)."
        />

        <AuthTextField
          id="customer-register-email"
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
          hint="Sert à confirmer le compte et à le récupérer en cas d’oubli."
        />

        <AuthPasswordField
          id="customer-register-password"
          label="Mot de passe"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          disabled={busy}
          showStrength
          hint="Au moins 8 caractères. N’utilisez pas le même mot de passe que vos autres comptes importants."
        />

        <AuthPasswordField
          id="customer-register-confirm-password"
          label="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          disabled={busy}
        />

        <label
          htmlFor="customer-register-deposit-phone"
          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#E4DFD6] bg-[#FAF8F4] px-3.5 py-3 text-[12.5px] leading-relaxed text-[#4B5563] transition focus-within:ring-4 focus-within:ring-[#1D4ED8]/15 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300"
        >
          <input
            id="customer-register-deposit-phone"
            type="checkbox"
            checked={confirmsDepositPhone}
            onChange={(event) => setConfirmsDepositPhone(event.target.checked)}
            disabled={busy}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-[#C9C2B6] accent-[#1D4ED8] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1D4ED8]/20 disabled:cursor-not-allowed disabled:opacity-55 dark:accent-blue-400"
          />
          <span>
            Je confirme que ce numéro est celui utilisé pour mes dépôts et j’accepte que le
            pressing le vérifie avant de relier mes commandes.
          </span>
        </label>

        <AuthButton type="submit" busy={busy} icon={UserRoundPlus}>
          Créer mon compte client
        </AuthButton>

        <p className="pt-1 text-center text-[11.5px] leading-relaxed text-[#6B665D] dark:text-zinc-400">
          En créant un compte, vous acceptez les{' '}
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
          </AuthLink>{'.'}
        </p>
        <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-[#6B665D] dark:text-zinc-400">
          <MailCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Le téléphone est une coordonnée déclarée, pas une preuve : seule la vérification par le
          pressing ouvre l’accès aux commandes.
        </p>
      </form>
    </AuthShell>
  );
};
