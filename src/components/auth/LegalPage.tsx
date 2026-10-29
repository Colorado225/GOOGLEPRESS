import React, { useEffect } from 'react';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import {
  PRIVACY_POLICY_PATH,
  STAFF_REGISTER_PATH,
  TERMS_OF_USE_PATH,
  type LegalRoute,
} from '../../lib/staffAuth';
import { StaffAuthLink } from './StaffAuthCommon';

interface LegalPageProps {
  kind: LegalRoute;
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
}

interface LegalSection {
  title: string;
  paragraphs: string[];
}

const TERMS_SECTIONS: LegalSection[] = [
  {
    title: '1. Objet du service',
    paragraphs: [
      'PressingPro CI est un logiciel de gestion destiné aux pressings et blanchisseries professionnels en Côte d’Ivoire : réception des dépôts, suivi d’atelier, caisse, clients et rapports d’activité.',
      'L’accès au service se fait par un compte personnel. Le compte créé depuis la page d’inscription est un compte de propriétaire : il sert à ouvrir l’espace de son propre établissement.',
    ],
  },
  {
    title: '2. Compte, rôles et responsabilités',
    paragraphs: [
      'Chaque utilisateur est responsable de la confidentialité de ses identifiants et des actions réalisées avec son compte. Choisissez un mot de passe unique et ne le partagez pas.',
      'Le propriétaire d’un établissement attribue les accès de son équipe (responsable, caisse/réception, atelier, coursier). Un compte ne donne jamais accès aux données d’un autre établissement : ce cloisonnement est appliqué côté serveur, pas seulement dans l’interface.',
    ],
  },
  {
    title: '3. Données de l’établissement',
    paragraphs: [
      'Les données saisies dans le service (commandes, clients de l’agence, paiements, stocks, dépenses) appartiennent à l’établissement qui les a créées. Elles servent uniquement à faire fonctionner son espace de gestion.',
      'Il appartient à chaque établissement de vérifier l’exactitude des informations qu’il enregistre, notamment les tarifs appliqués et les coordonnées de ses clients.',
    ],
  },
  {
    title: '4. Usage acceptable',
    paragraphs: [
      'Le service doit être utilisé pour l’activité légitime de l’établissement. Sont notamment interdits : l’accès aux données d’un tiers, le contournement des contrôles d’accès, et toute utilisation contraire aux lois en vigueur en Côte d’Ivoire.',
      'En cas d’abus avéré, l’accès au compte concerné peut être suspendu pour protéger les autres utilisateurs.',
    ],
  },
  {
    title: '5. Disponibilité et limites',
    paragraphs: [
      'Le service est fourni avec un soin raisonnable, sans garantie d’absence totale d’interruption. Certaines fonctions (par exemple l’impression ou les notifications externes) peuvent dépendre de l’équipement et des prestataires de l’établissement.',
      'Les montants sont gérés en francs CFA (XOF). Les paiements par mobile money restent opérés par les fournisseurs concernés (Wave, Orange Money, MTN MoMo) selon leurs propres conditions.',
    ],
  },
  {
    title: '6. Évolution des présentes conditions',
    paragraphs: [
      'Ces conditions peuvent évoluer pour refléter le service réellement fourni. La version publiée sur cette page est celle qui s’applique ; les changements importants seront signalés dans l’application.',
      'Pour toute question, contactez l’exploitant du service via les coordonnées publiées dans l’application.',
    ],
  },
];

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: '1. Données que nous traitons',
    paragraphs: [
      'Compte utilisateur : nom complet, adresse e-mail, mot de passe (stocké de façon chiffrée par le service d’authentification, jamais en clair) et, si vous le renseignez, votre numéro de téléphone.',
      'Données d’exploitation : les informations que votre établissement saisit dans son espace — commandes, fiches clients de l’agence, paiements, stocks, dépenses et journaux d’activité associés.',
      'Données techniques : informations nécessaires au fonctionnement et à la sécurité du service (session de connexion, préférences d’affichage, journaux d’erreurs).',
    ],
  },
  {
    title: '2. Pourquoi ces données sont traitées',
    paragraphs: [
      'Uniquement pour faire fonctionner le service : vous authentifier, afficher vos données à votre équipe selon ses rôles, sécuriser les accès et assurer la traçabilité des opérations sensibles (création de commande, paiements, remboursements).',
      'Vos données ne sont ni vendues, ni utilisées à des fins publicitaires.',
    ],
  },
  {
    title: '3. Cloisonnement entre établissements',
    paragraphs: [
      'Chaque établissement dispose d’un espace séparé. Les contrôles d’accès sont appliqués côté serveur pour chaque lecture et chaque écriture : un compte ne peut pas consulter les commandes, les clients ou la caisse d’un autre établissement.',
      'L’espace client suit la même règle : une cliente ne voit que les commandes des fiches que son pressing a reliées à son compte après vérification.',
    ],
  },
  {
    title: '4. Hébergement et sécurité',
    paragraphs: [
      'Les données du service sont hébergées chez notre prestataire technique d’infrastructure et d’authentification (Supabase). Les échanges entre votre navigateur et le service sont chiffrés (HTTPS).',
      'L’accès aux données est limité par rôle, et les actions sensibles sont journalisées. Malgré ces mesures, aucun système n’est infaillible : protégez vos identifiants et signalez tout accès suspect à votre responsable.',
    ],
  },
  {
    title: '5. Cookies et stockage local',
    paragraphs: [
      'Le service n’utilise pas de cookies publicitaires ni de traceurs tiers de profilage.',
      'Le navigateur conserve localement des éléments techniques (session de connexion, paramètres d’affichage de l’appareil). Sur un poste partagé, pensez à vous déconnecter en fin de journée.',
    ],
  },
  {
    title: '6. Vos droits',
    paragraphs: [
      'Vous pouvez demander l’accès, la rectification ou la suppression de vos données personnelles. Pour les données d’un compte du personnel, adressez-vous au propriétaire de votre établissement ; pour un compte client, adressez-vous à votre pressing.',
      'La suppression d’un compte peut être limitée par les obligations de conservation comptables qui s’appliquent aux écritures de paiement déjà enregistrées.',
    ],
  },
];

