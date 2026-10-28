import React, { useState } from 'react';
import { Loader2, UserRoundPlus } from 'lucide-react';
import {
  CUSTOMER_HOME_PATH,
  CUSTOMER_LOGIN_PATH,
  mapSupabaseAuthError,
  normalizePhoneToE164,
  validateCustomerRegistration,
} from '../../lib/customerAuth';
import { getSupabaseConfigStatus, supabase } from '../../lib/supabase';
import {
  CustomerAuthLayout,
  CustomerFormAlerts,
  CustomerNavLink,
  PasswordField,
  customerInputClassName,
  customerPrimaryButtonClassName,
  type CustomerNavigate,
} from './CustomerAuthLayout';

interface CustomerRegisterPageProps {
  onNavigate: CustomerNavigate;
}

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

  const submitRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || busy) return;

    const input = {
      fullName,
      phone,
      email,
      password,
      confirmPassword,
      confirmsDepositPhone,
    };
    const validationError = validateCustomerRegistration(input);
    if (validationError) {
      setError(validationError);
      setMessage(null);
      return;
    }

    const phoneE164 = normalizePhoneToE164(phone);
    if (!phoneE164) {
      setError('Saisissez un numéro de téléphone valide.');
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
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

    setBusy(false);
    setPassword('');
    setConfirmPassword('');

    if (signUpError) {
      setError(mapSupabaseAuthError(signUpError));
      return;
    }

    if (data.session) {
      onNavigate(CUSTOMER_HOME_PATH, { replace: true });
      return;
    }

    setMessage(
      'Inscription enregistrée. Ouvrez l’e-mail de confirmation pour activer votre compte, puis connectez-vous. Votre pressing devra ensuite vérifier votre numéro avant de relier vos commandes.'
    );
  };

  return (
    <CustomerAuthLayout
      title="Créer un compte client"
      subtitle="Utilisez le numéro de téléphone communiqué au pressing lors de vos dépôts. Il servira à demander la liaison sécurisée de vos commandes."
      active="register"
      onNavigate={onNavigate}
    >
      {!config.configured && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          Le service d’inscription n’est pas configuré dans cet environnement.
          Les formulaires sont visibles, mais aucune demande ne sera envoyée.
        </p>
      )}

      <form onSubmit={(event) => void submitRegistration(event)} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="customer-register-name"
            className="mb-1.5 block text-[12px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
          >
            Nom complet
          </label>
          <input
            id="customer-register-name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            placeholder="Ex. Awa Koné"
            disabled={!config.configured || busy}
            className={customerInputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="customer-register-phone"
            className="mb-1.5 block text-[12px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
          >
            Téléphone utilisé pour vos dépôts
          </label>
          <input
            id="customer-register-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            inputMode="tel"
            placeholder="07 00 00 00 00"
            aria-describedby="customer-register-phone-help"
            disabled={!config.configured || busy}
            className={customerInputClassName}
          />
          <p id="customer-register-phone-help" className="mt-1.5 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Format ivoirien à 10 chiffres ou international. Ce numéro reste à
            vérifier par le pressing : l’inscription seule ne donne accès à
            aucune commande.
          </p>
        </div>

        <div>
          <label
            htmlFor="customer-register-email"
            className="mb-1.5 block text-[12px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
          >
            Adresse e-mail
          </label>
          <input
            id="customer-register-email"
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PasswordField
            id="customer-register-password"
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            disabled={!config.configured || busy}
            describedBy="customer-register-password-help"
          />
          <PasswordField
            id="customer-register-confirm-password"
            label="Confirmer"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            disabled={!config.configured || busy}
          />
        </div>
        <p id="customer-register-password-help" className="-mt-2 text-[12px] text-zinc-500 dark:text-zinc-400">
          Au moins 8 caractères. N’utilisez pas le même mot de passe que vos
          autres comptes importants.
        </p>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-[13px] leading-relaxed text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={confirmsDepositPhone}
            onChange={(event) => setConfirmsDepositPhone(event.target.checked)}
            disabled={!config.configured || busy}
            className="mt-0.5 h-4.5 w-4.5 shrink-0 accent-blue-700"
          />
          <span>
            Je confirme que ce numéro est celui utilisé pour mes dépôts et
            j’accepte que le pressing le vérifie avant de relier mes commandes.
          </span>
        </label>

        <CustomerFormAlerts error={error} message={message} />

        <button
          type="submit"
          disabled={!config.configured || busy}
          className={customerPrimaryButtonClassName}
        >
          {busy ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden="true" />
          ) : (
            <UserRoundPlus className="h-4.5 w-4.5" aria-hidden="true" />
          )}
          Créer mon compte client
        </button>

        <p className="pt-1 text-center text-[13px] text-zinc-600 dark:text-zinc-400">
          Vous avez déjà un compte ?{' '}
          <CustomerNavLink
            href={CUSTOMER_LOGIN_PATH}
            onNavigate={onNavigate}
            className="font-bold text-zinc-900 underline-offset-4 hover:text-blue-700 hover:underline focus:outline-none focus:ring-4 focus:ring-blue-600/20 dark:text-zinc-100 dark:hover:text-blue-300"
          >
            Se connecter
          </CustomerNavLink>
        </p>
      </form>
    </CustomerAuthLayout>
  );
};
