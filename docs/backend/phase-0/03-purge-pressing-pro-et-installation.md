# Phase 0 — Purge de Pressing_Pro et installation du nouveau socle

> **Date d’exécution : 28 octobre 2026.**
>
> **Décision exécutée : purge complète de l’héritage Pressing_Pro, puis
> installation des quatre migrations Phase 0 dans le même projet.**
>
> Projet : `Pressing_Pro` (`phjstsydxvggtduohfrl`, `eu-west-1`,
> PostgreSQL 17.11).
>
> **Résultat : la base hébergée contient le nouveau socle vide — 37 tables,
> RLS activée et forcée, 89 politiques, aucune donnée métier et aucun
> utilisateur Auth.** Le front n’était pas encore branché à la fin de cette
> étape.
>
> **Suite : voir `04-branchement-progressif-et-domaine.md`** pour la
> suppression physique confirmée des Edge Functions, le domaine de
> production, les tests hébergés et le premier client front.

---

## 1. Décision et périmètre

Le propriétaire a d’abord retenu l’Option B et confirmé qu’aucun site,
application ou client réel n’utilisait l’ancien contenu. Il a ensuite demandé
explicitement de supprimer l’héritage de Pressing_Pro afin de repartir sur une
base solide, puis confirmé le périmètre complet :

- supprimer les anciennes fonctions et configurations ;
- supprimer l’historique des 32 migrations héritées ;
- supprimer les Edge Functions CinetPay et leurs secrets applicatifs ;
- supprimer l’unique utilisateur Auth et ses sessions ;
- réinitialiser prudemment la configuration Auth ;
- appliquer les quatre migrations versionnées du dépôt ;
- conserver l’enveloppe du projet, son organisation, sa région et les éléments
  d’infrastructure Supabase.

Cette opération remplace la recommandation précédente d’un environnement
propre séparé : **Pressing_Pro a été nettoyé puis réutilisé comme base
hébergée du nouveau socle**. Cela ne signifie pas encore qu’il est prêt pour
une production commerciale.

## 2. État vérifié avant purge

Le contrôle immédiatement avant les suppressions a confirmé l’inventaire du
rapport `01-inventaire-et-porte-de-decision.md` :

| Élément | Avant purge |
|---|---:|
| Tables/vues/vues matérialisées/séquences `public` | 0 |
| Fonctions/procédures `public` | 65 |
| Fonctions `SECURITY DEFINER` | 54 |
| Politiques RLS `public` | 0 |
| Migrations héritées | 32 |
| Edge Functions actives | 3 CinetPay |
| Utilisateurs Auth | 1 |
| Sessions Auth | 3 |
| Buckets/objets Storage | 0 |
| Branches de base | 0 |
| Tables Realtime | 0 |

Le seul déclencheur d’événement non infrastructurel était `ensure_rls`,
appuyé sur `public.rls_auto_enable`. Les six autres déclencheurs relevés
appartiennent à l’infrastructure Supabase et ont été conservés.

La configuration Auth pointait encore vers une ancienne URL de
prévisualisation et autorisait notamment `localhost:5173`, l’inscription
publique et l’auto-confirmation e-mail.

## 3. Opérations exécutées

### 3.1 Réinitialisation et verrouillage Auth

La configuration a été remplacée par des valeurs de développement prudentes :

- `site_url` : `http://localhost:3000` ;
- redirections autorisées : `http://localhost:3000` et
  `http://localhost:3000/**` uniquement ;
- inscription publique désactivée (`disable_signup = true`) ;
- e-mail activé, téléphone désactivé ;
- auto-confirmation e-mail et SMS désactivée ;
- expiration JWT : 3 600 secondes ;
- intervalle de réutilisation des jetons de rafraîchissement : 10 secondes.

L’ancienne URL de prévisualisation et `localhost:5173` ont été retirés.
Aucun fournisseur OAuth, SMTP ou SMS n’était configuré et aucun n’a été créé.

> `localhost:3000` est une valeur de développement temporaire. Le domaine de
> production et les redirections définitives devront être définis avant
> l’ouverture aux utilisateurs.

### 3.2 Secrets applicatifs

Les quatre secrets applicatifs hérités suivants ont été supprimés :

- `CINETPAY_NOTIFY_URL` ;
- `CINETPAY_MODE` ;
- `APP_URL` ;
- `APP_ENV`.

