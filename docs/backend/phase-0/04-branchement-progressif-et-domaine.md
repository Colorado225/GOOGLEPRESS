# Phase 0 — Suppression Edge, domaine, tests et branchement progressif

> **Date d’exécution : 28 octobre 2026.**
>
> Projet Supabase : `Pressing_Pro` (`phjstsydxvggtduohfrl`, `eu-west-1`).
> Projet Vercel : `laundrypressing` (`prj_eT9QN8OEJFjQ2kptfy4RfwvqXHSg`).
>
> **Résultat : les Edge Functions héritées sont physiquement absentes, le
> domaine de production Vercel est déclaré dans Auth, un test hébergé avec
> claims JWT a confirmé l’isolation en transaction annulée, les types
> TypeScript sont générés et le front dispose d’un premier branchement
> Supabase optionnel. Aucun premier tenant réel n’a été créé.**

---

## 1. Edge Functions : suppression physique confirmée

Les suppressions ont été relancées dans une nouvelle réponse :

- `cinetpay-init` : supprimée ;
- `cinetpay-status` : supprimée ;
- `cinetpay-webhook` : déjà absente.

La liste distante des Edge Functions retourne désormais **un tableau vide**.
Le point restant du rapport `03-purge-pressing-pro-et-installation.md` est
donc clos côté Supabase.

Le projet Vercel contient encore d’anciennes variables d’environnement de
l’ancienne application, y compris des noms CinetPay, JWT, Postgres et service
role. Elles n’ont pas été purgées dans cette étape et doivent faire l’objet
d’un audit Vercel séparé avant un redéploiement de production.

## 2. Santé et contrôles type advisors

Le connecteur ne fournit pas l’endpoint officiel des advisors Supabase. Des
contrôles catalogue équivalents ont donc été exécutés sur la base hébergée,
en plus du contrôle de santé des services.

Santé Supabase : Auth, DB, pooler, Realtime, REST, Storage et pg_bouncer sont
`ACTIVE_HEALTHY`.

| Contrôle | Résultat |
|---|---:|
| Tables `public` | 37 |
| Tables avec RLS activée et forcée | 37 |
| Politiques RLS | 89 |
| Tables sans politique | 4 tables serveur attendues |
| Fonctions `public` | 0 |
| Fonctions privées sans `search_path` fixé | 0 |
| Tables sans clé primaire | 0 |
| Extensions dans `public` | 0 |
| Usage du schéma `private` par `anon` | refusé |
| Usage du schéma `private` par `authenticated` | autorisé pour les helpers |
| Utilisateurs Auth après rollback | 0 |

Points de performance à traiter dans une optimisation ultérieure :

- **54 clés étrangères sans index couvrant** selon le contrôle catalogue ;
- **27 politiques contenant une expression `auth.uid()` non encapsulée** dans
  `(select auth.uid())`, candidates à l’optimisation dite *initplan*.

Ces deux points sont des sujets de performance, pas une réouverture de
l’isolation : les compteurs de RLS, privilèges et fonctions ci-dessus restent
conformes au socle. Ils n’ont pas été corrigés automatiquement dans cette
étape pour éviter de créer 54 index ou de réécrire des politiques sans revue
séparée.

## 3. Test hébergé avec claims JWT

Un test hébergé a été exécuté dans une transaction PostgreSQL **annulée par
rollback** :

1. création temporaire de comptes, organisations, agences, clientes liées et
   commandes fictives ;
2. positionnement de `request.jwt.claims` avec le `sub` de chaque acteur ;
3. bascule dans le rôle `authenticated` ;
4. lectures des agences, clients et commandes ;
5. rollback complet.

Résultats observés :

| Acteur | Agences | Commandes | Clients CRM |
|---|---:|---:|---:|
| Propriétaire Alpha | 1 | 2 | 2 |
| Propriétaire Bravo | 1 | 1 | 1 |
| Cliente liée aux deux pressings | 2 | 2 | 2 |

Après le test, un nouveau comptage confirme : 0 utilisateur Auth, 0 profil,
0 organisation, 0 agence, 0 client et 0 commande. Aucune fixture n’a persisté.

Ce test valide le JWT/RLS au niveau PostgreSQL hébergé. Pour le parcours HTTP
complet, le dépôt contient maintenant :

