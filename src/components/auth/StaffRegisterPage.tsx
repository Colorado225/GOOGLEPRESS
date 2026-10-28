import React, { useEffect, useState } from 'react';
import { Loader2, Mail, MailCheck, Phone, Store, User, UserPlus } from 'lucide-react';
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
  StaffAuthAlert,
  StaffAuthHeader,
  StaffAuthLink,
  StaffAuthLoading,
} from './StaffAuthCommon';
import {
  PasswordStrengthMeter,
  StaffAuthLayout,
  StaffPasswordField,
  StaffTextField,
  staffPrimaryButtonClassName,
} from './StaffAuthLayout';

interface StaffRegisterPageProps {
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
}

const legalLinkClassName =
  'font-bold text-[#C2410C] underline underline-offset-2 transition hover:text-[#9A3412] focus:outline-none focus:ring-4 focus:ring-orange-600/20 dark:text-orange-300 dark:hover:text-orange-200';

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
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Créer un compte propriétaire — PressingPro CI';
  }, []);

  // Déjà connecté(e) : pas de second compte sur cet appareil sans déconnexion.
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
        // Une session illisible ne bloque pas le formulaire d'inscription.
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

  if (awaitingConfirmation) {
    return (
      <StaffAuthLayout>
        <StaffAuthHeader
          title="Confirmez votre adresse e-mail"
          description="Votre compte propriétaire est créé, mais le service demande une confirmation avant la première connexion."
        />
        <div className="mt-6 space-y-4">
          <StaffAuthAlert tone="success">
            Un message de confirmation a été envoyé à {awaitingConfirmation}.
            Ouvrez le lien qu’il contient, puis connectez-vous : vous serez
            guidé(e) pour créer votre pressing.
          </StaffAuthAlert>
          <p className="flex gap-2 text-[13px] leading-relaxed text-[#64748B] dark:text-zinc-400">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Pensez à vérifier vos courriers indésirables. Si un compte existe
            déjà avec cette adresse, connectez-vous simplement avec votre
            mot de passe habituel.
          </p>
          <StaffAuthLink
            path={STAFF_LOGIN_PATH}
            onNavigate={onNavigate}
            className={staffPrimaryButtonClassName}
          >
            Aller à la connexion
          </StaffAuthLink>
        </div>
      </StaffAuthLayout>
    );
  }

  const submitRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !authClient) return;

    const validationError = validateStaffRegistration({
      fullName,
      email,
      password,
      confirmPassword,
      acceptTerms,
    });
    setError(validationError);
    if (validationError) return;

    setBusy(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error: signUpError } = await authClient.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim().replace(/\s+/g, ' '),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
        emailRedirectTo: `${window.location.origin}${STAFF_LOGIN_PATH}`,
      },
    });
    setBusy(false);
    setPassword('');
    setConfirmPassword('');

    if (signUpError) {
      setError(mapStaffAuthError(signUpError));
      return;
    }

    // Session immédiate (confirmation e-mail non exigée) : direction
    // l'onboarding pour créer l'organisation et la première agence.
    if (data.session) {
      onNavigate(STAFF_ONBOARDING_PATH, { replace: true });
      return;
    }

    setAwaitingConfirmation(normalizedEmail);
  };

  return (
    <StaffAuthLayout>
      <StaffAuthHeader
        title="Créez votre espace professionnel"
        description="Simplifiez la gestion de votre pressing avec PressingPro CI. À l’étape suivante, vous créerez votre organisation et votre première agence ; vos employés recevront leurs accès par vos soins."
      />

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => void submitRegistration(event)}
        noValidate
      >
        {!configured && (
          <StaffAuthAlert tone="error">
            Le service d’inscription n’est pas configuré dans cet
            environnement. Le formulaire est désactivé : aucun compte ne
            peut être créé ici.
          </StaffAuthAlert>
        )}
        {error && <StaffAuthAlert tone="error">{error}</StaffAuthAlert>}

        <StaffTextField
          id="staff-register-name"
          label="Nom complet"
          icon={User}
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={setFullName}
          disabled={busy || !configured}
          required
        />

        <StaffTextField
          id="staff-register-email"
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

        <StaffTextField
          id="staff-register-phone"
          label="Téléphone (optionnel)"
          icon={Phone}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="07 00 00 00 00"
          value={phone}
          onChange={setPhone}
          disabled={busy || !configured}
        />

        <StaffPasswordField
          id="staff-register-password"
          label="Mot de passe"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          disabled={busy || !configured}
          describedBy="staff-register-password-hint"
        />
        <PasswordStrengthMeter password={password} />
        <p
          id="staff-register-password-hint"
          className="-mt-2 text-[12px] text-[#64748B] dark:text-zinc-400"
        >
          Au moins 8 caractères. C’est le compte qui administrera votre
          pressing : choisissez un mot de passe unique.
        </p>

        <StaffPasswordField
          id="staff-register-confirm-password"
          label="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          disabled={busy || !configured}
        />

        <div className="flex items-start gap-3">
          <input
            id="staff-register-terms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(event) => setAcceptTerms(event.target.checked)}
            disabled={busy || !configured}
            className="mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer accent-[#C2410C] focus:outline-none focus:ring-4 focus:ring-orange-600/20 disabled:cursor-not-allowed disabled:opacity-55"
          />
          <label
            htmlFor="staff-register-terms"
            className="text-[13px] leading-relaxed text-[#64748B] dark:text-zinc-400"
          >
            J’accepte les{' '}
            <a
              href={TERMS_OF_USE_PATH}
              target="_blank"
              rel="noreferrer"
              className={legalLinkClassName}
            >
              conditions d’utilisation
            </a>{' '}
            et la{' '}
            <a
              href={PRIVACY_POLICY_PATH}
              target="_blank"
              rel="noreferrer"
              className={legalLinkClassName}
            >
              politique de confidentialité
            </a>{' '}
            de PressingPro CI.
          </label>
        </div>

        <button
          type="submit"
          className={staffPrimaryButtonClassName}
          disabled={busy || !configured}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <span className="inline-flex items-center gap-2">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Créer mon compte
            </span>
          )}
        </button>

        <p className="text-center text-[13px] text-[#64748B] dark:text-zinc-400">
          Vous avez déjà un compte ?{' '}
          <StaffAuthLink
            path={STAFF_LOGIN_PATH}
            onNavigate={onNavigate}
            className="font-black text-[#C2410C] underline-offset-2 hover:underline focus:outline-none focus:ring-4 focus:ring-orange-600/20 dark:text-orange-300"
          >
            Se connecter
          </StaffAuthLink>
        </p>
      </form>

      <p className="mt-5 flex gap-2 text-[12.5px] leading-relaxed text-[#64748B] dark:text-zinc-400">
        <Store className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        L’inscription seule ne donne accès à aucun pressing existant :
        elle prépare uniquement la création du vôtre. Les données d’une
        autre organisation restent invisibles, protégées côté serveur.
      </p>
    </StaffAuthLayout>
  );
};
