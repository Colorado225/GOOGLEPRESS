# GOOGLEPRESS / PressingPro CI — audit final de l’intervention du 28 octobre 2026

## Verdict

Le projet n’a pas été réécrit. Cette intervention ferme plusieurs failles
mesurables du code et prépare le cœur financier serveur, mais **PressingPro
n’est toujours pas prêt pour une exploitation commerciale multi-poste**.

La raison principale n’est plus l’absence de schéma ou de RPC : ce sont les
trois écarts restants entre le code livré et l’exploitation réelle :

1. la migration locale `20261028150000_order_creation_payments.sql` n’a pas
   été appliquée à Pressing_Pro ;
2. Pressing_Pro ne contient toujours aucun tenant, compte, membership,
   cliente ou commande permettant une recette réelle ;
3. le POS et la majorité des écrans ERP continuent d’écrire dans le
   navigateur au lieu d’utiliser les nouvelles RPC/repositories distants.

Ces limites sont volontaires à ce stade : appliquer la migration ou basculer
le POS sans tenant réel, sauvegarde et recette contrôlée aurait créé un faux
sentiment de production.

## Périmètre réellement traité

### 1. Tarification et invariants monétaires locaux

- `src/lib/pricing.ts` borne désormais la remise entre 0 et 100 %.
- Les prix, quantités, frais et acomptes non finis ou négatifs sont assainis
  avant les calculs.
- Les montants restent des FCFA entiers ; un total et un acompte ne peuvent
  plus devenir négatifs dans le calculateur central.
- Les tests portent `pricing.ts` à 100 % sur les indicateurs publiés par V8.

### 2. Persistance locale et identifiants temporaires

- Les accès commandes, clients, caisse, compteur de tickets, tournées et
  couleurs personnalisées passent par `src/lib/localPersistence.ts`.
- `createLocalId` utilise Web Crypto lorsqu’il est disponible. Le repli sans
  Web Crypto combine l’horodatage et un compteur monotone de session ; il ne
  s’agit toujours pas d’un identifiant serveur ni d’une preuve d’identité.
- Les derniers usages applicatifs de `Math.random` pour fabriquer des IDs ou
  un suffixe de canal Realtime ont été supprimés.

### 3. Garde d’accès du personnel

`StaffAccessGate` protège maintenant le shell ERP :

- en build de production avec Supabase configuré, l’ERP exige une session et
  au moins un membership actif avec un rôle personnel connu ;
- un compte client sans membership reste devant un écran de refus ;
- le mot de passe peut être réinitialisé puis remplacé depuis le lien
  Supabase ;
- il n’y a ni inscription libre du personnel ni mot de passe par défaut ;
- un build de production sans Supabase affiche une erreur de configuration
  au lieu d’ouvrir implicitement la démonstration ;
- la démonstration reste possible en développement ou avec
  `VITE_ALLOW_LOCAL_DEMO=true`, explicitement documentée comme non adaptée
  aux données réelles.

Cette garde ne remplace pas la RLS : elle empêche l’ouverture de l’interface,
tandis que PostgreSQL reste responsable de chaque autorisation métier.

### 4. Commande atomique côté serveur — implémentée localement

La migration `supabase/migrations/20261028150000_order_creation_payments.sql`
ajoute `public.create_order(...)` :

- rôles autorisés : propriétaire, responsable et caisse/réception ;
- navigateur limité aux références catalogue et quantités ;
- prix relus dans le catalogue actif de l’agence ;
- incohérence entre UUID catalogue et clé historique rejetée ;
- remise fidélité ou explicite contrôlée entre 0 et 100 % ;
- supplément express, frais de ramassage/livraison et total recalculés ;
- ticket attribué par le mécanisme transactionnel existant ;
- clé d’idempotence unique par agence, verrou consultatif et rejet d’une clé
  réutilisée pour un autre contenu, y compris notes et champs logistiques ;
- adresses/dates/créneaux obligatoires pour le ramassage et la livraison à
  domicile, et rejet des champs incompatibles avec le comptoir ;
- journal d’événements, audit et agrégats cliente mis à jour dans la même
  transaction ;
- insertion directe dans `orders` révoquée pour `authenticated`.

Le wrapper typé `createRemoteOrder` existe dans `src/lib/supabaseOrders.ts`,
mais le POS ne l’appelle pas encore.

### 5. Journal de paiements — implémenté localement

La même migration crée `public.payments`, journal append-only pour l’API
authentifiée :

- écritures `payment`, `refund` et `reversal`, statuts explicites ;
- montants XOF strictement positifs ;
- espèces, Wave, Orange Money, MTN MoMo, virement, carte et autre moyen
  distingués par `method` + `provider` ;
- référence externe obligatoire pour confirmer manuellement un paiement ou
  un remboursement non espèces ;
- idempotence par agence, refus du surpaiement et du remboursement excessif ;
- remboursement réservé au propriétaire/responsable et réalisé par
  contre-écriture ;
