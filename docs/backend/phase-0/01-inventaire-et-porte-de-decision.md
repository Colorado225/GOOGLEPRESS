# Phase 0 — Inventaire Pressing_Pro et porte de décision

> **Date de l’inventaire : 28 octobre 2026.**
>
> **Périmètre exécuté : lecture seule.** Aucune table, fonction, politique RLS,
> configuration Auth, Edge Function, branche ou donnée n’a été créée, modifiée
> ou supprimée pendant cet inventaire.
>
> **Conclusion de porte : ne pas appliquer de schéma à Pressing_Pro pour le
> moment.** Le projet contient les traces d’un backend multi-tenant
> préexistant, mais son schéma de tables `public` est actuellement absent.
> Il faut d’abord décider du sort de cet existant avant toute nouvelle
> migration.
>
> **Décision postérieure du propriétaire : Option B, avec confirmation
> qu’aucun usage réel ne dépend de cet existant.** Le socle neuf, ses tests
> locaux et ses limites sont documentés dans
> `02-socle-option-b-et-validation-locale.md`.
>
> **Suite exécutée le même jour : le propriétaire a ensuite autorisé la purge
> complète de Pressing_Pro et l’installation du nouveau socle.** Voir
> `03-purge-pressing-pro-et-installation.md`. Le présent document conserve
> l’état constaté avant cette purge.

---

## 1. Résumé exécutif

La première partie de la phase 0 est terminée : le projet cible a été
identifié et inventorié sans écriture.

Le résultat n’est pas celui d’un projet vierge :

- **Pressing_Pro est actif et sain** ;
- l’historique contient **32 migrations** liées à un backend pressing
  multi-tenant : tenants, catalogue, tarification, commandes, stock,
  paiements, notifications, support, abonnements et CinetPay ;
- ces migrations avaient créé au fil du temps **50 noms de tables distincts** ;
- au moment du contrôle, le schéma `public` contient **0 table métier**, mais
  encore **65 fonctions**, dont **54 `SECURITY DEFINER`** ;
- trois Edge Functions CinetPay sont actives ;
- un compte Auth existe.

L’état est donc **désynchronisé** : l’historique et une partie du code base de
données subsistent, mais les tables auxquelles ce code se référait ne sont
plus présentes. Écrire par-dessus sans audit pourrait :

- entrer en conflit avec les anciennes fonctions et versions de migration ;
- détruire ou rendre irrécupérable un travail encore utile ;
- exposer par inadvertance d’anciennes fonctions privilégiées ;
- casser les Edge Functions existantes ou l’unique compte Auth ;
- rendre impossible de comprendre ce qui a été intentionnellement retiré.

La suite sûre est donc une décision explicite du propriétaire sur le sort de
cet existant, avant la création du schéma v1 et le prototype d’isolation.

## 2. Méthode et limites

Contrôles effectués en lecture seule :

- liste et détail du projet Supabase visible par le compte connecté ;
- santé des services Auth, PostgreSQL, REST, Realtime, Storage et pooler ;
- configuration Auth publique du projet ;
- historique des migrations ;
- liste des branches de base de données ;
- liste des Edge Functions ;
- catalogues PostgreSQL : schémas, tables, vues, séquences, types, fonctions,
  politiques RLS, publications Realtime, event triggers et extensions ;
- comptages techniques limités : utilisateurs Auth, sessions, buckets et
  objets Storage.

Non effectués volontairement :

- aucune lecture de ligne métier ou de donnée personnelle ;
- aucune récupération de clé API ou de secret ;
- aucun appel aux fonctions SQL inventoriées ;
- aucune lecture du code source des Edge Functions ;
- aucune écriture, migration, suppression ou modification de configuration ;
- aucun test de charge, de restauration ou d’intrusion.

La formule commerciale Supabase, les quotas contractuels et la rétention des
sauvegardes n’étaient pas exposés par les contrôles utilisés ; ils restent à
confirmer dans la console du propriétaire.

## 3. Identité et état du projet

| Élément | Résultat vérifié |
|---|---|
| Projet | `Pressing_Pro` |
| Project ID / ref | `phjstsydxvggtduohfrl` |
| Région | `eu-west-1` — Irlande |
| Statut | `ACTIVE_HEALTHY` |
| PostgreSQL | 17.11 |
| Création du projet | 23 octobre 2026 |
| Services signalés sains | Auth, DB, DB Postgres user, pooler, Realtime, REST, Storage, PgBouncer |
| Branches de base retournées | aucune |
| Utilisateurs Auth | 1 |
| Sessions Auth | 3 au moment du comptage |
| Buckets Storage | 0 |
| Objets Storage | 0 |

