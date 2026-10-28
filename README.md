# PressingPro CI — Pressing & Blanchisserie

ERP de gestion pour pressing et blanchisserie à Abidjan (Côte d'Ivoire) :
tableau de bord, réception comptoir (POS), suivi d'atelier en Kanban,
ramassage et livraison à domicile, fichier clients & fidélité, caisse et
clôture journalière Z.

## Fonctionnalités

- **Tableau de bord** — chiffre d'affaires du jour ventilé Espèces / Wave /
  MTN MoMo / Orange Money, graphique 7 jours, alertes (retards, urgences),
  commandes récentes.
- **Réception comptoir (POS)** — deux modes : parcours guidé en 3 étapes
  (Client → Articles → Récapitulatif & paiement) ou vue classique tout-en-un.
  Deux univers : **Pressing** à la pièce et **Blanchisserie** à la pièce ou
  **au kilo**. Supplément express +50 %, remise fidélité, acompte, aperçu du
  ticket et message client à copier manuellement. Un ramassage déjà collecté peut y être compté puis
  converti en commande ; la restitution se choisit entre retrait au comptoir
  et livraison à domicile (adresse, date et créneau de tournée).
- **Production & suivi** — Kanban atelier (Reçu → Lavage → Repassage → Prêt),
  onglet **Rangement** pour retrouver les commandes terminées par ticket,
  client ou code de casier (plan A–E proposé au départ, puis entièrement
  configurable par le propriétaire : codes libres, duplication, séries
  numérotées type B-01 → B-12, capacités et règles de travail), onglet **Tournées** pour les
  ramassages/livraisons (programmation, coursier, départ,
  échec/reprogrammation, encaissement du solde à la livraison), remise au
  comptoir et clôture de caisse Z. Un onglet séparé **Suivi distant** lit les
  commandes déjà présentes dans Supabase, s’abonne à Realtime et fait passer
  leurs étapes par une RPC qui journalise l’historique ; il ne remplace pas
  encore le Kanban local.
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
canvas-confetti. SPA dont les écrans métier historiques restent pour
l’instant locaux ; la fondation Supabase multi-tenant porte déjà un premier
lot de suivi distant (lecture, Realtime et transition RPC), sans bascule de
la création des commandes au POS.

## Démarrage

Prérequis : **Node.js 20 ou plus récent** (avec npm).

```bash
npm install        # installer les dépendances
npm run dev        # serveur de développement → http://localhost:3000
npm run build      # build de production dans dist/
npm run preview    # prévisualiser le build de production
npm run lint       # vérification TypeScript (tsc --noEmit)
npm run test:unit  # tests unitaires des cœurs métier (Vitest)
npm run test:coverage # unitaires + couverture/seuils des cœurs ciblés
npm run test:phase0 # tests d’isolation Supabase Phase 0 (PGlite)
npm run test:e2e   # smoke tests navigateur (Playwright)
```

Aucune variable d'environnement n'est requise (voir `.env.example`).

## Qualité et CI

- **Tests unitaires** : Vitest couvre les cœurs `pricing`, `dates`,
  `logistics`, `storage`, `backup`, `localPersistence` et `orderTracking` ;
  `test:coverage` applique des seuils anti-régression sur ce périmètre précis.
- **Backend** : `test:phase0` vérifie l’isolation multi-tenant, la RLS et la
  RPC de transition de statut sous PGlite.
- **Navigateur** : `test:e2e` lance les smoke tests Playwright des parcours
  critiques.
- **CI GitHub Actions** : `.github/workflows/ci.yml` exécute typage,
  couverture des cœurs, tests Phase 0, build et smoke tests. L’obligation de
  ces checks avant merge reste un réglage de protection de branche GitHub.

## Structure du projet

```
src/
├── App.tsx                  layout + navigation entre écrans
├── context/AppContext.tsx   état global + logique métier
├── types/index.ts           types du domaine (commandes, clients…)
├── data/demoData.ts         catalogue, clients et commandes de démonstration
├── lib/
│   ├── dates.ts             dates dynamiques + règles de délais de retrait
│   ├── logistics.ts         créneaux, statuts et règles des tournées domicile
│   ├── storage.ts           zones, occupation et recherche des casiers de commandes prêtes
│   ├── pricing.ts           calculs tarifaires uniques (totaux, express, frais, remises)
│   ├── localPersistence.ts  lecture/écriture JSON locale et identifiants locaux
│   ├── backup.ts            export/import local chiffré et allowlist des clés
│   ├── orderTracking.ts     étapes, transitions et libellés du suivi synchronisé
│   ├── supabaseOrders.ts    lecture, RPC et abonnement Realtime des commandes
│   ├── database.types.ts    types générés depuis les migrations Supabase
│   └── utils.ts             helper cn() (classes Tailwind)
└── components/              écrans par domaine (dashboard, pos, workshop…)
```

**Règles métier centralisées** (ne pas les recopier dans les composants) :

- Montants : `calculateOrderTotals()` dans `src/lib/pricing.ts`
  (sous-total, supplément express +50 %, frais de ramassage/livraison,
  remise fidélité, acompte, reste).
- Délais de retrait : `getPromisedDate()` dans `src/lib/dates.ts`
  (express = lendemain 12h, standard = J+2 17h, différé = prochain samedi 10h).
- Tournées : le ramassage est d'abord réservé et collecté, puis seulement
  converti en commande après comptage à la boutique. La production reste
  distincte de la course : une livraison ne part que si la commande est
  prête, et sa confirmation solde la commande et encaisse le reste une
  seule fois. Les frais sont figés sur la tournée/commande au moment de la
  promesse ; les forfaits des nouvelles courses se règlent dans
  Paramètres → « Ramassage & livraison » (proposition initiale : 1 000 FCFA
  par course, 0 = offert).
- Rangement des prêts : le passage en « Prêt » demande le casier réel et le
  nombre de paquets/housses. Par défaut, la commande peut explicitement
  rester dans la file « À ranger » et la capacité n’est qu’une alerte ; dans
  **Paramètres → Rangement atelier**, le propriétaire peut au contraire
  rendre le casier obligatoire avant « Prête », rendre la capacité
  strictement bloquante, activer/couper les suggestions automatiques et
  fixer la capacité proposée pour les nouveaux emplacements. Le plan
  physique se gère dans Atelier → Rangement → Emplacements : création libre,
  duplication d’un casier type, série numérotée en bloc (50 maximum),
  modification/désactivation, et suppression réservée aux emplacements
  jamais cités par une commande. Tous les paquets d'un ticket doivent
  normalement rester ensemble. Un retour en production libère
  l'emplacement ; une commande partie en livraison ne compte plus dans
  l'occupation des rayons. Les anciens repères en texte libre restent
  lisibles et peuvent être convertis vers un emplacement configuré.
- Numérotation des tickets : compteur séquentiel persisté
  (`pressingpro_next_ticket_number`), initialisé au plus grand ticket
  existant + 1.

## Données

Tant que la bascule métier complète n’est pas livrée, les écrans historiques
stockent leurs données dans le **localStorage** du navigateur, sous des clés
`pressingpro_*` : commandes, clients, caisse, tournées, personnel, stocks,
dépenses, emplacements, paramètres, compteur de tickets et préférences de
l’appareil. La liste exacte reprise par la sauvegarde fait foi dans
`src/lib/backup.ts` (`BACKUP_KEYS`). L’exception est Atelier → Suivi distant,
qui ne lit et ne modifie que des commandes déjà présentes dans Supabase.
Au premier lancement, des données de démonstration datées du jour courant
sont chargées (dates relatives, voir `src/data/demoData.ts`). Sur un
navigateur contenant déjà des commandes, seuls deux exemples de ramassage
non convertis sont ajoutés au premier affichage des Tournées ; aucun total
de commande existante n'est modifié.

**Sauvegarde avant migration ou changement d’appareil** : Paramètres →
Sauvegarde permet d’exporter ces données dans un JSON chiffré AES-GCM protégé
par une phrase secrète, puis d’analyser et restaurer ce fichier dans un autre
navigateur. L’export reste manuel : conservez le fichier hors de l’appareil et
ne perdez pas la phrase secrète, irrécupérable.

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

## Thème clair / sombre

L'interface existe en thème clair et en thème sombre : bouton soleil/lune
dans l'en-tête, raccourci **Alt+T**, ou Paramètres → carte « Apparence ».
Au premier lancement, la préférence du système (`prefers-color-scheme`) est
suivie ; le choix est ensuite mémorisé dans ce navigateur
(`pressingpro_theme`) et appliqué sans clignotement au chargement.
L'impression (ticket thermique, rapports) s'effectue **toujours en clair**,
comme sur papier. La barre latérale, les notifications (toasts) et la carte
de clôture restent sombres par design dans les deux thèmes ; l'aperçu du
ticket reste blanc, comme le papier.

## Limites actuelles

- **Exploitation encore mono-poste** : les données métier historiques vivent
  dans un seul navigateur. Le socle de suivi distant est installé et testé
  localement, mais la synchronisation réelle comptoir ↔ atelier ne sera
  prouvée qu’après création du premier tenant, bascule de la création des
  commandes et recette sur deux appareils.
- **Aucune authentification applicative** : toute personne ayant accès à ce
  navigateur peut modifier données et paramètres. La sonde Supabase Auth ne
  verrouille pas encore l’application.
- **Aucune notification externe envoyée** : les commandes prêtes sont
  marquées localement et un message peut être copié, mais aucun fournisseur
  SMS/WhatsApp ni accusé de livraison n’est branché.
- **Impression via le navigateur uniquement** : `window.print()` peut utiliser
  une imprimante installée dans le système, mais il n’y a ni pilote direct
  thermique/ESC-POS, ni impression silencieuse, ni état du périphérique.
- **Tournées sans GPS ni réservation client en ligne** : adresse, téléphone,
  créneau, coursier et statuts sont suivis manuellement, sans coordonnées ni
  optimisation géographique.
- **Rangement sans scan d'étiquettes ni rôle verrouillé** : recherche par
  ticket, client ou code de casier ; les codes doivent être reportés
  manuellement sur les étiquettes physiques du local.

Le détail, la gravité résiduelle et les critères de clôture sont suivis dans
[`docs/RISQUES-ET-FAIBLESSES.md`](docs/RISQUES-ET-FAIBLESSES.md). Prochaine
étape structurante : créer le premier tenant Supabase réel, migrer les
domaines un par un et imposer les rôles côté serveur.