- `orders.deposit_paid_xof` et les agrégats cliente recalculés depuis les
  écritures confirmées ;
- événements visibles par la cliente et audit du personnel ;
- totaux de caisse par fournisseur via `get_payment_totals` ;
- métadonnées navigateur limitées à une liste blanche scalaire ;
- écritures directes `payments` et modifications directes de l’acompte
  révoquées pour `authenticated`.

Les wrappers typés vivent dans `src/lib/supabasePayments.ts`. Aucune
intégration Wave/Orange/MTN en ligne n’est prétendue : les RPC actuelles
enregistrent une confirmation manuelle au comptoir. Un paiement en ligne ne
devra devenir `confirmed` qu’après webhook signé ou vérification serveur du
fournisseur.

### 6. TypeScript, en-têtes et surface publique

- `strict: true` est activé et `tsc --noEmit` passe.
- `vercel.json` ajoute CSP, `nosniff`, politique de référent,
  `Permissions-Policy`, anti-cadrage et HSTS tout en conservant les
  réécritures client.
- La CSP conserve volontairement `unsafe-inline` pour les scripts/styles
  actuels ; ce compromis doit être réduit ultérieurement avec un nonce ou la
  suppression du script de thème inline.
- Les trois prototypes HTML publics non référencés sous
  `public/assets/aistudio/` sont supprimés.

### 7. Découpage du bundle

Les dix écrans ERP et le portail client sont chargés avec `React.lazy` /
`Suspense`. Le JS d’entrée passe de 1 055,80 kB avant ce découpage, dans le
même arbre de travail, à 375,27 kB minifiés (114,59 kB gzip). Les écrans
deviennent des chunks séparés ; le plus lourd est l’atelier à 155,60 kB. Ces
chiffres mesurent les fichiers produits, pas un temps de chargement réel sur
le réseau d’une boutique.

## Architecture après intervention

```text
Navigateur du personnel
  ├─ StaffAccessGate ─ session Supabase + membership actif
  ├─ ERP historique ─── AppContext + localStorage (encore majoritaire)
  ├─ Suivi distant ──── supabaseOrders + transition_order_status
  └─ Nouveaux wrappers ─ createRemoteOrder / supabasePayments (non branchés POS)

Portail cliente
  └─ Supabase Auth + RLS + commandes liées vérifiées

Supabase / PostgreSQL
  ├─ RLS forcée et helpers privés par organisation/agence
  ├─ transition_order_status (déjà hébergée)
  └─ create_order + payments (migration locale non appliquée)
```

Il subsiste donc deux sources de vérité selon l’écran. Tant que le POS n’est
pas basculé, les chiffres de caisse de l’ERP historique ne doivent pas être
présentés comme issus du journal `payments`.

## État hébergé constaté après les travaux

Le 28 octobre 2026, les contrôles en lecture seule sur Pressing_Pro
(`phjstsydxvggtduohfrl`) donnent :

- services `ACTIVE_HEALTHY` ;
- sept migrations hébergées, la dernière étant
  `20261028124739_customer_registration_profile` ;
- 0 utilisateur Auth, organisation, agence, membership, cliente et commande ;
- aucune table `payments` hébergée ;
- aucune des quatre fonctions du lot commandes/paiements hébergée.

La base locale PGlite contient au contraire 38 tables publiques protégées et
les cinq fonctions publiques attendues.

## Risques résiduels par gravité

### Critique

1. **Exploitation réelle encore locale.** Le POS peut toujours créer une
   commande et un encaissement uniquement dans le navigateur du poste.
2. **Données de démonstration après authentification.** La garde empêche un
   visiteur de charger l’ERP en production configurée, mais un membre du
   personnel authentifié monte encore `AppContext`, dont certains replis
   utilisent les données fictives si le navigateur est vide.

### Élevée

1. **Aucun tenant réel.** Impossible de prouver les rôles, les jetons HTTP,
   Realtime et la séparation des données en conditions de boutique.
2. **Migration financière non déployée.** Les protections SQL sont testées en
   PGlite, pas encore sur PostgreSQL hébergé ni avec PostgREST réel.
3. **Rôles d’écran incomplets.** La garde distingue membre/non-membre ;
   l’ERP local ne masque pas encore chaque écran selon propriétaire,
   responsable, caisse, atelier ou coursier.
4. **Paiements en ligne absents.** Aucun webhook signé, rapprochement
   fournisseur ou reçu serveur n’existe encore.

### Moyenne

1. **CSP encore permissive pour l’inline.** Les en-têtes existent dans
   `vercel.json`, mais leur présence sur le domaine déployé n’a pas été
   mesurée pendant cette intervention.
