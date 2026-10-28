import React from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Receipt,
  Shirt,
  Wallet,
  WashingMachine,
  type LucideIcon,
} from 'lucide-react';
import { getPasswordStrength } from '../../lib/staffAuth';
import { staffLabelClassName } from './StaffAuthCommon';

/**
 * Composition deux panneaux des pages de connexion et d'inscription du
 * personnel : marque orange (#F97316 → #EA580C) à gauche, formulaire blanc
 * à droite, violet profond #24113D en couleur de texte d'accent.
 *
 * Module séparé de `StaffAuthCommon` pour rester hors du chunk d'entrée de
 * l'ERP : seules les pages publiques chargées en lazy le téléchargent. Le
 * bouton principal utilise l'orange-700 #C2410C afin que son texte blanc
 * respecte le contraste WCAG AA ; l'orange vif reste réservé aux grandes
 * surfaces décoratives.
 */

export const staffInputClassName =
  'w-full rounded-xl border border-slate-300 bg-white py-2.5 text-[14px] text-[#171923] shadow-2xs outline-none transition placeholder:text-slate-400 focus:border-orange-600 focus:ring-4 focus:ring-orange-600/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-orange-400 dark:focus:ring-orange-400/20 dark:disabled:bg-zinc-900';

export const staffPrimaryButtonClassName =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C2410C] px-4 py-3 text-[14px] font-black text-white shadow-sm transition hover:bg-[#9A3412] focus:outline-none focus:ring-4 focus:ring-orange-600/25 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-orange-500 dark:text-[#24113D] dark:hover:bg-orange-400';

export const staffSecondaryButtonClassName =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-orange-600/15 disabled:cursor-not-allowed disabled:opacity-55 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:ring-orange-400/20';

/* ------------------------------------------------------------------------- */
/* Champs de formulaire dédiés aux pages du personnel                        */
/* ------------------------------------------------------------------------- */

interface StaffTextFieldProps {
  id: string;
  label: string;
  icon: LucideIcon;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export const StaffTextField: React.FC<StaffTextFieldProps> = ({
  id,
  label,
  icon: Icon,
  type,
  value,
  onChange,
  autoComplete,
  inputMode,
  placeholder,
  disabled = false,
  required = false,
}) => (
  <div>
    <label htmlFor={id} className={staffLabelClassName}>
      {label}
    </label>
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
        aria-hidden="true"
      />
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${staffInputClassName} pl-10 pr-3.5`}
        disabled={disabled}
        required={required}
      />
    </div>
  </div>
);

interface StaffPasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  disabled?: boolean;
  describedBy?: string;
}

export const StaffPasswordField: React.FC<StaffPasswordFieldProps> = ({
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
      <label htmlFor={id} className={staffLabelClassName}>
        {label}
      </label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400 dark:text-zinc-500"
          aria-hidden="true"
        />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-describedby={describedBy}
          className={`${staffInputClassName} pl-10 pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={visible ? `Masquer ${label.toLowerCase()}` : `Afficher ${label.toLowerCase()}`}
          title={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-orange-600/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
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

const STRENGTH_SEGMENT_CLASSES = [
  'bg-red-500',
  'bg-amber-500',
  'bg-lime-500',
  'bg-emerald-500',
] as const;

/** Jauge de robustesse du mot de passe (affichée uniquement pendant la saisie). */
export const PasswordStrengthMeter: React.FC<{ password: string }> = ({ password }) => {
  if (!password) return null;
  const { score, label } = getPasswordStrength(password);
  const filledClass = STRENGTH_SEGMENT_CLASSES[Math.max(score, 1) - 1];

  return (
    <div className="-mt-2">
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              index < score ? filledClass : 'bg-slate-200 dark:bg-zinc-700'
            }`}
          />
        ))}
      </div>
      <p aria-live="polite" className="mt-1.5 text-[12px] font-semibold text-[#64748B] dark:text-zinc-400">
        Robustesse du mot de passe : {label}
      </p>
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* Panneau de marque et composition deux panneaux                            */
/* ------------------------------------------------------------------------- */

/** Illustration originale en SVG : machine à laver, cintre et linge plié. */
const StaffBrandIllustration: React.FC = () => (
  <svg
    viewBox="0 0 320 220"
    role="presentation"
    aria-hidden="true"
    className="mx-auto w-full max-w-[330px]"
  >
    <circle cx="160" cy="118" r="92" fill="#FFFFFF" opacity="0.14" />
    <ellipse cx="160" cy="198" rx="112" ry="8" fill="#9A3412" opacity="0.28" />

    {/* Cintre et chemise */}
    <path
      d="M60 54a7 7 0 1 1 7-7"
      fill="none"
      stroke="#24113D"
      strokeWidth="4"
      strokeLinecap="round"
    />
    <path
      d="M60 56 34 80h52L60 56Z"
      fill="none"
      stroke="#24113D"
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <path
      d="M40 84l11-7c3 4 15 4 18 0l11 7 7 14-11 5v28H44V103l-11-5 7-14Z"
      fill="#FFFFFF"
      opacity="0.96"
    />
    <path d="M51 77c3 4 15 4 18 0" fill="none" stroke="#FDBA74" strokeWidth="3" strokeLinecap="round" />

    {/* Machine à laver */}
    <rect x="108" y="58" width="106" height="132" rx="14" fill="#FFFFFF" />
    <rect x="108" y="58" width="106" height="26" rx="13" fill="#FFF7ED" />
    <circle cx="124" cy="71" r="4" fill="#EA580C" />
    <circle cx="138" cy="71" r="4" fill="#FDBA74" />
    <rect x="182" y="67" width="22" height="8" rx="4" fill="#24113D" opacity="0.85" />
    <circle cx="161" cy="134" r="36" fill="#24113D" />
    <circle cx="161" cy="134" r="28" fill="#352052" />
    <path
      d="M136 142c8-7 16 4 25 0s17-6 25 1v6a28 28 0 0 1-50 0v-7Z"
      fill="#F97316"
      opacity="0.9"
    />
    <circle cx="150" cy="122" r="5" fill="#FFFFFF" opacity="0.75" />
    <circle cx="170" cy="114" r="3.5" fill="#FFFFFF" opacity="0.55" />

    {/* Bouteille de lessive */}
    <rect x="190" y="34" width="17" height="24" rx="4" fill="#24113D" />
    <rect x="194" y="28" width="9" height="7" rx="2" fill="#FFFFFF" />
    <rect x="194" y="42" width="9" height="8" rx="2" fill="#FDBA74" />

    {/* Linge plié */}
    <rect x="226" y="160" width="68" height="15" rx="7.5" fill="#FFFFFF" />
    <rect x="230" y="145" width="60" height="15" rx="7.5" fill="#FED7AA" />
    <rect x="234" y="130" width="52" height="15" rx="7.5" fill="#DDD6FE" />

    {/* Bulles et étincelles */}
    <circle cx="94" cy="34" r="5" fill="#FFFFFF" opacity="0.8" />
    <circle cx="108" cy="20" r="3.5" fill="#FFFFFF" opacity="0.55" />
    <circle cx="246" cy="52" r="4" fill="#FFFFFF" opacity="0.7" />
    <circle cx="260" cy="36" r="6" fill="#FFFFFF" opacity="0.45" />
    <path
      d="M44 150l2.2 5.3L51.5 157l-5.3 2.2L44 164.5l-2.2-5.3L36.5 157l5.3-1.7L44 150Z"
      fill="#FFFFFF"
    />
    <path
      d="M282 92l1.8 4.2 4.2 1.8-4.2 1.8L282 104l-1.8-4.2-4.2-1.8 4.2-1.8L282 92Z"
      fill="#FFFFFF"
      opacity="0.9"
    />
  </svg>
);

const STAFF_BRAND_FEATURES: Array<{ icon: LucideIcon; text: string }> = [
  { icon: Receipt, text: 'Réception, tickets et suivi des commandes sans ressaisie.' },
  { icon: WashingMachine, text: 'Atelier synchronisé : chaque étape est tracée et horodatée.' },
  { icon: Wallet, text: 'Caisse claire : espèces, Wave, Orange Money et MTN MoMo.' },
];

const StaffBrandMark: React.FC = () => (
  <p className="flex items-center gap-3">
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#C2410C] shadow-lg shadow-orange-900/20">
      <Shirt className="h-6 w-6" aria-hidden="true" />
    </span>
    <span>
      <span className="block text-[17px] font-black leading-tight text-white">
        PressingPro CI
      </span>
      <span className="block text-[12px] font-bold text-[#24113D]">
        Pressing &amp; blanchisserie — Côte d’Ivoire
      </span>
    </span>
  </p>
);

const StaffBrandPanel: React.FC = () => (
  <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#F97316] to-[#EA580C] p-8 md:flex md:flex-col lg:p-10">
    <div
      className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10"
      aria-hidden="true"
    />
    <div
      className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#24113D]/10"
      aria-hidden="true"
    />
    <div className="relative flex h-full flex-col">
      <StaffBrandMark />

      <p className="mt-10 max-w-sm text-[30px] font-black leading-[1.12] tracking-tight text-white">
        Le soin du linge, la rigueur d’un ERP.
      </p>
      <p className="mt-3 max-w-sm text-[14px] font-medium leading-relaxed text-[#24113D]">
        Réceptionnez, traitez et restituez chaque commande avec un suivi
        partagé entre le comptoir, l’atelier et la caisse.
      </p>

      <div className="my-8 hidden lg:block">
        <StaffBrandIllustration />
      </div>

      <ul className="relative mt-auto space-y-2.5">
        {STAFF_BRAND_FEATURES.map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 text-[13.5px] font-semibold leading-snug text-[#24113D] shadow-sm"
          >
            <Icon className="h-5 w-5 shrink-0 text-[#C2410C]" aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>
    </div>
  </section>
);

/** Bandeau de marque compact affiché au-dessus du formulaire sur mobile. */
const StaffMobileBrandHeader: React.FC = () => (
  <div className="bg-gradient-to-r from-[#F97316] to-[#EA580C] px-6 py-5 md:hidden">
    <StaffBrandMark />
  </div>
);

/**
 * Composition deux panneaux des pages de connexion et d'inscription :
 * marque à gauche (tablette et bureau), formulaire à droite ; sur mobile,
 * un bandeau orange compact surmonte le formulaire affiché en priorité.
 */
export const StaffAuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className="min-h-screen bg-[#F8FAFC] text-[#171923] dark:bg-zinc-950 dark:text-zinc-50">
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid w-full max-w-md overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl shadow-slate-950/10 dark:border-zinc-800 dark:bg-zinc-900 md:max-w-4xl md:grid-cols-[0.85fr_1fr] lg:max-w-5xl lg:grid-cols-[1.02fr_1fr]">
        <StaffMobileBrandHeader />
        <StaffBrandPanel />
        <section className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto w-full max-w-[440px]">{children}</div>
        </section>
      </div>
    </div>
  </main>
);