Aucune valeur de secret n’est consignée dans le dépôt. Les secrets système
dont le nom commence par `SUPABASE_` ont été conservés.

### 3.3 Base PostgreSQL publique

La migration distante `phase0_remove_legacy_pressingpro` a :

1. supprimé le déclencheur d’événement `ensure_rls` ;
2. supprimé les 65 routines non liées à une extension dans le schéma
   `public`, dont 54 `SECURITY DEFINER` ;
3. retiré, pour les futurs objets créés par `postgres` dans `public`, les
   privilèges automatiques accordés à `anon` et `authenticated` sur les
   tables, séquences et fonctions.

Le SQL exact est conservé hors des migrations réutilisables dans :

`supabase/operations/2026-10-28_pressingpro_legacy_cleanup.sql`

Ce fichier est un historique d’opération ponctuelle : **il ne doit pas être
rejoué**.

### 3.4 Compte Auth hérité

L’unique utilisateur Auth a été supprimé de façon ciblée. Ses sessions et
dépendances Auth ont été supprimées ou neutralisées par les clés étrangères
du schéma `auth`.

### 3.5 Historique des migrations

Les 32 lignes héritées de `supabase_migrations.schema_migrations` ont été
supprimées par liste explicite de versions. La migration de purge a été
conservée comme trace d’audit.

### 3.6 Edge Functions CinetPay — point restant

- `cinetpay-webhook` : suppression confirmée ; une lecture ultérieure retourne
  « Function not found ».
- `cinetpay-init` et `cinetpay-status` : les premières demandes de suppression
  ont retourné un succès, mais l’API de gestion continue de les lister.
  Le connecteur refuse ensuite de renvoyer exactement la même suppression
  dans la même réponse (« exact write already completed »).

Pour ne laisser aucun ancien code exécutable, leurs corps ont été remplacés
par une réponse HTTP **410 Gone**, leurs noms par
`disabled-legacy-cinetpay-init` et `disabled-legacy-cinetpay-status`, en
version 3 avec `verify_jwt = true`.

**Limite franche : les deux entrées existent encore physiquement dans la liste
des Edge Functions.** Leur ancien code et leurs secrets applicatifs sont
retirés, mais leur suppression définitive doit être retentée lors d’un nouvel
échange ou depuis la console Supabase. Tant qu’elle n’est pas confirmée par
une liste vide, il ne faut pas affirmer que la purge des Edge Functions est à
100 % terminée.

## 4. Nouveau socle installé

Les quatre fichiers du dépôt ont été appliqués dans l’ordre avec l’outil de
migration Supabase. Les versions distantes sont générées par Supabase ; elles
diffèrent donc des préfixes fixes des fichiers locaux.

| Fichier local | SHA-256 local | Version distante | Nom distant |
|---|---|---:|---|
| `20261028090000_phase0_tenancy_identity.sql` | `f661acc048819b877fa98083bc76c8347d4e8b066109adc3bfc135bc7124c173` | `20261028094613` | `phase0_tenancy_identity` |
| `20261028090100_phase0_operations.sql` | `16d083c44853dd715ad047f06120548a304e3428541e15ef26888dad6dfaff2f` | `20261028094710` | `phase0_operations` |
| `20261028090200_phase0_messaging_helpers.sql` | `e95ce1e99d8d6fb47241e816ad75174888f0a2d4eabf319272648da8b354863e` | `20261028094833` | `phase0_messaging_helpers` |
| `20261028090300_phase0_rls.sql` | `1789a988d52037aba00acdaf2c478499ce8c631423c8e356c79980fadec5995a` | `20261028095008` | `phase0_rls` |

Historique distant final :

| Version | Nom |
|---:|---|
| `20261028094204` | `phase0_remove_legacy_pressingpro` |
| `20261028094613` | `phase0_tenancy_identity` |
| `20261028094710` | `phase0_operations` |
| `20261028094833` | `phase0_messaging_helpers` |
| `20261028095008` | `phase0_rls` |

Les DDL appliqués correspondent au socle validé localement. Quelques
commentaires d’en-tête ont été adaptés pendant le transfert manuel via le
connecteur ; les fichiers du dépôt n’ont pas été modifiés après application
afin de ne pas réécrire des migrations déjà exécutées.

## 5. État hébergé vérifié après installation

Contrôle catalogue effectué après la migration RLS :