Les extensions PostgreSQL présentes sont :

- `plpgsql` ;
- `pgcrypto` ;
- `uuid-ossp` ;
- `supabase_vault` ;
- `pg_stat_statements`.

Aucune table n’est actuellement publiée dans `supabase_realtime`.

## 4. Historique de migrations et schéma disparu

L’historique contient 32 versions, notamment :

- socle initial, paiements et plusieurs « paliers » fonctionnels ;
- inscription, audit, notifications et super-admin ;
- atomicité CinetPay ;
- plusieurs générations de catalogue, modèles de blanchisserie et
  tarification à la pièce/au kilo/forfaits ;
- onboarding tenant, services par tenant et CRUD ;
- événements de synchronisation client.

L’extraction des `CREATE TABLE` dans les statements stockés fait apparaître
50 noms de tables distincts, par exemple :

- identité et plateforme : `tenants`, `tenant_users`, `platform_admins`,
  `plans`, `subscriptions`, `support_requests` ;
- métier : `customers`, `orders`, `order_items`, `order_status_history`,
  `expenses`, `stock_items`, `stock_movements`, `suppliers` ;
- catalogue et prix : `catalog_articles`, `catalog_services`,
  `pricing_rules`, `pricing_rule_tiers`, `commercial_packages` et plusieurs
  tables de modèles ;
- finance : `cash_sessions`, `payment_transactions`, `payment_refunds` ;
- plateforme : `audit_log`, `notifications`, `client_sync_events`.

Au moment du contrôle, le schéma `public` contient :

| Objet | Nombre actuel |
|---|---:|
| Tables de base | 0 |
| Vues et vues matérialisées | 0 |
| Séquences | 0 |
| Types enum/domaine/range | 0 |
| Politiques RLS | 0 |
| Tables publiées en Realtime | 0 |
| Fonctions | 65 |

Une seule migration de l’historique contient explicitement des `DROP TABLE`
liés à une suppression ciblée de tarification/modèles ; elle n’explique pas à
elle seule la disparition de toutes les tables. La cause exacte de l’état
actuel ne peut pas être déduite des seuls catalogues : nettoyage extérieur aux
migrations, restauration partielle ou autre opération restent des hypothèses.

## 5. Fonctions SQL restantes

Les 65 fonctions restantes couvrent notamment :

- tenant et rôles : `current_tenant_id`, `current_tenant_role`,
  `is_tenant_member`, `is_platform_admin` ;
- administration plateforme : création de boutique, membres, abonnements,
  demandes de support et vue d’ensemble des tenants ;
- catalogue/tarification : modèles, prix au poids et forfaits ;
- commandes/stock/paiements : gardes, historique de statut, mouvement de
  stock, paiement espèces, remboursement et finalisation CinetPay ;
- onboarding et équipe tenant.

### Point de sécurité majeur

- **54 fonctions sont `SECURITY DEFINER`** ;
- **47** sont exécutables par le rôle `authenticated` ;
- **27** sont exécutables par le rôle `anon`.

Ces fonctions n’ont pas été appelées pendant l’inventaire. Beaucoup échoueraient
probablement à cause des tables absentes, mais cela ne constitue pas une
garantie de sécurité. Avant tout branchement d’un front sur ce projet, il
faudra :

1. exporter et relire leurs définitions ;
2. vérifier `search_path`, contrôles d’identité et contrôles de tenant ;
3. révoquer tout accès API non indispensable ;
4. conserver uniquement les fonctions comprises, testées et reprises dans des
   migrations versionnées du dépôt.

Un event trigger `ensure_rls` est également actif sur les commandes DDL. Son
comportement devra être compris avant de créer de nouvelles tables.

## 6. Edge Functions existantes

Trois fonctions sont actives :

| Slug | Version observée | JWT vérifié par la plateforme |
|---|---:|---|
| `cinetpay-init` | 2 | oui |
| `cinetpay-status` | 2 | oui |
| `cinetpay-webhook` | 2 | non |

