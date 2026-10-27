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
- **Raccourcis clavier** façon logiciel de caisse : `F1` tableau de bord,
  `F2` réception, `F3` atelier, `F4` clôture Z, `F9` / `?` aide, `Échap`
  ferme les fenêtres.

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

## Limites actuelles

- **Mono-poste** : les données vivent dans un seul navigateur — pas de
  synchronisation entre le comptoir et l'atelier, pas d'authentification.
- **SMS et impression simulés** (aucun envoi réel, aucun pilote d'imprimante).
- Paramètres de la boutique non persistés, statistiques 7 jours de démo.

Prochaine étape logique (P1) : brancher un backend (ex. Supabase) avec
comptes employés et temps réel multi-postes, puis les vrais envois SMS.