| Contrôle | Résultat |
|---|---:|
| Tables `public` | 37 |
| Tables avec RLS activée et forcée | 37 |
| Politiques RLS | 89 |
| Fonctions/procédures `public` | 0 |
| Fonctions dans le schéma `private` | 15 |
| Fonctions privées `SECURITY DEFINER` | 14 |
| Fonctions privées exécutables par `anon` | 0 |
| Fonctions privées exécutables par `authenticated` | 14 |
| Tables accessibles à `anon` | 0 |
| Tables lisibles par `authenticated` avant RLS | 33 |
| Tables serveur accessibles à `authenticated` | 0 |
| Déclencheurs `set_updated_at_*` | 30 |
| Vues/séquences `public` | 0 |
| Utilisateurs/sessions Auth | 0 |
| Profils/organisations/agences/clients/commandes | 0 |
| Buckets/objets Storage | 0 |
| Tables publiées dans Realtime | 0 |
| `ensure_rls` hérité | absent |
| Lignes d’historique de migrations | 5 |

Les quatre tables sans privilège API `authenticated` sont celles réservées au
serveur : compteur de tickets, outbox de notifications, livraisons de
notifications et événements webhook fournisseurs.

Aucune fixture fictive n’a été chargée dans Pressing_Pro.

## 6. Ce qui a été conservé

- le projet Pressing_Pro, son organisation et sa région `eu-west-1` ;
- PostgreSQL et les schémas d’infrastructure Supabase ;
- les déclencheurs d’événement Supabase autres que `ensure_rls` ;
- les clés API du projet et les secrets système `SUPABASE_*` ;
- les services Supabase eux-mêmes.

Les clés API personnalisées éventuelles n’ont pas été inventoriées ni
supprimées : leurs valeurs ne doivent jamais être récupérées dans le dépôt ou
la conversation. Une rotation séparée pourra être décidée si le propriétaire
souhaite repartir aussi sur de nouvelles clés.

## 7. Validations réellement exécutées

Avant l’application distante :

```bash
sha256sum supabase/migrations/*.sql
npm run test:phase0
```

Résultat local : **19 vérifications PGlite réussies**.

Après application distante :

- chaque `create_migration` a retourné un succès ;
- l’historique distant contient uniquement la purge et les quatre migrations
  du nouveau socle ;
- le catalogue PostgreSQL confirme les compteurs du §5 ;
- `cinetpay-webhook` est absent ;
- les deux autres Edge Functions sont listées en version 3, renommées
  `disabled-legacy-*`, avec `verify_jwt = true` et code remplacé par HTTP 410.

Non encore exécutés :

- test REST/PostgREST avec de vrais jetons Auth ;
- advisors Supabase sécurité/performance ;
- génération des types TypeScript depuis le projet hébergé ;
- test d’inscription Auth et du déclencheur de profil avec un compte réel de
  validation ;
- branchement du front.

## 8. Limites et prochaines étapes

1. **Retenter la suppression physique** de `cinetpay-init` et
   `cinetpay-status`, puis confirmer une liste d’Edge Functions vide.
2. Choisir le statut définitif de Pressing_Pro : développement, validation ou
   production. Une exploitation commerciale exigera ensuite une stratégie
   d’environnements séparés et des sauvegardes testées.
3. Remplacer `localhost:3000` par les domaines autorisés, définir la politique
   d’inscription employés/clients, le SMTP et la MFA des rôles sensibles.
4. Créer de façon contrôlée le premier administrateur plateforme et le tenant
   pilote ; ne pas charger les fixtures fictives dans cette base.
5. Générer les types TypeScript et tester Auth/PostgREST avec des jetons de
   validation avant de brancher les écrans.
6. Phase 1 uniquement ensuite : couche d’accès Supabase, adaptation progressive
   d’AppContext et RPC transactionnelles pour les transitions sensibles.

## 9. Conclusion

L’ancien backend désynchronisé ne subsiste plus dans PostgreSQL : ses
routines publiques, son historique, son compte Auth, ses sessions, ses secrets
applicatifs et sa configuration Auth de prototype ont été retirés.

Pressing_Pro contient désormais uniquement le socle Phase 0 vide et protégé
par RLS. Il reste deux enveloppes d’Edge Functions neutralisées à supprimer
physiquement et tout le branchement applicatif à construire.