Le webhook sans JWT n’est pas en soi anormal : un webhook fournisseur doit
alors vérifier rigoureusement la signature et l’idempotence dans son code.
Ce code n’a pas été lu pendant l’inventaire.

Si ces fonctions dépendent des tables de paiement disparues, elles ne peuvent
pas être considérées opérationnelles sans test contrôlé dans un environnement
séparé. Aucun paiement de test n’a été déclenché.

## 7. Configuration Auth observée

État actuel :

- e-mail activé ;
- téléphone désactivé ;
- inscription ouverte ;
- confirmation e-mail automatique ;
- aucun SMTP personnalisé visible ;
- fournisseur SMS positionné sur Twilio, sans identifiants visibles dans la
  configuration retournée et avec le canal téléphone désactivé ;
- URL de site temporaire de type environnement de développement, avec
  redirections localhost et temporaires ;
- JWT d’une heure ;
- rotation des refresh tokens signalée active ;
- MFA TOTP disponible, sans preuve d’obligation pour les rôles sensibles ;
- CAPTCHA désactivé ;
- longueur minimale de mot de passe : 6 caractères ;
- modèles d’e-mail par défaut en anglais.

Cette configuration peut convenir à un prototype, mais pas encore à une
plateforme commerciale multi-tenant. Avant production, il faudra définir :

- domaine officiel et liste fermée des redirections ;
- politique d’inscription distincte employés/clients ;
- SMTP transactionnel et modèles en français ;
- fournisseur OTP SMS/WhatsApp, limites et anti-abus ;
- politique de mot de passe et MFA pour propriétaires/super-admins ;
- procédure de récupération et de révocation des comptes.

Aucune modification Auth n’a été effectuée pendant la phase 0.

## 8. Modèle logique v1 proposé

Le modèle du plan principal reste la cible, indépendamment du sort de
l’existant. Il ne doit pas être appliqué à Pressing_Pro avant la décision du
§12.

### 8.1 Axe tenant

- `organizations` : entreprise cliente de la plateforme ;
- `shops` : agence physique ;
- `profiles` et `memberships` : comptes, rattachements et rôles ;
- `invitations` : accès employés expirables/révocables ;
- `shop_settings` : identité, frais, règles logistiques et rangement ;
- `service_catalog_items` : catalogue et prix configurables ;
- `usage_counters` : mesure des messages et ressources par tenant.

Les tables d’agence porteront `shop_id`. Lorsqu’un accès organisation entière
est nécessaire, `organization_id` sera aussi présent ou dérivé de façon
contrôlée, avec des clés étrangères composites pour empêcher de relier une
ligne à une ressource d’un autre tenant.

### 8.2 Métier

- `customers` et `customer_account_links` ;
- `orders` avec instantané des lignes/prix, `order_events`,
  `ticket_counters` ;
- `storage_locations` ;
- `pickup_requests` et `logistics_tasks` ;
- caisse/clôtures, employés/présences, produits/mouvements de stock,
  dépenses/catégories.

### 8.3 Messagerie et notifications

- `conversations`, `conversation_participants`, `messages` ;
- `conversation_internal_notes`, séparées des messages clients ;
- `message_templates`, `quick_replies` ;
- `notification_outbox`, `notification_deliveries` ;
- `push_subscriptions`, `communication_preferences` ;
- `messaging_channels`, `provider_webhook_events`.

## 9. Matrice de rôles proposée

Légende : **C** créer, **L** lire, **M** modifier, **A** administrer,
**—** aucun accès, **limité** = uniquement son périmètre.