2. **56 clés étrangères sans index commençant exactement par leurs colonnes**
   ont été repérées dans le catalogue hébergé. Plusieurs requêtes disposent
   déjà d’un index métier par agence/cliente/commande ; ajouter 56 index
   aveuglément sur une base vide n’aurait pas constitué une preuve de
   performance. Ce point doit être priorisé avec les statistiques réelles
   avant montée en charge.
3. **Aucune politique hébergée n’encapsule `auth.uid()` dans un sous-select**
   parmi les 27 politiques qui le mentionnent. C’est un axe d’optimisation à
   expérimenter avec `EXPLAIN` sur données représentatives, pas une faille
   d’isolation démontrée.
4. **Notifications externes, impression directe et GPS** restent absents,
   comme déjà documenté dans le registre des risques.

## Critères d’acceptation

| Critère | Statut | Preuve / limite |
|---|---|---|
| Audit initial fondé sur le code et les commandes réelles | RÉUSSI | `docs/AUDIT-INITIAL.md`, baseline Node/npm et résultats reproduits |
| Mode strict TypeScript sans erreur | RÉUSSI | `tsconfig.json` + `npm run lint` |
| Remise et totaux locaux incapables de produire un négatif | RÉUSSI | 6 tests `pricing`, couverture 100 % du module |
| Identifiants locaux sans `Math.random` | RÉUSSI | grep du code applicatif et tests `localPersistence` |
| Build de production configuré fermé sans session/membership | RÉUSSI | `StaffAccessGate`, tests unitaires de `staffAccess`, compilation |
| Parcours Auth réel d’un membre du personnel | NON VÉRIFIÉ | aucun tenant/utilisateur hébergé à tester |
| Toutes les tables locales du nouveau schéma sous RLS forcée | RÉUSSI | PGlite, 38 tables, suite 50/50 |
| Même garantie après application du Lot 2 à Pressing_Pro | NON VÉRIFIÉ | migration non appliquée |
| Prix navigateur ignorés par `create_order` | RÉUSSI | test PGlite : prix envoyé 1, catalogue 500, total recalculé 950 |
| Création distante idempotente et ticket serveur | RÉUSSI | test PGlite, même ID, ticket `#TK-2` dans le scénario |
| POS branché sur `create_order` | ÉCHOUÉ | wrapper présent, aucun appel depuis le POS |
| Paiements distincts par fournisseur et remboursements tracés | RÉUSSI | PGlite Wave 400, remboursement 100, net 300 |
| Confirmation en ligne par webhook fournisseur | BLOQUÉ | contrats/secrets fournisseurs absents et à ne pas inventer |
| Supabase source de vérité des écrans métier | ÉCHOUÉ | AppContext/localStorage restent majoritaires |
| Aucune donnée fictive dans un environnement réel authentifié | ÉCHOUÉ | replis de démonstration encore présents dans AppContext |
| En-têtes de sécurité déclarés pour Vercel | RÉUSSI | `vercel.json` et build accepté |
| En-têtes observés sur le domaine de production | NON VÉRIFIÉ | aucun déploiement de cette branche pendant l’audit |
| Prototypes publics non référencés supprimés | RÉUSSI | suppression Git des trois fichiers |
| Bundle d’entrée réduit par chargement différé | RÉUSSI | entrée 375,27 kB contre 1 055,80 kB avant découpage |
| Tests unitaires et couverture des cœurs | RÉUSSI | 57/57, seuils Vitest respectés |
| Tests base/RLS/RPC | RÉUSSI | 50/50 sous PGlite |
| Smoke tests navigateur dans ce bac à sable | BLOQUÉ | exécutable Chromium absent, échec avant lancement applicatif |
| CI complète de cette branche | NON VÉRIFIÉ | à constater sur le run GitHub de la branche/PR |
| Recette Realtime deux appareils | NON VÉRIFIÉ | aucun tenant ni commande hébergée |

## Ordre recommandé pour la suite

1. **Décider du premier tenant réel** : organisation, agence, propriétaire,
   slug, catalogue et canal d’invitation.
2. **Sauvegarder puis appliquer le Lot 2 à Pressing_Pro**, relire les
   advisors/catalogues et rejouer les contrôles hébergés.
3. **Créer les comptes et memberships contrôlés**, puis tester avec de vrais
   jetons HTTP chaque rôle et chaque refus inter-tenant.
4. **Brancher un parcours POS distant minimal** derrière le tenant pilote :
   clientes, catalogue, `create_order`, paiement manuel, ticket et reprise
   réseau avec la même clé d’idempotence.
5. **Séparer explicitement production et démonstration** dans AppContext :
   en mode distant, aucun repli fictif ; états vides honnêtes et messages
   d’initialisation.
6. **Recetter comptoir ↔ atelier sur deux appareils**, y compris Realtime,
   rangement, livraison, solde et clôture par fournisseur.
7. Seulement ensuite : webhooks de paiement signés, notifications serveur,
   index fondés sur les plans réels et durcissement supplémentaire de la CSP.
