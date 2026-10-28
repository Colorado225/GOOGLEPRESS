# Phase 0 — Socle Option B et validation locale

> **Date : 28 octobre 2026.**
>
> **Décision appliquée : Option B — repartir proprement.** Le propriétaire a
> également confirmé qu’aucun site, application ou client réel n’utilise
> l’ancien contenu de Pressing_Pro.
>
> **Périmètre livré à l’époque : dépôt et PostgreSQL local éphémère
> uniquement.** Aucune migration n’avait encore été appliquée à Pressing_Pro
> ni à un autre projet Supabase externe.
>
> **Remplacé depuis : voir
> `03-purge-pressing-pro-et-installation.md`.** Le propriétaire a ensuite
> autorisé la purge de Pressing_Pro et l’installation hébergée de ce socle.

---

## 1. Résultat

La fondation backend v1 est maintenant versionnée dans le dépôt sous
`supabase/migrations/`. Elle modélise depuis l’application actuelle :

- les organisations et leurs agences ;
- les profils Supabase Auth, rôles du personnel et invitations ;
- les paramètres d’agence et le catalogue tarifaire par agence ;
- les clients CRM propres à chaque organisation et la liaison vérifiée d’un
  compte client ;
- les commandes, événements de statut et numéros de ticket par agence ;
- le rangement atelier ;
- les tournées de ramassage/livraison et les demandes d’enlèvement client ;
- la caisse, les produits, mouvements de stock et dépenses ;
- les conversations client ↔ pressing et les notes internes séparées ;
- les modèles de messages, réponses rapides et préférences de communication ;
- l’outbox de notifications, les tentatives d’envoi, Web Push, canaux,
  webhooks fournisseurs, compteurs d’usage et journal d’audit.

Les quatre migrations créent **37 tables `public`**. Toutes ont RLS activée et
forcée dans le prototype local.

## 2. Migrations livrées

| Fichier | Contenu |
|---|---|
| `20261028090000_phase0_tenancy_identity.sql` | Schéma privé, profils, administrateurs plateforme, organisations, agences, employés, appartenances, invitations, présences, paramètres, catalogue, clients, liaisons de comptes et création automatique du profil Auth. |
| `20261028090100_phase0_operations.sql` | Emplacements de rangement, compteur de tickets, commandes, événements, tournées, demandes d’enlèvement, caisse, produits, stock et dépenses. |
| `20261028090200_phase0_messaging_helpers.sql` | Conversations, messages, lectures, notes internes, modèles, notifications, préférences, canaux, webhooks, usage, audit, fonctions privées d’appartenance et déclencheurs atomiques. |
| `20261028090300_phase0_rls.sql` | Activation/force RLS, privilèges de tables et colonnes pour `authenticated`, politiques tenant/agence/client/personnel et tables réservées au serveur. |

Les lignes métier portent le périmètre nécessaire (`organization_id` et, le
cas échéant, `shop_id`). Les relations sensibles utilisent aussi des clés
étrangères composites : une commande ne peut pas associer une agence d’une
organisation à un client d’une autre ; une tournée de livraison ne peut pas
associer un client à la commande d’un autre client.

## 3. Règles de sécurité mises en œuvre

### Cloisonnement

- Un utilisateur d’une organisation ne voit ni les agences, commandes, clients
  ou conversations d’une autre organisation.
- Le personnel rattaché à une agence ne voit pas les commandes d’une autre
  agence de la même organisation.
- Un même compte client peut être lié séparément à deux organisations avec le
  même numéro : il voit uniquement ses propres fiches et commandes dans
  chacune, sans fusion des CRM.
- L’administrateur plateforme voit les organisations/agences nécessaires au
  pilotage, mais pas les commandes métier par défaut.
- Le coursier ne voit que ses tournées affectées et la commande directement
  liée à chacune ; il n’a pas d’accès direct au CRM complet.
- Les notes internes de conversation sont dans une table distincte et ne sont
  jamais lisibles par le client.

### Privilèges minimaux

- Aucun privilège de table n’est accordé à `anon` dans ce socle.
- Les fonctions d’aide RLS sont dans le schéma non exposé `private`, avec
  `search_path` fixé.
- `ticket_counters`, `notification_outbox`, `notification_deliveries` et
  `provider_webhook_events` n’ont aucun privilège API `authenticated`/`anon` :
  ils sont réservés aux traitements serveur.
- Les statuts de cycle de vie d’organisation/agence ne sont pas modifiables par
  l’API authentifiée ordinaire.
- Le numéro E.164 de confiance d’une fiche client n’est pas modifiable par une
  simple mise à jour API : son changement devra passer par une vérification
  serveur en phase 1.
- Seul le rôle `organization_owner` peut avoir une appartenance sans agence ;
  les autres rôles sont obligatoirement rattachés à une agence.

### Intégrité métier déjà protégée en base

- Le numéro de ticket est attribué par un compteur transactionnel par agence.
  Un utilisateur API ne peut pas imposer le numéro 999 à la place du prochain
  numéro.
- La création et les changements de statut d’une commande écrivent un
  événement d’historique.