| Ressource/action | Plateforme | Propriétaire org. | Gérant agence | Caisse | Atelier | Coursier | Client | Anonyme |
|---|---|---|---|---|---|---|---|---|
| Tenants et abonnements | A | L (le sien) | — | — | — | — | — | — |
| Paramètres, tarifs et catalogue | support encadré | A | M limité | L | L utile | — | L public utile | — |
| Comptes employés | support encadré | A | M limité | — | — | — | — | — |
| Clients CRM | — par défaut | A org. | C/L/M agence | C/L/M | L utile | L tournée | soi-même | — |
| Commandes et tickets | — par défaut | A org. | C/L/M agence | C/L/M | M production | L tournée | L les siennes | — |
| Caisse et clôtures | — par défaut | A org. | L/M agence | C/L/M | — | encaissement tournée limité | solde des siennes | — |
| Production et rangement | — par défaut | A org. | L/M | L | C/L/M | L utile | statut simplifié | — |
| Tournées | — par défaut | A org. | C/L/M | C/L/M | L utile | M les siennes | L/C les siennes | demande contrôlée |
| Stocks et dépenses | — par défaut | A org. | C/L/M agence | selon permission | mouvements autorisés | — | — | — |
| Personnel et paie | — par défaut | A org. | limité | — | sa présence si prévu | sa présence si prévu | — | — |
| Inbox messagerie | — par défaut | A org. | C/L/M agence | C/L/M | selon permission | fils de tournée | ses fils | — |
| Notes internes de conversation | — par défaut | L/M org. | L/M agence | selon permission | selon permission | — | jamais | — |
| Demande publique d’enlèvement | supervision anti-abus | L/M | L/M | L/M | — | — | C les siennes | C contrôlée |
| Exports et suppression | procédure encadrée | A org. | limité | — | — | — | ses données | — |

La plateforme ne doit pas avoir un accès métier permanent par défaut. Tout
support dans les données d’un tenant devra être temporaire, tracé et, hors
incident critique, autorisé par ce tenant.

## 10. Règles RLS et menaces à traiter

Principes à appliquer dans le schéma v1 :

1. RLS activée sur toutes les tables accessibles par l’API ; accès anonyme
   refusé par défaut.
2. Aucun `tenant_id`, `organization_id` ou `shop_id` envoyé par le navigateur
   n’est cru sans vérification d’appartenance.
3. Clés étrangères composites entre ressources du même tenant/agence.
4. Fonctions d’aide RLS dans un schéma non exposé à l’API, avec `search_path`
   fixé et privilèges minimaux.
5. `SECURITY DEFINER` réservé aux opérations atomiques indispensables, relu
   et testé ; révocation explicite de `EXECUTE` pour `PUBLIC`, `anon` et tout
   rôle non prévu.
6. Politiques séparées lecture/création/modification/suppression ; suppression
   métier remplacée par désactivation/annulation lorsque l’historique compte.
7. Realtime soumis aux mêmes règles ; aucun filtrage uniquement dans le
   navigateur.
8. Fichiers privés par chemin organisation/agence/conversation et URL signées
   temporaires.
9. Webhooks vérifiés par signature, idempotents et journalisés.
10. Codes OTP et liens clients à durée courte, limites d’essais et révocation.

Menaces prioritaires du prototype phase 0 :

- remplacement d’un identifiant par celui d’un autre tenant ;
- rattachement d’un compte client à une fiche au seul moyen d’un numéro ;
- anciennes fonctions privilégiées accessibles par RPC ;
- fuite d’une note interne dans le fil client ;
- pièces jointes devinables ou URL permanente ;
- demande publique d’enlèvement abusive ;
- webhook rejoué ou paiement confirmé deux fois ;
- employé désactivé conservant une session utile ;
- accès support plateforme silencieux.

## 11. Stratégie d’environnements et prototype d’isolation

Recommandation :

- **geler les écritures sur Pressing_Pro** jusqu’à la décision du §12 ;
- exporter l’existant utile dans une archive d’audit contrôlée par le
  propriétaire : schéma, définitions de fonctions, historique de migrations et
  code des Edge Functions, sans committer de secret ;
- utiliser un **environnement de validation séparé** pour rejouer/évaluer
  l’ancien schéma ou construire le nouveau ;
- versionner toute migration retenue dans ce dépôt avant de l’appliquer ;
- ne déployer en production qu’après répétition complète en validation.

Aucune branche de base n’a été retournée pour Pressing_Pro pendant
l’inventaire. La création d’une branche ou d’un second projet peut avoir des
conditions de formule/coût : elle nécessitera une décision séparée.

Le prototype d’isolation devra contenir au minimum :

- organisation A avec deux agences ;
- organisation B avec une agence ;
- le même numéro de téléphone client dans les deux organisations ;
- propriétaire, gérant, caisse, atelier, coursier et client ;
- commandes, tournées et conversations croisées en apparence ;
- tests d’accès refusés en REST et Realtime ;
- tentative de liaison commande/client/conversation entre tenants ;
- tentative d’appel RPC avec un rôle non autorisé.

## 12. Options et décision requise

