import React from 'react';
import { Eye, EyeOff, PackageCheck, ShieldCheck, Sparkles } from 'lucide-react';
import {
  CUSTOMER_HOME_PATH,
  CUSTOMER_LOGIN_PATH,
  CUSTOMER_REGISTER_PATH,
} from '../../lib/customerAuth';

export type CustomerNavigate = (path: string, options?: { replace?: boolean }) => void;

export const customerInputClassName =
  'w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-[14px] text-zinc-950 shadow-2xs outline-none transition placeholder:text-zinc-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20 dark:disabled:bg-zinc-900';

export const customerPrimaryButtonClassName =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-[14px] font-black text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600/25 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-blue-500 dark:text-zinc-950 dark:hover:bg-blue-400';

export const customerSecondaryButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-[13px] font-bold text-zinc-800 shadow-2xs transition hover:bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-55 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:ring-zinc-100/15';

interface CustomerNavLinkProps {
  href: string;
  onNavigate: CustomerNavigate;
  children: React.ReactNode;
  className?: string;
}

export const CustomerNavLink: React.FC<CustomerNavLinkProps> = ({
  href,
  onNavigate,
  children,
  className = '',
}) => (
  <a
    href={href}
    onClick={(event) => {
      event.preventDefault();
      onNavigate(href);
    }}
    className={className}
  >
    {children}
  </a>
);

interface CustomerAuthLayoutProps {
  title: string;
  subtitle: string;
  active: 'login' | 'register' | 'password';
  onNavigate: CustomerNavigate;
  children: React.ReactNode;
}

export const CustomerAuthLayout: React.FC<CustomerAuthLayoutProps> = ({
  title,
  subtitle,
  active,
  onNavigate,
  children,
}) => (
  <main className="min-h-screen bg-[#f4f4f5] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
    <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
      <section className="relative hidden overflow-hidden bg-[#09090b] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-600/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-teal-400/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <CustomerNavLink
            href={CUSTOMER_HOME_PATH}
            onNavigate={onNavigate}
            className="inline-flex items-center gap-3 rounded-xl focus:outline-none focus:ring-4 focus:ring-white/20"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black shadow-lg shadow-blue-950/40">
              P
            </span>
            <span>
              <span className="block text-[16px] font-black leading-tight">PressingPro CI</span>
              <span className="block text-[12px] font-medium text-zinc-400">
                Espace client pressing &amp; blanchisserie
              </span>
            </span>
          </CustomerNavLink>

          <h1 className="mt-16 max-w-md text-4xl font-black leading-[1.05] tracking-tight">
            Suivez votre linge, étape par étape.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-zinc-300">
            Réception, lavage, repassage, commande prête et remise : votre pressing
            met à jour l’avancement dans le même espace sécurisé.
          </p>
        </div>

        <ul className="relative space-y-3 text-[13.5px] text-zinc-200">
          <li className="flex items-center gap-3">
            <PackageCheck className="h-5 w-5 shrink-0 text-teal-300" aria-hidden="true" />
            Historique visible uniquement pour les fiches liées à votre compte.
          </li>
          <li className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-teal-300" aria-hidden="true" />
            Aucun accès avec le seul numéro de ticket.
          </li>
          <li className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 shrink-0 text-teal-300" aria-hidden="true" />
            Le pressing vérifie votre téléphone avant de relier vos commandes.
          </li>
        </ul>
      </section>

      <section className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-[520px]">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#09090b] text-lg font-black text-white dark:bg-zinc-100 dark:text-zinc-950">
              P
            </span>
            <div>
              <p className="text-[15px] font-black leading-tight">PressingPro CI</p>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Espace client</p>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
            {(active === 'login' || active === 'register') && (
              <div
                className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800"
                aria-label="Choisir connexion ou inscription"
              >
                <CustomerNavLink
                  href={CUSTOMER_LOGIN_PATH}
                  onNavigate={onNavigate}
                  className={`rounded-xl px-3 py-2.5 text-center text-[13px] font-black transition focus:outline-none focus:ring-4 focus:ring-blue-600/20 ${
                    active === 'login'
                      ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-50'
                      : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                  }`}
                >
                  Connexion
                </CustomerNavLink>
                <CustomerNavLink
                  href={CUSTOMER_REGISTER_PATH}
                  onNavigate={onNavigate}
                  className={`rounded-xl px-3 py-2.5 text-center text-[13px] font-black transition focus:outline-none focus:ring-4 focus:ring-blue-600/20 ${
                    active === 'register'
                      ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-950 dark:text-zinc-50'
                      : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                  }`}
                >
                  Inscription
                </CustomerNavLink>
              </div>
            )}

            <h2 className="text-[24px] font-black tracking-tight">{title}</h2>
            <p className="mb-6 mt-2 text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {subtitle}
            </p>
            {children}
          </div>

          <p className="mt-5 text-center text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Vous faites partie de l’équipe d’un pressing ?{' '}
            <CustomerNavLink
              href="/"
              onNavigate={onNavigate}
              className="font-bold text-zinc-900 underline underline-offset-4 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-600/20 dark:text-zinc-100 dark:hover:text-blue-300"
            >
              Retourner à l’application métier
            </CustomerNavLink>
          </p>
        </div>
      </section>
    </div>
  </main>
);

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  disabled?: boolean;
  describedBy?: string;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled = false,
  describedBy,
}) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-describedby={describedBy}
          className={`${customerInputClassName} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={visible ? `Masquer ${label.toLowerCase()}` : `Afficher ${label.toLowerCase()}`}
          title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-4 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          {visible ? (
            <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
          ) : (
            <Eye className="h-4.5 w-4.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
};

export const CustomerFormAlerts: React.FC<{
  error?: string | null;
  message?: string | null;
}> = ({ error, message }) => (
  <>
    {error && (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-relaxed text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
      >
        {error}
      </p>
    )}
    {message && (
      <p
        aria-live="polite"
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[13px] leading-relaxed text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
      >
        {message}
      </p>
    )}
  </>
);
