import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, LogIn, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { staffPrimaryButtonClassName } from './StaffAuthLayout';

/**
 * Habillage commun des pages d'accès du personnel (connexion, inscription,
 * onboarding) et des écrans de la garde `StaffAccessGate`. Une seule source
 * visuelle pour éviter que les copies ne divergent.
 *
 * La composition deux panneaux des pages de connexion/inscription vit dans
 * `StaffAuthLayout.tsx` (chargée en lazy uniquement par ces pages) ; ce
 * module ne contient que le socle partagé avec la garde et l'onboarding.
 */

export const staffShellClassName =
  'flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-8 text-[#171923] dark:bg-zinc-950 dark:text-zinc-50';

export const staffPanelClassName =
  'w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5 dark:border-zinc-800 dark:bg-zinc-900';

export const staffWidePanelClassName =
  'w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5 dark:border-zinc-800 dark:bg-zinc-900';

export const staffLabelClassName =
  'mb-1.5 block text-[12px] font-black uppercase tracking-wide text-slate-600 dark:text-zinc-300';

export const StaffAuthHeader: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => (
  <header>
    <p className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.16em] text-[#C2410C] dark:text-orange-300">
      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
      Accès personnel
    </p>
    <h1 className="mt-3 text-2xl font-black tracking-tight text-[#24113D] dark:text-zinc-50">
      {title}
    </h1>
    <p className="mt-2 text-[13.5px] leading-relaxed text-[#64748B] dark:text-zinc-400">
      {description}
    </p>
  </header>
);

export const StaffAuthAlert: React.FC<{
  tone: 'error' | 'success' | 'warning';
  children: React.ReactNode;
  className?: string;
}> = ({ tone, children, className }) => {
  const classes =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex gap-2 rounded-2xl border px-3.5 py-3 text-[13px] font-medium ${classes}${className ? ' ' + className : ''}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
};

export const StaffAuthLoading: React.FC<{ label: string }> = ({ label }) => (
  <main className={staffShellClassName}>
    <p
      className={`${staffPanelClassName} flex items-center justify-center gap-2 text-center text-[13.5px] font-semibold`}
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      {label}
    </p>
  </main>
);

/** Lien de navigation interne des pages publiques (reste un vrai lien <a>). */
export const StaffAuthLink: React.FC<{
  path: string;
  onNavigate: (path: string) => void;
  className?: string;
  children: React.ReactNode;
}> = ({ path, onNavigate, className, children }) => (
  <a
    href={path}
    className={className}
    onClick={(event) => {
      event.preventDefault();
      onNavigate(path);
    }}
  >
    {children}
  </a>
);
/** Bouton CTA principal (connexion / inscription / envoie de lien) */
export const StaffAuthCTAButton: React.FC<{
  type: 'login' | 'send' | 'register';
  busy: boolean;
  onLogin: () => void;
  onSend: () => void;
  onRegister: () => void;
}> = ({ type, busy, onLogin, onSend, onRegister }) => {
  if (busy) {
    return (
      <button type="submit" className={staffPrimaryButtonClassName} disabled>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="submit"
      className={staffPrimaryButtonClassName}
      onClick={(e) => {
        e.preventDefault();
        if (type === 'login') onLogin();
        else if (type === 'send') onSend();
        else if (type === 'register') onRegister();
      }}
    >
      {type === 'login' ? (
        <>
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Se connecter
        </>
      ) : type === 'send' ? (
        <>
          <Mail className="h-4 w-4" aria-hidden="true" />
          Envoyer le lien
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Créer mon compte
        </>
      )}
    </button>
  );
};

/** Textes CTA et messages publicitaires optimisés pour la diffusion du ERP. */
export const StaffAuthCTATexts = {
  login: 'Se connecter pour accéder à votre tableau de bord',
  sendLink: 'Envoyer un lien de connexion sur votre adresse e-mail',
  register: 'Créer votre compte propriétaire PressingPro CI',
  forgotPassword: 'Entrez votre e-mail pour recevoir un lien de réinitialisation',
  successLogin: 'Connexion réussie – Démarrez votre gestion de pressing',
  successRegister: 'Votre compte est créé – Prêt à gérer vos premières commandes',
  getStarted: 'Démarrez maintenant – Configurez votre pressing en 3 étapes',
  feature1: 'Réception tickets sans ressaisie',
  feature2: 'Atelier synchronisé : chaque étape tracée et horodatée',
  feature3: 'Caisse claire : espèces, Wave, Orange Money, MTN MoMo',
  trialPrompt: 'Essayez gratuitement pendant 14 jours – Aucune carte requise',
};

/** Lien de navigation interne des pages publiques (reste un vrai lien <a>). */