```bash
npm run test:supabase-rest
```

Le script `scripts/test-supabase-rest.mjs` se connecte par e-mail/mot de passe
avec des comptes de validation fournis par variables d’environnement, lit les
agences/commandes via PostgREST et peut assert­er une agence attendue/interdite.
Il ne journalise ni mot de passe ni jeton. Il n’a pas encore été exécuté avec
de vrais comptes HTTP, car aucun compte de validation n’existe dans
Pressing_Pro.

## 4. Domaine de production

Le compte Vercel ne déclare aucun domaine personnalisé. Le projet
`laundrypressing` possède le domaine vérifié :

`https://laundrypressing.vercel.app`

La configuration Auth de Pressing_Pro a été mise à jour :

- `site_url` : `https://laundrypressing.vercel.app` ;
- redirections autorisées :
  - `https://laundrypressing.vercel.app`
  - `https://laundrypressing.vercel.app/**`
  - `http://localhost:3000`
  - `http://localhost:3000/**` ;
- inscription publique toujours désactivée ;
- e-mail activé avec confirmation requise ;
- téléphone toujours désactivé ;
- JWT : 3 600 secondes ;
- intervalle de réutilisation des jetons de rafraîchissement : 10 secondes.

Si un domaine personnalisé est acheté plus tard, il faudra l’ajouter à Vercel,
puis à cette allow-list, avant de remplacer le `site_url`.

## 5. Types TypeScript

Commande ajoutée :

```bash
npm run gen:supabase-types
```

Elle applique les migrations dans PGlite, introspecte le schéma `public` et
génère `src/lib/database.types.ts`.

Résultat : **37 tables, 503 colonnes, 0 enum PostgreSQL**. Les statuts du
socle sont des textes contraints par `CHECK`, pas des types enum.

Limite : ce n’est pas encore la génération officielle par la CLI Supabase
depuis le projet hébergé. La source reste néanmoins les mêmes migrations que
celles appliquées à Pressing_Pro.

## 6. Branchement progressif du front

Ajouts dans le dépôt :

- dépendance `@supabase/supabase-js` ;
- client `src/lib/supabase.ts`, créé uniquement si `VITE_SUPABASE_URL` et une
  clé publique sont présentes ;
- types `src/lib/database.types.ts` ;
- onglet **Paramètres → Backend Supabase** ;
- affichage réel de l’état de configuration sans afficher la clé ;
- connexion/déconnexion Auth par e-mail et mot de passe ;
- sonde PostgREST sur les agences et commandes visibles par la session.

Les tentatives de création des variables `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY` sur Vercel ont été refusées car elles **existent
déjà** pour la cible production. Aucune valeur de clé n’est consignée dans le
dépôt ; `.env.example` contient uniquement un modèle.

Limite assumée : les écrans métier utilisent encore leurs données locales.
La bascule des commandes, clients, caisse, stock, logistique et rangement doit
se faire domaine par domaine avec la couche d’accès et les RPC prévues par le
plan, sans reconstruire l’interface.

## 7. Premier tenant : non créé dans cette étape

Aucune organisation, agence ou compte propriétaire réel n’a été créé. Le faire
de façon contrôlée exige des informations qui ne peuvent pas être inventées :

- nom de l’organisation/pressing pilote ;
- nom, adresse, ville et téléphone public de la première agence ;
- nom complet, e-mail et téléphone du propriétaire ;
- slug public souhaité ;
- décision sur le rôle de Pressing_Pro : production, validation ou les deux
  dans un premier temps ;
- canal d’invitation du compte propriétaire, car aucun SMTP n’est configuré.

Dès ces éléments fournis, la création pourra suivre l’ordre sûr : compte Auth
propriétaire, profil, organisation, première agence, paramètres d’agence,
membership `organization_owner`, puis test REST du compte.

## 8. Validations locales exécutées

```bash
node --check scripts/generate-supabase-types.mjs
node --check scripts/test-supabase-rest.mjs
npm run test:phase0
npm run lint
npm run build
git diff --check
```

Résultats : 19 vérifications PGlite réussies, TypeScript sans erreur et build
Vite réussi. Le warning de taille de chunk Vite reste un avertissement de
performance front, sans échec de build.