### Option A — Auditer et évaluer l’ancien backend

Exporter puis rejouer les 32 migrations dans un environnement isolé, relire
les fonctions/Edge Functions et comparer le modèle à l’application actuelle.

**Avantage :** réutiliser ce qui est sain, notamment catalogue, tarification,
paiements, abonnements et notifications déjà explorés.

**Coût/risque :** travail d’archéologie logicielle ; le code n’est pas dans ce
dépôt, son adéquation au front et sa sécurité restent à démontrer.

### Option B — Repartir proprement

Archiver l’inventaire, puis construire le schéma v1 depuis l’application
actuelle dans un environnement neuf et des migrations versionnées du dépôt.

**Avantage :** modèle cohérent avec les écrans, la logistique, le rangement,
l’espace client et la messagerie visés.

**Coût/risque :** abandon ou réécriture d’une partie de l’ancien travail,
notamment CinetPay et la tarification avancée.

### Option C — Réaligner Pressing_Pro lui-même

Après export/sauvegarde et approbation explicite, nettoyer ou mettre en
quarantaine les fonctions orphelines, traiter l’historique de migrations et
appliquer le nouveau schéma dans ce même projet.

**Avantage :** conserver le projet, le compte Auth et éventuellement les Edge
Functions utiles.

**Coût/risque :** opération la plus délicate ; tout nettoyage destructif doit
être précédé d’une sauvegarde et d’une preuve qu’aucun service réel ne dépend
encore de l’existant.

## 13. Recommandation

1. **Ne rien créer dans Pressing_Pro maintenant.**
2. Identifier l’origine et l’usage réel des 32 migrations, des fonctions
   CinetPay et de l’unique compte Auth.
3. Si cet existant est reconnu et potentiellement utile, commencer par
   l’**option A** dans un environnement isolé.
4. S’il est abandonné ou sans source/test fiable, choisir l’**option B** ; ne
   réaligner Pressing_Pro (option C) qu’après sauvegarde et autorisation de
   nettoyage explicite.
5. Seulement ensuite, écrire les migrations v1 dans le dépôt et exécuter le
   prototype d’isolation à deux tenants.

## 14. Questions au propriétaire

1. Reconnais-tu les migrations anciennes et les fonctions CinetPay de
   Pressing_Pro ? Proviennent-elles d’un autre développement que tu veux
   conserver ?
2. Un site, une application ou un client réel utilise-t-il encore ce projet,
   son compte Auth ou ses Edge Functions ?
3. Le projet peut-il être traité comme un prototype abandonné, ou contient-il
   quelque chose à ne surtout pas perdre ?
4. Souhaites-tu que j’audite/restaure cet ancien schéma dans un environnement
   séparé (option A), ou que je reparte proprement depuis l’application
   actuelle (option B) ?
5. Acceptes-tu le principe d’un environnement Supabase de validation distinct
   avant toute production, sous réserve de vérifier formule et coût ?

## 15. Statut de la phase 0

| Livrable phase 0 | Statut |
|---|---|
| Inventaire vérifié de Pressing_Pro | **Terminé en lecture seule** |
| Modèle logique multi-tenant proposé | **Présent dans le plan et résumé ici** |
| Matrice des rôles | **Proposée ci-dessus** |
| Menaces et principes RLS | **Proposés ci-dessus** |
| Trajectoire de l’existant Pressing_Pro | **Option B retenue ; aucun usage réel confirmé par le propriétaire** |
| Choix d’environnement Supabase de validation | **Remplacé par la purge et la réutilisation de Pressing_Pro** |
| Schéma SQL v1 versionné | **Terminé localement — quatre migrations sous `supabase/migrations/`** |
| Purge de l’héritage Pressing_Pro | **Exécutée — base/Auth/secrets ; deux enveloppes Edge neutralisées restent à supprimer physiquement** |
| Schéma SQL v1 appliqué à Pressing_Pro | **Oui — versions distantes `20261028094613` à `20261028095008`** |
| Prototype de deux tenants fictifs | **Terminé localement — 19 vérifications PGlite ; aucune fixture chargée dans Pressing_Pro** |

La prochaine porte est la validation Auth/PostgREST avec de vrais jetons, la
génération des types TypeScript et la suppression physique des deux enveloppes
Edge désactivées. Voir `03-purge-pressing-pro-et-installation.md`.
