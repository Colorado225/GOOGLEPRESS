# 05 — Suivi de commandes temps réel : premier lot livré

Date : 28 octobre 2026  
Branche : `arena/7c1ae4d6-googlepress`  
Projet Supabase : Pressing_Pro (`phjstsydxvggtduohfrl`)

## 1. Décision d’architecture

L’application existante n’a pas été reconstruite. Le premier lot réutilise :

- les cinq statuts déjà présents : `received`, `washing`, `ironing`, `ready`,
  `delivered` ;
- les tables `orders`, `order_events` et `logistics_tasks` de la Phase 0 ;
- les rôles et politiques RLS par organisation/agence ;
- la session Supabase déjà gérée dans Paramètres → Backend Supabase ;
- l’écran Atelier existant, auquel un onglet séparé **Suivi distant** a été
  ajouté.

Les écrans historiques POS, Kanban local, Rangement, Tournées, Remises,
Commandes et Caisse n’ont pas été remplacés. Le nouveau panneau ne manipule
que des commandes déjà présentes dans Supabase. Cette séparation évite de
présenter comme synchronisées des commandes qui ne vivent encore que dans le
`localStorage` d’un navigateur.

## 2. Migration livrée et appliquée

Fichier local :

```text
supabase/migrations/20261028110000_order_tracking_realtime.sql
```

Version distante Pressing_Pro :

```text
20261028121727_order_tracking_realtime
```

La migration :

1. ajoute des index de lecture par agence et date de mise à jour/création ;
2. passe `orders` et `logistics_tasks` en `REPLICA IDENTITY FULL` pour les
   abonnements filtrés par `shop_id` sous RLS ;
3. enrichit le déclencheur `private.log_order_status_event` afin d’enregistrer,
   dans le payload de `order_events`, la note et la source posées par la RPC ;
4. crée `public.transition_order_status(...)` ;
5. retire à `authenticated` le droit d’UPDATE générique sur `orders.status`,
   `orders.ready_at` et `orders.delivered_at` ;
6. ajoute `orders`, `order_events` et `logistics_tasks` à la publication
   `supabase_realtime` lorsqu’elle existe.

Contrôle catalogue après application :

- publication Realtime : `logistics_tasks`, `order_events`, `orders` ;
- RPC présente ;
- `authenticated` peut exécuter la RPC, `anon` ne le peut pas ;
- `authenticated` ne peut plus mettre à jour directement le statut ni ses
  horodatages ;
- `REPLICA IDENTITY = f` sur `orders` et `logistics_tasks` ;
- services Supabase `ACTIVE_HEALTHY`, y compris Realtime ;
- toujours 0 organisation, 0 agence, 0 utilisateur Auth, 0 commande,
  0 événement et 0 tournée dans Pressing_Pro.

## 3. Règles de la RPC

`transition_order_status` est la seule porte générique de changement d’étape
de production. Elle :

- exige `auth.uid()` ;
- vérifie un rôle actif `organization_owner`, `shop_manager`, `cashier` ou
  `workshop` sur l’agence de la commande ;
- verrouille la ligne (`FOR UPDATE`) ;
- accepte un `p_expected_status` pour refuser proprement un changement déjà
  effectué sur un autre poste ;
- autorise uniquement une étape adjacente, en avant ou en arrière ;
- refuse `delivered`, qui reste réservé à l’encaissement comptoir ou à la
  confirmation de livraison ;
- refuse tout changement si une livraison liée est `en_route` ;
- refuse le passage générique en `ready` lorsque
  `shop_settings.storage_assignment_required` est actif ;
- règle `ready_at`, libère le rangement lors d’une entrée/sortie de `ready`
  et remet l’ancien marqueur local de notification à faux ;
- accepte une note de 500 caractères maximum et une visibilité
  `customer` ou `internal` ;
- déclenche l’insertion de `order_events` dans la même transaction, avec
  ancien statut, nouveau statut, acteur et horodatage.

Un appel redemandant le statut courant est idempotent : il renvoie la
commande sans fabriquer un faux événement.

## 4. Couche front livrée

### `src/lib/orderTracking.ts`

Règles pures et testées :

- séquence et libellés français des cinq états ;
- transitions adjacentes autorisées ;
- exclusion de la remise générique ;
- progression 20 % → 100 % ;
- lecture défensive de la note dans le payload JSON ;
- libellés d’événements et d’acteurs ;
- autorisation d’interface selon les memberships ;
- fusion de lignes distantes par `updated_at` sans accepter une version
  périmée.

### `src/lib/supabaseOrders.ts`

Dépôt d’accès typé :

- agences accessibles et memberships de la session ;
- commandes distantes par agence ;
- tournées liées aux commandes affichées ;
- historique `order_events` ;
- appel à la RPC ;
- abonnement Realtime sur les trois tables.

Chaque événement Realtime déclenche une relecture du périmètre visible sous
RLS plutôt qu’une reconstruction partielle à partir du payload. C’est moins
optimisé qu’un cache incrémental, mais plus sûr pour un premier lot et après
une reconnexion.