- Un mouvement de stock met à jour la quantité dans la même transaction et un
  stock négatif est refusé.
- Un client peut créer une demande d’enlèvement uniquement à l’état
  `pending`, depuis le portail, sans note du personnel ni tournée déjà liée.
- Un client ou un membre du personnel ne peut pas fabriquer un message
  automatique de type statut/carte système ; ces messages sont réservés au
  serveur.
- L’expéditeur d’un message direct doit être l’utilisateur connecté.

## 4. Validation réellement exécutée

Le script :

```bash
npm run test:phase0
```

démarre PostgreSQL en mémoire avec PGlite, émule de façon minimale les rôles
Supabase et `auth.uid()`, applique les quatre migrations dans l’ordre, charge
les fixtures fictives de `supabase/tests/phase0/fixtures.sql`, puis exécute
**19 vérifications**.

Les fixtures contiennent uniquement des données explicitement fictives :

- organisation Alpha avec deux agences ;
- organisation Bravo avec une agence ;
- propriétaire, caisse, atelier et coursier ;
- une même cliente et un même numéro rattachés séparément aux deux
  organisations ;
- commandes, tournées, conversations, produits et outbox de test.

Les 19 contrôles couvrent :

1. RLS activée et forcée sur les 37 tables ;
2. agences visibles uniquement par leur propriétaire ;
3. employés limités à leur agence ;
4. cliente commune limitée à ses commandes des deux pressings ;
5. super-admin sans accès par défaut aux commandes ;
6. coursier limité à sa tournée et à la commande liée, sans CRM ;
7. conversations cloisonnées et notes internes invisibles au client ;
8. écriture cliente autorisée dans sa conversation ;
9. écriture refusée dans une conversation d’un autre tenant ;
10. faux message de statut refusé ;
11. commande agence A/client B refusée ;
12. tournée client/commande d’un autre client refusée ;
13. ticket serveur unique malgré un numéro imposé par le client API ;
14. demande d’enlèvement cliente créée en attente ;
15. auto-confirmation d’enlèvement refusée ;
16. sortie de stock appliquée ;
17. stock négatif refusé ;
18. lecture `anon` refusée ;
19. lecture de l’outbox par `authenticated` refusée.

Commandes de contrôle du dépôt à relancer avant livraison :

```bash
npm run test:phase0
npm run lint
npm run build
git diff --check
```

La dépendance de test `@electric-sql/pglite@0.3.14` est déclarée en
`devDependencies`. Elle n’est pas embarquée dans le navigateur.

## 5. Limites assumées

Ce socle n’est pas encore un backend déployé.

- PGlite prouve le SQL PostgreSQL local, pas encore PostgREST, Supabase Auth
  réel, Realtime, Storage ou les règles propres à un projet hébergé.
- Aucun environnement Supabase propre de validation n’a encore été désigné ou
  créé ; les migrations n’y ont donc pas été rejouées.
- Le front continue pour l’instant à fonctionner avec ses données actuelles ;
  aucun écran n’est branché à Supabase dans cette livraison.
- L’inscription/liaison client par OTP, l’acceptation sécurisée des
  invitations, l’onboarding d’une organisation et les quotas commerciaux
  nécessiteront des Edge Functions ou RPC relues en phase 1.
- Les demandes publiques anonymes d’enlèvement restent désactivées : elles
  devront passer par un point d’entrée serveur avec anti-abus et limites.
- Aucun bucket Storage et aucune publication Realtime ne sont créés dans ces
  quatre migrations.
- L’outbox est modélisée, mais aucun worker d’envoi, fournisseur WhatsApp/SMS,
  Web Push ou webhook réel n’est implémenté.
- Les transitions sensibles de commandes/tournées, le calcul de prix complet,
  les encaissements et le respect strict des capacités de rangement devront
  être encapsulés dans des RPC transactionnelles avant le branchement du
  front. Les politiques actuelles cloisonnent déjà tenant, agence et rôle,
  mais ne prétendent pas remplacer ces règles de transition.
- La suspension technique d’une organisation/agence est réservée au serveur ;
  son application complète dans les parcours d’administration reste à livrer.
- Les définitions TypeScript Supabase ne sont pas générées tant qu’un
  environnement propre n’a pas rejoué les migrations.

## 6. Porte exécutée depuis ce rapport

Le propriétaire a ensuite autorisé une autre trajectoire : **purge complète de
Pressing_Pro et installation de ce socle dans le projet nettoyé**. Voir
`03-purge-pressing-pro-et-installation.md` pour les opérations, versions
distantes, contrôles catalogue et limites restantes.

Restent notamment à faire avant la phase 1 :

1. supprimer physiquement les deux enveloppes Edge désactivées ;
2. tester Auth/PostgREST avec de vrais jetons ;
3. générer les types TypeScript ;
4. définir les domaines, la politique d’inscription et le statut
   développement/validation/production de Pressing_Pro.

## 7. État externe à la date de ce rapport local

À la fin de l’étape décrite ici, Pressing_Pro était encore inchangé. Cet état
est désormais historique et a été remplacé par celui documenté dans le
rapport `03-purge-pressing-pro-et-installation.md`.