const LEGAL_CONTENT: Record<
  LegalRoute,
  { title: string; intro: string; sections: LegalSection[] }
> = {
  terms: {
    title: 'Conditions d’utilisation',
    intro:
      'Les présentes conditions encadrent l’utilisation de PressingPro CI par les professionnels du pressing et de la blanchisserie.',
    sections: TERMS_SECTIONS,
  },
  privacy: {
    title: 'Politique de confidentialité',
    intro:
      'Cette politique explique quelles données PressingPro CI traite, pour quelles raisons, et comment elles sont protégées.',
    sections: PRIVACY_SECTIONS,
  },
};

export const LegalPage: React.FC<LegalPageProps> = ({ kind, onNavigate }) => {
  const content = LEGAL_CONTENT[kind];
  const otherPath = kind === 'terms' ? PRIVACY_POLICY_PATH : TERMS_OF_USE_PATH;
  const otherLabel =
    kind === 'terms' ? 'Politique de confidentialité' : 'Conditions d’utilisation';

  useEffect(() => {
    document.title = `${content.title} — PressingPro CI`;
  }, [content.title]);

  return (
    <main className="min-h-screen bg-[#F7F5F2] px-4 py-8 text-[#171923] dark:bg-zinc-950 dark:text-white">
      <div className="mx-auto w-full max-w-3xl">
        <StaffAuthLink
          path={STAFF_REGISTER_PATH}
          onNavigate={onNavigate}
          className="inline-flex items-center gap-2 text-[13px] font-bold text-[#1D4ED8] underline-offset-2 transition hover:underline focus:outline-none focus:ring-4 focus:ring-[#1D4ED8]/20 dark:text-blue-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour à l’inscription
        </StaffAuthLink>

        <article className="mt-4 rounded-3xl border border-[#E4DFD6] bg-white p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-[#0B101B] sm:p-10">
          <header>
            <p className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.16em] text-[#1D4ED8] dark:text-blue-300">
              {kind === 'terms' ? (
                <FileText className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              )}
              PressingPro CI
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#111827] dark:text-white">
              {content.title}
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[#5C6472] dark:text-zinc-400">
              {content.intro}
            </p>
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium leading-relaxed text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Document provisoire : PressingPro CI est en cours de déploiement.
              Ce texte décrit le fonctionnement réel du service à ce jour et
              sera finalisé par l’exploitant, avec un conseil juridique, avant
              l’ouverture commerciale complète.
            </p>
          </header>

          {content.sections.map((section) => (
            <section key={section.title} className="mt-8">
              <h2 className="text-[16px] font-black text-[#111827] dark:text-white">
                {section.title}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-2.5 text-[14px] leading-relaxed text-[#374151] dark:text-zinc-300"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}

          <footer className="mt-10 border-t border-[#E4DFD6] pt-5 dark:border-white/10">
            <p className="text-[13px] text-[#5C6472] dark:text-zinc-400">
              Voir aussi :{' '}
              <StaffAuthLink
                path={otherPath}
                onNavigate={onNavigate}
                className="font-bold text-[#1D4ED8] underline underline-offset-2 transition hover:text-[#1E40AF] focus:outline-none focus:ring-4 focus:ring-[#1D4ED8]/20 dark:text-blue-300"
              >
                {otherLabel}
              </StaffAuthLink>
            </p>
          </footer>
        </article>
      </div>
    </main>
  );
};
