import React from 'react';
import {
  ArrowUpRight,
  Loader2,
  Lock,
  Mail,
  PackageCheck,
  Receipt,
  ShieldCheck,
  Shirt,
  Wallet,
  WashingMachine,
  type LucideIcon,
} from 'lucide-react';
import { AuthAlert } from './AuthAlert';
import {
  authLinkClassName,
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from './authStyles';
import { CUSTOMER_LOGIN_PATH } from '../../lib/customerAuth';
import { STAFF_LOGIN_PATH } from '../../lib/staffAuth';

/**
 * Socle visuel unique des pages d'accès publiques de PressingPro CI :
 * connexion, inscription et nouveau mot de passe, pour le personnel comme
 * pour les clients.
 *
 * Une seule composition — panneau de marque sombre à gauche, formulaire à
 * droite, bandeau compact au-dessus du formulaire sur mobile — remplace les
 * trois layouts concurrents qui cohabitaient auparavant (`StaffAuthLayout`,
 * `StaffPremiumAuthLayout`, `CustomerAuthLayout`). Les classes sont statiques
 * (pas de construction dynamique de noms Tailwind) pour que le compilateur
 * CSS les conserve toutes.
 */

export { AuthAlert } from './AuthAlert';
export type { AlertTone } from './AuthAlert';
export {
  authHintClassName,
  authInputClassName,
  authLabelClassName,
  authLinkClassName,
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from './authStyles';
export { AuthPasswordField, AuthTextField, PasswordStrengthMeter } from './AuthFields';

export type AuthNavigate = (path: string, options?: { replace?: boolean }) => void;
export type AuthAudience = 'staff' | 'customer';

/* ------------------------------------------------------------------------- */
/* Contenu du panneau de marque, par espace                                  */
/* ------------------------------------------------------------------------- */

interface AudienceTheme {
  label: string;
  dotClassName: string;
  iconClassName: string;
  featureIconClassName: string;
  panelGlowClassName: string;
  headline: React.ReactNode;
  description: string;
  features: Array<{ icon: LucideIcon; title: string; text: string }>;
  footnote: string;
}

const AUDIENCE_THEME: Record<AuthAudience, AudienceTheme> = {
  staff: {
    label: 'Espace personnel',
    dotClassName: 'bg-amber-300',
    iconClassName: 'text-amber-200',
    featureIconClassName:
      'bg-amber-300/10 text-amber-200 ring-1 ring-inset ring-amber-200/25',
    panelGlowClassName: 'bg-amber-300/20',
    headline: (
      <>
        Chaque pièce suivie,
        <br />
        du dépôt à la remise.
      </>
    ),
    description:
      'Réception, atelier, caisse et rapports dans un seul espace. Vos équipes travaillent sur les mêmes commandes, sans ressaisie.',
    features: [
      {
        icon: Receipt,
        title: 'Réception sans ressaisie',
        text: 'Ticket, articles et délais de retrait en une seule saisie.',
      },
      {
        icon: WashingMachine,
        title: 'Atelier tracé',
        text: 'Chaque étape est horodatée, du lavage à la remise.',
      },
      {
        icon: Wallet,
        title: 'Caisse claire',
        text: 'Espèces, Wave, Orange Money et MTN MoMo.',
      },
    ],
    footnote: 'Données cloisonnées par établissement — contrôles appliqués côté serveur.',
  },
  customer: {
    label: 'Espace client',
    dotClassName: 'bg-teal-300',
    iconClassName: 'text-teal-200',
    featureIconClassName:
      'bg-teal-300/10 text-teal-200 ring-1 ring-inset ring-teal-200/25',
    panelGlowClassName: 'bg-teal-300/20',
    headline: (
      <>
        Votre linge, suivi
        <br />
        jusqu’au dernier pli.
      </>
    ),
    description:
      'Consultez l’avancement de vos commandes et l’historique de vos dépôts, dans un espace relié au pressing qui vous connaît.',
    features: [
      {
        icon: PackageCheck,
        title: 'Statut à chaque étape',
        text: 'Reçu, lavage, repassage, prêt, puis remis.',
      },
      {
        icon: ShieldCheck,
        title: 'Historique personnel',
        text: 'Uniquement les commandes reliées à votre numéro vérifié.',
      },
      {
        icon: Mail,
        title: 'Aucun ticket à conserver',
        text: 'Votre compte remplace la recherche du reçu papier.',
      },
    ],
    footnote: 'Compte relié à vos commandes après vérification de votre numéro par le pressing.',
  },
};

/* ------------------------------------------------------------------------- */
/* Marque et panneau visuel                                                  */
/* ------------------------------------------------------------------------- */

const BrandMark: React.FC<{
  tone: 'dark' | 'light';
  audience: AuthAudience;
  compact?: boolean;
}> = ({ tone, audience, compact = false }) => {
  const theme = AUDIENCE_THEME[audience];
  const onDark = tone === 'dark';

  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex shrink-0 items-center justify-center rounded-[14px] ${
          compact ? 'h-10 w-10' : 'h-11 w-11'
        } ${
          onDark
            ? 'bg-white/10 ring-1 ring-inset ring-white/20'
            : 'bg-[#0B1220] shadow-[0_10px_24px_-14px_rgba(11,18,32,0.9)]'
        }`}
      >
        <Shirt
          className={`${compact ? 'h-5 w-5' : 'h-5.5 w-5.5'} ${
            onDark ? theme.iconClassName : 'text-amber-200'
          }`}
          aria-hidden="true"
        />
      </span>
      <span className="min-w-0">
        <span
          className={`block text-[16px] font-black leading-tight tracking-tight ${
            onDark ? 'text-white' : 'text-[#111827] dark:text-white'
          }`}
        >
          PressingPro CI
        </span>
        <span
          className={`block truncate text-[11.5px] font-semibold ${
            onDark ? 'text-white/55' : 'text-[#6B7280] dark:text-zinc-400'
          }`}
        >
          Pressing &amp; blanchisserie · Abidjan
        </span>
      </span>
    </div>
  );
};

/**
 * Composition originale en SVG, sans image distante : tambour de machine
 * (anneau, eau, bulles), cintre et linge plié. Les couleurs sont posées
 * explicitement pour rester lisibles sur le panneau sombre.
 */
const StaffArtwork: React.FC = () => (
  <svg
    viewBox="0 0 420 264"
    role="presentation"
    aria-hidden="true"
    className="h-full w-auto max-w-full"
  >
    <defs>
      <linearGradient id="auth-staff-drum" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1B2740" />
        <stop offset="100%" stopColor="#0B1322" />
      </linearGradient>
      <linearGradient id="auth-staff-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
      </linearGradient>
    </defs>

    <circle cx="290" cy="126" r="104" fill="#F2C078" opacity="0.06" />
    <path
      d="M28 226h364"
      stroke="#F8F1E4"
      strokeOpacity="0.14"
      strokeWidth="1.5"
      strokeLinecap="round"
    />

    {/* Cintre et chemise */}
    <path
      d="M48 52h134"
      stroke="#F8F1E4"
      strokeOpacity="0.32"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M85 58a7 7 0 1 1 7-7"
      fill="none"
      stroke="#F8F1E4"
      strokeOpacity="0.6"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M92 58 60 84h64L92 58Z"
      fill="none"
      stroke="#F8F1E4"
      strokeOpacity="0.55"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M64 88l10-6c4 5 14 5 18 0l10 6 7 16-12 5v38H69v-38l-12-5 7-16Z"
      fill="#F8F1E4"
      fillOpacity="0.94"
    />
    <path
      d="M74 82c4 5 14 5 18 0"
      fill="none"
      stroke="#F2C078"
      strokeWidth="2.5"
      strokeLinecap="round"
    />

    {/* Linge plié */}
    <rect x="60" y="202" width="116" height="22" rx="11" fill="#F8F1E4" fillOpacity="0.92" />
    <rect x="68" y="180" width="100" height="22" rx="11" fill="#F2C078" fillOpacity="0.92" />
    <rect x="78" y="158" width="84" height="22" rx="11" fill="#7FA8F8" fillOpacity="0.85" />
    <circle cx="50" cy="150" r="5" fill="#F8F1E4" fillOpacity="0.5" />
    <circle cx="188" cy="140" r="3.5" fill="#F8F1E4" fillOpacity="0.35" />

    {/* Machine à laver */}
    <rect
      x="222"
      y="48"
      width="128"
      height="170"
      rx="22"
      fill="#101A2E"
      stroke="#F8F1E4"
      strokeOpacity="0.22"
      strokeWidth="1.5"
    />
    <path
      d="M222 78h128"
      stroke="#F8F1E4"
      strokeOpacity="0.14"
      strokeWidth="1.5"
    />
    <circle cx="242" cy="63" r="4.5" fill="#F2C078" />
    <circle cx="257" cy="63" r="4.5" fill="#F8F1E4" fillOpacity="0.35" />
    <rect
      x="298"
      y="57"
      width="34"
      height="12"
      rx="4"
      fill="none"
      stroke="#F8F1E4"
      strokeOpacity="0.3"
      strokeWidth="1.5"
    />
    <circle
      cx="286"
      cy="150"
      r="52"
      fill="url(#auth-staff-drum)"
      stroke="#F8F1E4"
      strokeOpacity="0.26"
      strokeWidth="1.5"
    />
    <circle
      cx="286"
      cy="150"
      r="42"
      fill="none"
      stroke="#F2C078"
      strokeOpacity="0.4"
      strokeWidth="1.5"
      strokeDasharray="3 7"
    />
    <path
      d="M249 163c11-8 22 5 33 1s20-9 30-2v10a42 42 0 0 1-63 0v-9Z"
      fill="url(#auth-staff-water)"
    />
    <circle cx="273" cy="128" r="4.5" fill="#F8F1E4" fillOpacity="0.45" />
    <circle cx="294" cy="119" r="3" fill="#F8F1E4" fillOpacity="0.3" />
    <circle cx="308" cy="136" r="2.2" fill="#F8F1E4" fillOpacity="0.25" />

    {/* Bulles et étincelle */}
    <circle cx="368" cy="88" r="6" fill="#F8F1E4" fillOpacity="0.22" />
    <circle cx="382" cy="66" r="3.5" fill="#F8F1E4" fillOpacity="0.16" />
    <path
      d="M206 112l2.4 5.8 5.8 2.4-5.8 2.4-2.4 5.8-2.4-5.8-5.8-2.4 5.8-2.4L206 112Z"
      fill="#F2C078"
      fillOpacity="0.75"
    />
  </svg>
);

/**
 * Variante espace client : carte de suivi (étapes) et linge plié, dans les
 * mêmes matières que la variante personnel mais avec l'accent turquoise.
 */
const CustomerArtwork: React.FC = () => (
  <svg
    viewBox="0 0 420 264"
    role="presentation"
    aria-hidden="true"
    className="h-full w-auto max-w-full"
  >
    <defs>
      <linearGradient id="auth-customer-card" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#142033" />
        <stop offset="100%" stopColor="#0B1322" />
      </linearGradient>
    </defs>

    <circle cx="196" cy="128" r="104" fill="#5EEAD4" opacity="0.06" />
    <path
      d="M28 226h364"
      stroke="#F8F1E4"
      strokeOpacity="0.14"
      strokeWidth="1.5"
      strokeLinecap="round"
    />

    {/* Carte de suivi */}
    <rect
      x="54"
      y="42"
      width="184"
      height="184"
      rx="24"
      fill="url(#auth-customer-card)"
      stroke="#F8F1E4"
      strokeOpacity="0.22"
      strokeWidth="1.5"
    />
    <rect x="76" y="64" width="62" height="7" rx="3.5" fill="#F8F1E4" fillOpacity="0.5" />
    <rect x="76" y="80" width="104" height="5" rx="2.5" fill="#F8F1E4" fillOpacity="0.22" />
    <path
      d="M88 112v72"
      stroke="#F8F1E4"
      strokeOpacity="0.2"
      strokeWidth="1.5"
      strokeDasharray="3 6"
    />
    <circle cx="88" cy="114" r="7" fill="#5EEAD4" />
    <circle cx="88" cy="148" r="7" fill="#F2C078" />
    <circle
      cx="88"
      cy="184"
      r="7"
      fill="#0B1322"
      stroke="#F8F1E4"
      strokeOpacity="0.35"
      strokeWidth="1.5"
    />
    <rect x="106" y="109" width="86" height="6" rx="3" fill="#F8F1E4" fillOpacity="0.62" />
    <rect x="106" y="121" width="58" height="4" rx="2" fill="#F8F1E4" fillOpacity="0.2" />
    <rect x="106" y="143" width="72" height="6" rx="3" fill="#F8F1E4" fillOpacity="0.45" />
    <rect x="106" y="155" width="48" height="4" rx="2" fill="#F8F1E4" fillOpacity="0.2" />
    <rect x="106" y="179" width="64" height="6" rx="3" fill="#F8F1E4" fillOpacity="0.28" />
    <rect x="106" y="191" width="40" height="4" rx="2" fill="#F8F1E4" fillOpacity="0.16" />
    <circle cx="216" cy="202" r="8" fill="#F8F1E4" fillOpacity="0.16" />

    {/* Linge plié */}
    <rect x="264" y="170" width="118" height="22" rx="11" fill="#F8F1E4" fillOpacity="0.92" />
    <rect x="272" y="148" width="100" height="22" rx="11" fill="#5EEAD4" fillOpacity="0.9" />
    <rect x="282" y="126" width="84" height="22" rx="11" fill="#F2C078" fillOpacity="0.9" />

    {/* Cintre */}
    <path
      d="M288 62h96"
      stroke="#F8F1E4"
      strokeOpacity="0.32"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M336 68a7 7 0 1 1 7-7"
      fill="none"
      stroke="#F8F1E4"
      strokeOpacity="0.55"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M343 68 311 94h64L343 68Z"
      fill="none"
      stroke="#F8F1E4"
      strokeOpacity="0.45"
      strokeWidth="2"
      strokeLinejoin="round"
    />

    <circle cx="256" cy="66" r="5" fill="#F8F1E4" fillOpacity="0.28" />
    <circle cx="386" cy="112" r="4" fill="#F8F1E4" fillOpacity="0.2" />
    <path
      d="M250 100l2.4 5.8 5.8 2.4-5.8 2.4-2.4 5.8-2.4-5.8-5.8-2.4 5.8-2.4L250 100Z"
      fill="#5EEAD4"
      fillOpacity="0.7"
    />
  </svg>
);

const BrandPanel: React.FC<{ audience: AuthAudience }> = ({ audience }) => {
  const theme = AUDIENCE_THEME[audience];

  return (
    <section className="relative hidden overflow-hidden bg-[#0B1220] p-8 md:flex md:flex-col lg:p-10">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full blur-3xl ${theme.panelGlowClassName}`}
        style={{ opacity: 0.35 }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
          backgroundSize: '38px 38px',
        }}
      />

      <div className="relative flex h-full flex-col">
        <BrandMark tone="dark" audience={audience} />

        <div className="mt-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10.5px] font-black uppercase tracking-[0.16em] text-white/70">
            <span className={`h-1.5 w-1.5 rounded-full ${theme.dotClassName}`} aria-hidden="true" />
            {theme.label}
          </p>
          <h2 className="mt-4 max-w-[19ch] text-[30px] font-black leading-[1.08] tracking-tight text-white lg:text-[34px]">
            {theme.headline}
          </h2>
          <p className="mt-3 max-w-[34ch] text-[13.5px] leading-relaxed text-white/65">
            {theme.description}
          </p>
        </div>

        <div className="my-6 hidden h-[170px] items-center justify-center lg:[@media(min-height:900px)]:flex">
          {audience === 'staff' ? <StaffArtwork /> : <CustomerArtwork />}
        </div>

        <ul className="relative mt-auto space-y-2.5">
          {theme.features.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3"
            >
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${theme.featureIconClassName}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-bold text-white">{title}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-white/60">
                  {text}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-6 flex items-start gap-2 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/55">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {theme.footnote}
        </p>
      </div>
    </section>
  );
};

