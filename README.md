# PressingPro CI — Pressing & Blanchisserie

ERP de gestion pour pressing et blanchisserie à Abidjan (Côte d'Ivoire) :
tableau de bord, réception comptoir (POS), suivi d'atelier en Kanban,
fichier clients & fidélité, caisse et clôture journalière Z.

## Fonctionnalités

- **Tableau de bord** — chiffre d'affaires du jour ventilé Espèces / Wave /
  MTN MoMo / Orange Money, graphique 7 jours, alertes (retards, urgences),
  commandes récentes.
- **Réception comptoir (POS)** — deux modes : parcours guidé en 3 étapes
  (Client → Articles → Récapitulatif & paiement) ou vue classique tout-en-un.
  Deux univers : **Pressing** à la pièce et **Blanchisserie** à la pièce ou
  **au kilo**. Supplément express +50 %, remise fidélité, acompte, aperçu du
  ticket et du SMS client.
- **Production & suivi** — Kanban atelier (Reçu → Lavage → Repassage → Prêt),
  remise au client avec encaissement du solde, clôture de caisse Z.
- **Commandes & Clients** — historique filtrable, fichier clients avec
  fidélité (%), statut VIP et solde dû.
- **Personnel & présences** — registre des employés (postes, téléphone,
  salaire facultatif), activation/désactivation sans suppression, saisie
  des présences (présent, retard, absent, congé) par employé et par jour.
- **Stocks & inventaire** — catalogue produits avec seuils d'alerte,
  mouvements d'entrée/sortie/ajustement entièrement tracés (la quantité
  ne change que par un mouvement), alertes de rupture et de stock faible.
- **Dépenses** — registre des charges par catégorie (produits, transport,
  énergie, maintenance…), fournisseurs, modes de paiement, annulation
  motivée (exclue des totaux), export CSV.
- **Rapports** — activité, finance (ventes, soldes dus et dépenses
  distingués, sans encaissements inventés), personnel et stock, par
  période (jour/semaine/mois/personnalisée), avec impression et exports CSV.
- **Raccourcis clavier** façon logiciel de caisse : `F1` tableau de bord,
  `F2` réception, `F3` atelier, `F4` clôture Z, `Alt+7/8/9/0` Personnel /
  Stocks / Dépenses / Rapports, `F9` / `?` aide, `Échap` ferme les fenêtres.

## Stack technique

React 19 · TypeScript · Vite 8 · Tailwind CSS v4 · lucide-react ·
canvas-confetti. Application 100 % front-end (SPA), sans backend.

## Démarrage

Prérequis : **Node.js 20 ou plus récent** (avec npm).

```bash
npm install        # installer les dépendances
npm run dev        # serveur de développement → http://localhost:3000
npm run build      # build de production dans dist/
npm run preview    # prévisualiser le build de production
npm run lint       # vérification TypeScript (tsc --noEmit)
```

Aucune variable d'environnement n'est requise (voir `.env.example`).

## Structure du projet

```
src/
├── App.tsx                  layout + navigation entre écrans
├── context/AppContext.tsx   état global + logique métier
├── types/index.ts           types du domaine (commandes, clients…)
├── data/demoData.ts         catalogue, clients et commandes de démonstration
├── lib/
│   ├── dates.ts             dates dynamiques + règles de délais de retrait
│   ├── pricing.ts           calculs tarifaires uniques (totaux, express, remises)
│   └── utils.ts             helper cn() (classes Tailwind)
└── components/              écrans par domaine (dashboard, pos, workshop…)
```

**Règles métier centralisées** (ne pas les recopier dans les composants) :

- Montants : `calculateOrderTotals()` dans `src/lib/pricing.ts`
  (sous-total, supplément express +50 %, remise fidélité, acompte, reste).
- Délais de retrait : `getPromisedDate()` dans `src/lib/dates.ts`
  (express = lendemain 12h, standard = J+2 17h, différé = prochain samedi 10h).
- Numérotation des tickets : compteur séquentiel persisté
  (`pressingpro_next_ticket_number`), initialisé au plus grand ticket
  existant + 1.

## Données

Sans backend, l'application stocke tout dans le **localStorage** du
navigateur, sous les clés `pressingpro_orders`, `pressingpro_customers`,
`pressingpro_cash_register` et `pressingpro_next_ticket_number`.
Au premier lancement, des données de démonstration datées du jour courant
sont chargées (dates relatives, voir `src/data/demoData.ts`).

> **Réinitialiser la démo** : vider les clés `pressingpro_*` du
> localStorage (console du navigateur :
> `Object.keys(localStorage).filter(k => k.startsWith('pressingpro_')).forEach(k => localStorage.removeItem(k))`),
> puis recharger la page.

## Application installable (PWA)

L'application est une PWA installable, implémentée sans dépendance
(service worker manuel plutôt que `vite-plugin-pwa`, pour garder le build
simple et le comportement lisible) :

- **Manifeste** `public/manifest.webmanifest` (nom, `display: standalone`,
  couleurs de thème) et **icônes** `public/icons/` (192, 512, maskable 512,
  apple-touch-icon 180), liées depuis `index.html`.
- **Service worker** `public/sw.js` : coquille applicative précachée,
  navigations « réseau d'abord » avec repli hors ligne, assets hachés du
  build et polices « cache d'abord ». Les modules du serveur de dev Vite
  ne sont jamais interceptés.
- **Enregistrement et installation** via `src/lib/pwa.ts` (appelé dans
  `main.tsx`) : capture de `beforeinstallprompt`, bouton « Installer
  l'application » dans Paramètres, et toast « Nouvelle version disponible »
  quand une mise à jour est téléchargée (aucun rechargement forcé).
- **Hors ligne** : après une première visite en ligne, l'application se
  relance sans réseau ; les données restent celles du `localStorage`
  (inchangées, toujours limitées à ce navigateur/appareil).
- **Mises à jour** : si le service worker lui-même évolue, incrémenter
  `VERSION` dans `public/sw.js` ; les anciens caches sont purgés à
  l'activation.
- **Pré-requis** : HTTPS en production (les aperçus et Vercel le
  fournissent) ; sur iPhone/iPad, installation manuelle via Partager →
  « Sur l'écran d'accueil ».

## Limites actuelles

- **Mono-poste** : les données vivent dans un seul navigateur — pas de
  synchronisation entre le comptoir et l'atelier, pas d'authentification.
- **SMS et impression simulés** (aucun envoi réel, aucun pilote d'imprimante).
- Paramètres de la boutique non persistés, statistiques 7 jours de démo.

Prochaine étape logique (P1) : brancher un backend (ex. Supabase) avec
comptes employés et temps réel multi-postes, puis les vrais envois SMS.
