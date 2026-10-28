import React, { useEffect, useState } from 'react';
import { Loader2, MailCheck, Store, UserPlus } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  STAFF_LOGIN_PATH,
  STAFF_ONBOARDING_PATH,
  mapStaffAuthError,
  resolveStaffPostAuthPath,
  validateStaffRegistration,
} from '../../lib/staffAuth';
import { listCurrentMemberships } from '../../lib/supabaseOrders';
import {
  PasswordField,
  customerInputClassName,
  customerPrimaryButtonClassName,
  customerSecondaryButtonClassName,
} from '../customer/CustomerAuthLayout';
import {
  StaffAuthAlert,
  StaffAuthHeader,
  StaffAuthLink,
  StaffAuthLoading,
  staffLabelClassName,
  staffPanelClassName,
  staffShellClassName,
} from './StaffAuthCommon';

interface StaffRegisterPageProps {
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
}

export const StaffRegisterPage: React.FC<StaffRegisterPageProps> = ({ onNavigate }) => {
  const authClient = supabase;
  const configured = isSupabaseConfigured && authClient !== null;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      <main className={staffShellClassName}>
        <section className={staffPanelClassName}>
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
            <p className="flex gap-2 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Pensez à vérifier vos courriers indésirables. Si un compte existe
              déjà avec cette adresse, connectez-vous simplement avec votre
              mot de passe habituel.
            </p>
            <StaffAuthLink
              path={STAFF_LOGIN_PATH}
              onNavigate={onNavigate}
              className={customerPrimaryButtonClassName}
            >
              Aller à la connexion
            </StaffAuthLink>
          </div>
        </section>
      </main>
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
    <main className={staffShellClassName}>
      <section className={staffPanelClassName}>
        <StaffAuthHeader
          title="Créer un compte propriétaire"
          description="Ce compte sert à ouvrir l'espace de votre pressing. À l'étape suivante, vous créerez votre organisation et votre première agence ; vos employés recevront leurs accès par vos soins."
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

          <div>
            <label htmlFor="staff-register-name" className={staffLabelClassName}>
              Nom complet
            </label>
            <input
              id="staff-register-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={customerInputClassName}
              disabled={busy || !configured}
              required
            />
          </div>

          <div>
            <label htmlFor="staff-register-email" className={staffLabelClassName}>
              Adresse e-mail
            </label>
            <input
              id="staff-register-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={customerInputClassName}
              disabled={busy || !configured}
              required
            />
          </div>

          <div>
            <label htmlFor="staff-register-phone" className={staffLabelClassName}>
              Téléphone (optionnel)
            </label>
            <input
              id="staff-register-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={customerInputClassName}
              disabled={busy || !configured}
              placeholder="07 00 00 00 00"
            />
          </div>

          <PasswordField
            id="staff-register-password"
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            disabled={busy || !configured}
          />
          <p className="-mt-2 text-[12px] text-zinc-500 dark:text-zinc-400">
            Au moins 8 caractères. C’est le compte qui administrera votre
            pressing : choisissez un mot de passe unique.
          </p>

          <PasswordField
            id="staff-register-confirm-password"
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            disabled={busy || !configured}
          />

          <button
            type="submit"
            className={customerPrimaryButtonClassName}
            disabled={busy || !configured}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden="true" />
            )}
            Créer mon compte
          </button>

          <StaffAuthLink
            path={STAFF_LOGIN_PATH}
            onNavigate={onNavigate}
            className={customerSecondaryButtonClassName}
          >
            J’ai déjà un compte — se connecter
          </StaffAuthLink>
        </form>

        <p className="mt-5 flex gap-2 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          <Store className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          L’inscription seule ne donne accès à aucun pressing existant :
          elle prépare uniquement la création du vôtre. Les données d’une
          autre organisation restent invisibles, protégées côté serveur.
        </p>
      </section>
    </main>
  );
};