### Atelier → Suivi distant

Le panneau :

- réutilise la session créée dans Paramètres → Backend Supabase ;
- affiche l’état réel de l’abonnement Realtime ;
- filtre par agence et recherche ticket/client/téléphone/article ;
- affiche séparément le statut de production et le statut logistique ;
- montre promesse, articles, montant, acompte, solde et rangement connu ;
- affiche une progression en cinq étapes ;
- propose uniquement les boutons d’étape adjacente autorisés par l’interface,
  avec note et visibilité ;
- affiche l’historique `order_events` renvoyé par RLS ;
- explique les états sans session, sans agence ou sans commande distante.

Paramètres → Backend Supabase contient désormais un bouton réel vers cet
onglet.

## 5. Types générés

`scripts/generate-supabase-types.mjs` génère désormais aussi les fonctions
publiques. `src/lib/database.types.ts` contient donc le contrat typé de
`transition_order_status` :

- 37 tables ;
- 503 colonnes ;
- 1 fonction publique ;
- 0 enum.

## 6. Tests réellement exécutés pour ce lot

### PGlite

`npm run test:phase0` passe de 19 à **28 vérifications**. Les neuf nouvelles
vérifications couvrent notamment :

- transition adjacente, acteur, note, source et visibilité interne, avec
  invisibilité de l’événement interne pour la cliente liée ;
- refus d’une commande d’une autre agence ;
- refus d’un statut déjà changé sur un autre poste ;
- refus d’un saut d’étape ;
- refus de la remise générique ;
- refus d’un UPDATE direct contournant la RPC ;
- blocage pendant une livraison `en_route`, puis reprise ;
- blocage de `ready` lorsque le rangement est obligatoire ;
- refus d’exécution pour `anon`.

### Vitest

`tests/unit/orderTracking.test.ts` ajoute 7 tests. Le périmètre de
couverture comprend désormais sept bibliothèques métier, dont
`orderTracking`.

### Hébergé

Seuls des contrôles catalogue et santé ont été exécutés dans Pressing_Pro.
Le projet reste vide : aucun faux tenant, compte ou commande de démonstration
n’a été injecté pour simuler une recette.

## 7. Ce qui n’est pas encore du temps réel exploitable

Le lot ne doit pas être présenté comme une synchronisation comptoir ↔
atelier déjà utilisable en production. Il manque encore :

1. le premier tenant réel, sa première agence, son propriétaire et ses
   comptes d’équipe ;
2. les tests HTTP avec de vrais jetons Auth/PostgREST et un navigateur
   connecté ;
3. la création distante des clientes et commandes depuis le POS ;
4. la bascule du Kanban local, des Commandes, du rangement, des remises et
   des tournées vers le dépôt Supabase ;
5. des RPC dédiées pour ranger/marquer prêt, encaisser/remettre, démarrer et
   terminer les tournées ;
6. la page client authentifiée ou un jeton de suivi aléatoire, révocable et
   à durée limitée ;
7. les notifications internes persistantes, puis SMS/WhatsApp/push via un
   secret strictement serveur ;
8. une stratégie hors ligne et de reprise après coupure testée sur le terrain.

La page client ne doit pas être ouverte avec le seul numéro `#TK-...`, qui
est séquentiel et donc devinable.

## 8. Recette deux appareils — état exact : 0/9

| # | Scénario | État |
|---|---|---|
| 1 | Créer la commande au comptoir et la voir dans l’atelier | Non testé : création POS encore locale et aucun tenant |
| 2 | Passer Réception → Lavage et voir la mise à jour au comptoir | RPC testée en PGlite uniquement |
| 3 | Passer Lavage → Repassage | RPC testée en PGlite uniquement |
| 4 | Passer Prêt et vérifier l’historique | Règles testées en PGlite uniquement |
| 5 | Ranger dans un casier | RPC distante de rangement non livrée |
| 6 | Voir le suivi client sans téléphone/adresse/note interne | Page client non livrée |
| 7 | Démarrer une livraison et voir un statut logistique séparé | Lecture distante codée, parcours non testé |
| 8 | Confirmer la remise et fermer la commande des deux côtés | RPC de remise non livrée |
| 9 | Vérifier qu’une autre agence ne voit pas la commande | RLS prouvée en PGlite et par test SQL hébergé antérieur, pas en HTTP |

## 9. Ordre recommandé pour le lot suivant

1. Fournir les données réelles du premier tenant et créer les comptes de
   validation.
2. Exécuter `npm run test:supabase-rest` avec ces comptes, puis ouvrir deux
   navigateurs sur Atelier → Suivi distant.
3. Livrer la création distante d’une cliente et d’une commande simple au POS.
4. Basculer le Kanban de production sur le dépôt Supabase.
5. Ajouter les RPC rangement, remise comptoir et tournées.
6. Construire ensuite le suivi client contrôlé.