const MobileBrandBar: React.FC<{ audience: AuthAudience }> = ({ audience }) => {
  const theme = AUDIENCE_THEME[audience];

  return (
    <div className="relative overflow-hidden bg-[#0B1220] px-5 py-4 md:hidden">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full blur-2xl ${theme.panelGlowClassName}`}
        style={{ opacity: 0.3 }}
      />
      <div className="relative flex items-center justify-between gap-3">
        <BrandMark tone="dark" audience={audience} compact />
        <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/65 sm:inline-flex">
          <span className={`h-1.5 w-1.5 rounded-full ${theme.dotClassName}`} aria-hidden="true" />
          {theme.label}
        </span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* Composition de page                                                       */
/* ------------------------------------------------------------------------- */

interface AuthShellProps {
  audience: AuthAudience;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  /** Bandeau d'état (service non configuré, consignes) sous le sous-titre. */
  notice?: React.ReactNode;
  /** Sélecteur Connexion / Inscription au-dessus de l'en-tête. */
  tabs?: React.ReactNode;
  /** Liens secondaires sous le formulaire. */
  footer?: React.ReactNode;
}

export const AuthShell: React.FC<AuthShellProps> = ({
  audience,
  title,
  subtitle,
  children,
  notice,
  tabs,
  footer,
}) => {
  const theme = AUDIENCE_THEME[audience];
  const currentYear = new Date().getFullYear();

  return (
    <main
      aria-labelledby="auth-title"
      className="flex min-h-screen flex-col bg-[#F7F5F2] px-3 py-4 text-[#111827] dark:bg-[#07090F] dark:text-zinc-100 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-[1120px] flex-1 items-center">
        <div className="grid w-full overflow-hidden rounded-[26px] border border-[#E4DFD6] bg-white shadow-[0_36px_90px_-48px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0B101B] md:grid-cols-[0.92fr_1fr] lg:grid-cols-[1fr_0.94fr] md:min-h-[620px]">
          <MobileBrandBar audience={audience} />
          <BrandPanel audience={audience} />

          <section className="flex flex-col px-5 py-7 sm:px-8 sm:py-9 lg:px-12 lg:py-12">
            <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center">
              {tabs ? <div className="mb-6">{tabs}</div> : null}

              <p className="inline-flex items-center gap-2 text-[10.5px] font-black uppercase tracking-[0.16em] text-[#6B7280] dark:text-zinc-400">
                <span className={`h-1.5 w-1.5 rounded-full ${theme.dotClassName}`} aria-hidden="true" />
                {theme.label}
              </p>
              <h1
                id="auth-title"
                className="mt-2.5 text-[26px] font-black leading-[1.15] tracking-tight text-[#111827] sm:text-[30px] dark:text-white"
              >
                {title}
              </h1>
              <p className="mt-2.5 max-w-[44ch] text-[13.5px] leading-relaxed text-[#5C6472] dark:text-zinc-400">
                {subtitle}
              </p>

              {notice ? <div className="mt-5">{notice}</div> : null}

              <div className="mt-6">{children}</div>

              {footer ? (
                <div className="mt-6 border-t border-[#EFEAE2] pt-5 dark:border-white/10">
                  {footer}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <div className="mx-auto mt-4 flex w-full max-w-[1120px] flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11.5px] text-[#6B665D] dark:text-zinc-400">
        <span>© {currentYear} PressingPro CI</span>
        <a
          href="/conditions"
          target="_blank"
          rel="noreferrer"
          className="rounded underline-offset-4 transition hover:text-[#111827] hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-[#111827]/15 dark:hover:text-zinc-200"
        >
          Conditions d’utilisation
        </a>
        <a
          href="/confidentialite"
          target="_blank"
          rel="noreferrer"
          className="rounded underline-offset-4 transition hover:text-[#111827] hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-[#111827]/15 dark:hover:text-zinc-200"
        >
          Confidentialité
        </a>
      </div>
    </main>
  );
};

/* ------------------------------------------------------------------------- */
/* Primitives de formulaire                                                  */
/* ------------------------------------------------------------------------- */

interface AuthLinkProps {
  href: string;
  onNavigate: AuthNavigate;
  children: React.ReactNode;
  className?: string;
  /** Ouvre dans un nouvel onglet (pages légales) sans perdre la saisie. */
  newTab?: boolean;
}

/** Lien interne des pages publiques : reste un vrai <a href> (partage, SEO). */
export const AuthLink: React.FC<AuthLinkProps> = ({
  href,
  onNavigate,
  children,
  className = '',
  newTab = false,
}) => (
  <a
    href={href}
    className={className}
    {...(newTab ? { target: '_blank', rel: 'noreferrer' } : {})}
    onClick={(event) => {
      if (newTab || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      onNavigate(href);
    }}
  >
    {children}
  </a>
);

export const AuthUnconfiguredNotice: React.FC<{ audience: AuthAudience }> = ({ audience }) => (
  <AuthAlert tone="warning" title="Service d’authentification non configuré">
    {audience === 'staff'
      ? 'Cette version de démonstration n’est reliée à aucun projet Supabase : les formulaires restent consultables, mais aucune connexion ne peut être vérifiée.'
      : 'Cette version de démonstration n’est reliée à aucun projet Supabase : les formulaires restent consultables, mais aucun compte ne peut être créé ni vérifié.'}
  </AuthAlert>
);

interface AuthButtonProps {
  children: React.ReactNode;
  type?: 'submit' | 'button';
  variant?: 'primary' | 'secondary';
  busy?: boolean;
  icon?: LucideIcon;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export const AuthButton: React.FC<AuthButtonProps> = ({
  children,
  type = 'submit',
  variant = 'primary',
  busy = false,
  icon: Icon,
  disabled = false,
  onClick,
  className = '',
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || busy}
    aria-busy={busy || undefined}
    className={`${
      variant === 'primary' ? authPrimaryButtonClassName : authSecondaryButtonClassName
    }${className ? ` ${className}` : ''}`}
  >
    {busy ? (
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
    ) : Icon ? (
      <Icon className="h-4 w-4" aria-hidden="true" />
    ) : null}
    <span>{children}</span>
  </button>
);

/** Sélecteur Connexion / Inscription (espace client). */
export const AuthTabs: React.FC<{
  items: Array<{ label: string; href: string; active: boolean }>;
  onNavigate: AuthNavigate;
}> = ({ items, onNavigate }) => (
  <nav
    aria-label="Choisir la connexion ou l’inscription"
    className="grid grid-cols-2 gap-1 rounded-2xl border border-[#ECE7DE] bg-[#F6F3EC] p-1 dark:border-white/10 dark:bg-white/[0.04]"
  >
    {items.map((item) => (
      <a
        key={item.href}
        href={item.href}
        aria-current={item.active ? 'page' : undefined}
        onClick={(event) => {
          event.preventDefault();
          onNavigate(item.href);
        }}
        className={`rounded-xl px-3 py-2 text-center text-[12.5px] font-black transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#1D4ED8]/20 ${
          item.active
            ? 'bg-white text-[#111827] shadow-sm dark:bg-[#141B29] dark:text-white'
            : 'text-[#6B7280] hover:text-[#111827] dark:text-zinc-400 dark:hover:text-zinc-100'
        }`}
      >
        {item.label}
      </a>
    ))}
  </nav>
);

/**
 * Pied de carte commun : rappelle qu'un compte client et un compte personnel
 * sont deux espaces distincts, avec un lien vers l'autre espace.
 */
export const AuthSpaceSwitch: React.FC<{
  audience: AuthAudience;
  onNavigate: AuthNavigate;
  note?: string;
}> = ({ audience, onNavigate, note }) => {
  const isStaff = audience === 'staff';

  return (
    <div className="space-y-2 text-center">
      <p className="text-[12.5px] leading-relaxed text-[#6B7280] dark:text-zinc-400">
        {isStaff
          ? 'Vous venez déposer du linge ?'
          : 'Vous faites partie de l’équipe d’un pressing ?'}
      </p>
      <AuthLink
        href={isStaff ? CUSTOMER_LOGIN_PATH : STAFF_LOGIN_PATH}
        onNavigate={onNavigate}
        className={`${authLinkClassName} inline-flex items-center gap-1 text-[12.5px]`}
      >
        {isStaff ? 'Ouvrir l’espace client' : 'Accéder à l’espace professionnel'}
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </AuthLink>
      {note ? (
        <p className="mx-auto max-w-[36ch] pt-1 text-[11.5px] leading-relaxed text-[#6B665D] dark:text-zinc-400">
          {note}
        </p>
      ) : null}
    </div>
  );
};

/** Écran d'attente plein page pendant la vérification d'une session. */
export const AuthLoadingScreen: React.FC<{ label: string }> = ({ label }) => (
  <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#F7F5F2] px-4 dark:bg-[#07090F]">
    <BrandMark tone="light" audience="staff" />
    <p className="flex items-center gap-2 rounded-2xl border border-[#E4DFD6] bg-white px-5 py-3.5 text-[12.5px] font-semibold text-[#5C6472] shadow-sm dark:border-white/10 dark:bg-[#0B101B] dark:text-zinc-300">
      <Loader2 className="h-4 w-4 animate-spin text-[#1D4ED8] dark:text-blue-400" aria-hidden="true" />
      <span role="status">{label}</span>
    </p>
  </main>
);
