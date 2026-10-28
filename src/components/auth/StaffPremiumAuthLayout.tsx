import React from 'react';
import { Store, Shirt, WashingMachine, Wallet, Receipt, ShieldCheck } from 'lucide-react';

/**
 * Layout premium à deux panneaux pour les pages d'authentification du personnel.
 * Inspiré des codes visuels SaaS premium (Dribbble).
 *
 * Structure desktop :
 * - Panneau visuel à gauche (~52%) avec photographie/illustration pressing
 * - Panneau formulaire à droite (~48%) sur fond clair
 *
 * Mobile :
 * - Bandeau visuel compact en haut
 * - Formulaire en priorité
 */

const staffPremiumShellClassName =
  'min-h-screen bg-[#F7F8FC] text-[#171936]';

const staffPremiumVisualClassName =
  'relative hidden overflow-hidden bg-gradient-to-br from-[#171936] via-[#33258E] to-[#5145E5] p-8 md:flex md:flex-col lg:p-10';

const staffPremiumVisualOverlayClassName =
  'absolute inset-0 bg-gradient-to-t from-[#171936]/90 via-[#171936]/40 to-transparent pointer-events-none';

const staffPremiumFormPanelClassName =
  'flex flex-col justify-center p-6 sm:p-8 lg:p-12';

const staffPremiumFormContainerClassName =
  'mx-auto w-full max-w-[440px]';

const StaffPremiumBrandMark: React.FC = () => (
  <div className="flex items-center gap-3 mb-8">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#5145E5] shadow-lg shadow-[#5145E5]/20">
      <Shirt className="h-6 w-6" aria-hidden="true" />
    </div>
    <div>
      <span className="block text-[18px] font-black leading-tight text-white tracking-tight">
        PressingPro CI
      </span>
      <span className="block text-[12px] font-bold text-[#5145E5]/90 uppercase tracking-wider">
        Pressing &amp; blanchisserie — Côte d’Ivoire
      </span>
    </div>
  </div>
);

const StaffPremiumHeroTitle: React.FC = () => (
  <h1 className="mt-2 mb-4 text-[32px] font-black leading-[1.1] tracking-tight text-white">
    Votre pressing,<br />
    en toute maîtrise.
  </h1>
);

const StaffPremiumHeroDescription: React.FC = () => (
  <p className="mb-8 max-w-sm text-[15px] leading-relaxed text-[#FFFFFF]/90">
    Retrouvez vos commandes, votre équipe et vos indicateurs dans un seul
    espace de gestion.
  </p>
);

const StaffPremiumFeatures: React.FC<{ title: string; items: Array<{ icon: React.ElementType; text: string }> }> = ({ title, items }) => (
  <section className="mt-auto space-y-3">
    <h2 className="text-[13px] font-black uppercase tracking-wider text-[#5145E5]/90 mb-4">
      {title}
    </h2>
    <ul className="space-y-2.5">
      {items.map(({ icon: Icon, text }, idx) => (
        <li key={idx} className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-[#FF961F] backdrop-blur-sm">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-[13px] font-medium text-white leading-snug">
            {text}
          </span>
        </li>
      ))}
    </ul>
  </section>
);

const STAFF_PREMIUM_FEATURES = [
  {
    icon: Receipt,
    text: 'Réception, tickets et suivi sans ressaisie.',
  },
  {
    icon: WashingMachine,
    text: 'Atelier synchronisé : chaque étape tracée.',
  },
  {
    icon: Wallet,
    text: 'Caisse claire : espèces, Wave, Orange Money, MTN MoMo.',
  },
  {
    icon: ShieldCheck,
    text: 'Sécurité Supabase : sessions et rôles protégés.',
  },
];

export const StaffPremiumVisualPanel: React.FC = () => (
  <section className={staffPremiumVisualClassName} aria-hidden="true">
    <div className={staffPremiumVisualOverlayClassName} />
    <div className="relative z-10 flex h-full flex-col">
      <StaffPremiumBrandMark />
      <StaffPremiumHeroTitle />
      <StaffPremiumHeroDescription />
      <div className="my-8 hidden lg:block">
        <img
          src="/images/auth/login-visual.svg"
          alt=""
          className="w-full h-[300px] object-cover rounded-2xl opacity-90"
          loading="lazy"
          decoding="async"
        />
      </div>
      <StaffPremiumFeatures
        title="Pourquoi PressingPro CI"
        items={STAFF_PREMIUM_FEATURES}
      />
    </div>
  </section>
);

/** Bandeau de marque compact affiché sur mobile. */
export const StaffPremiumMobileBrandHeader: React.FC = () => (
  <div className="bg-gradient-to-r from-[#171936] to-[#5145E5] px-6 py-4 md:hidden">
    <StaffPremiumBrandMark />
  </div>
);

/**
 * Conteneur principal du layout premium à deux panneaux.
 * Desktop : grille deux colonnes (visuel | formulaire).
 * Mobile : formulaire seul avec bandeau marque en haut.
 */
export const StaffPremiumAuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main className={staffPremiumShellClassName}>
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <div
        className="grid w-full max-w-md overflow-hidden rounded-[2rem] border border-[#E5E7EB] bg-white shadow-2xl shadow-[#171936]/10 md:max-w-5xl md:grid-cols-[0.55fr_0.45fr] lg:max-w-6xl lg:grid-cols-[0.52fr_0.48fr]"
      >
        <StaffPremiumMobileBrandHeader />
        <StaffPremiumVisualPanel />
        <section className={staffPremiumFormPanelClassName}>
          <div className={staffPremiumFormContainerClassName}>{children}</div>
        </section>
      </div>
    </div>
  </main>
);