# Accès personnel et onboarding — rapport du 28 octobre 2026

## Objectif

Donner à l'ERP PressingPro CI de vraies pages d'accès du personnel —
connexion, inscription et onboarding — sans affaiblir le modèle de sécurité
existant : la RLS et les RPC PostgreSQL restent l'autorité, le navigateur ne
crée jamais directement une organisation, un rôle ou un accès employé.

## Parcours livrés

| Adresse | Page | Rôle |
|---|---|---|
| `/connexion` | `StaffLoginPage` | Connexion du personnel + mot de passe oublié. Une session déjà ouverte est détectée et mène directement à l'ERP ou à l'onboarding. |
| `/inscription` | `StaffRegisterPage` | Création d'un **compte propriétaire uniquement**. Aucun accès à un pressing existant n'en découle. |
| `/bienvenue` | `StaffOnboardingPage` | Onboarding en 3 étapes : votre pressing → réglages de départ → récapitulatif, puis création serveur. |

Les trois pages vivent hors `AppProvider`, comme l'espace client : un
visiteur non authentifié ne charge ni l'état local de l'ERP ni les données
de démonstration du poste.

### Flux complet

```text
/inscription ──(compte propriétaire)──► /bienvenue ──(RPC create_my_organization)──► ERP
     │                                                                      ▲
     └──(confirmation e-mail exigée)──► /connexion ──(membership actif ?)───┤
                                                    └──(aucun rôle)──► /bienvenue

/ (ERP) sans session ──► redirection /connexion
/ (ERP) avec session sans rôle ──► écran « Aucun accès d'agence actif »
                                    + action « Créer mon pressing »
```

## Déconnexion

Un bouton **Déconnexion** est présent dans l'en-tête de l'ERP, à côté du nom
de la personne connectée (`src/components/layout/SignOutButton.tsx`). Il est
visible sur tous les écrans — tableau de bord, atelier, écran coursier
`/tournee` — et sur téléphone comme sur bureau.

- **Confirmation obligatoire** : une fenêtre « Se déconnecter ? » rappelle le
  nom du compte et laisse « Rester connecté » à portée de pouce. Une
  déconnexion accidentelle sur un poste de comptoir coûte une ressaisie de mot
  de passe.
- **Aucune donnée effacée** : la session Supabase est fermée, pas le pressing.
  Les commandes, tournées et réglages restent dans le navigateur, préfixés par
  l'organisation.
- **Redirection automatique** : la perte de session est détectée par
  `StaffAccessGate`, qui renvoie vers `/connexion` en conservant la destination
  visée (paramètre `retour`).
- **Aucun bouton en démonstration locale** : sans session, « Se déconnecter »
  laisserait croire à un compte qui n'existe pas. Un test Playwright le
  vérifie.
- **Erreur de déconnexion** : le message est affiché dans la fenêtre, sans
  fermer celle-ci ni faire croire que la session est terminée.

## Sécurité côté serveur

Migration `supabase/migrations/20261028160000_owner_onboarding.sql` :

- RPC `public.create_my_organization(...)` en `SECURITY DEFINER` avec
  `search_path` figé, exécutable par `authenticated` uniquement (révoquée
  pour `public` et `anon`) ;
- rejette tout compte déjà rattaché à une organisation active — l'onboarding
  ne peut pas servir à créer des accès supplémentaires ;
- crée en une transaction : organisation, première agence, membership
  `organization_owner` de l'appelant, `shop_settings` (frais choisis),
  compteur de tickets et, si demandé, les 32 prestations du catalogue
  proposé par défaut dans l'application (mêmes clés `c1…c21`, `b1…b11` et
  mêmes prix de départ, présentés comme ajustables) ;
- slugs générés et dédupliqués côté PostgreSQL ; verrou consultatif par
  compte contre les doubles soumissions ; journal d'audit
  `organization.onboarded` ;
- aucune policy ni aucun grant d'insertion générique n'a été ouvert sur
  `organizations`, `shops` ou `memberships`.

L'inscription des employés ne passe pas par `/inscription` : les comptes
caisse/atelier/coursier restent à attribuer de façon contrôlée (invitations).
La page le dit explicitement pour éviter toute confusion.

## Validation exécutée (locale + PGlite)

| Contrôle | Résultat |
|---|---|
| `npm run lint` (TypeScript strict) | RÉUSSI |
| `npm run test:coverage` | 68/68 tests ; `staffAuth.ts` à 98 % d'instructions |
| `npm run test:phase0` | 56/56 vérifications PGlite |
| `npm run gen:supabase-types` | 38 tables, 522 colonnes, 6 fonctions |
| `npm run build` | RÉUSSI ; JS d'entrée 379,07 kB, page onboarding en chunk séparé 22,93 kB |
| `npx playwright test --list` | 8 tests découverts (1 nouveau pour les 3 pages) |
| Playwright local | BLOQUÉ — Chromium absent du bac à sable ; CI PR #5 verte (run `40706958874`, commit `4d1df80`) |

Scénarios base prouvés sous PGlite : création complète (slug
`pressing-gamma-fictif`, 32 prestations, frais personnalisés, compteur à 1,
membership propriétaire), second rattachement refusé, déduplication de slug
(`…-2`) avec démarrage sans catalogue, membre actif refusé, nom invalide
refusé, `anon` refusé.

## Activation hébergée du 2026-10-28 (Pressing_Pro)

Réalisée sur autorisation explicite, points 1 et 2 de la liste initiale
uniquement (migrations + ouverture des inscriptions). La création du
premier compte et la fusion de la PR #5 restent à faire.

### Sauvegarde / état « avant »

Inventaire catalogue consigné avant toute écriture : 7 migrations hébergées
(dernière `20261028124739`), 37 tables avec RLS activée et forcée,
89 politiques, 0 utilisateur Auth, 0 organisation/agence/membership/cliente/
commande, pas de table `payments`, inscriptions Auth désactivées. La base ne
contenait aucune donnée métier ; son schéma reste intégralement
reproductible depuis `supabase/migrations/`.

### Migrations appliquées

| Fichier du dépôt | Version hébergée | Résultat vérifié |
|---|---|---|
| `20261028150000_order_creation_payments.sql` | `20261028144456` | 38 tables protégées, 90 politiques, `payments` publiée en Realtime, `INSERT` direct sur `orders`/`payments` refusé à `authenticated` |
| `20261028160000_owner_onboarding.sql` | `20261028144951` (`owner_onboarding_fix_alignment`) | RPC `create_my_organization` exécutable par `authenticated` uniquement |

**Incident corrigé pendant l'activation :** la première application de la
migration onboarding (version `20261028144558`) a installé une retranscription
inexacte de la fonction (signature erronée, appel à une fonction
`private.slugify` inexistante). La recette transactionnelle annulée l'a
détectée immédiatement ; aucune donnée ni aucun accès n'ont été créés. La
surcharge erronée a été supprimée et la définition exacte du dépôt installée.
L'identité hébergé ↔ dépôt est prouvée par des empreintes `md5(prosrc)` et
des signatures identiques pour les 7 fonctions concernées (`create_order`,
`record_order_payment`, `refund_order_payment`, `get_payment_totals`,
`create_my_organization`, `private.recalculate_*` ×2), comparées à une base
PGlite reconstruite depuis les fichiers du dépôt. Le fichier
`20261028170000_owner_onboarding_alignment.sql` consigne cette traçabilité
(côté PGlite, la suite reste à 56/56).

### Recette hébergée (transaction annulée, aucun résidu)

Scénario fictif exécuté avec un JWT simulé, terminé par `ROLLBACK` :
onboarding (32 prestations amorcées, slugs générés, membership propriétaire,
compteur de tickets), création d'une cliente sous RLS en tant que
propriétaire, commande tarifée par le serveur (2 × 1 500 FCFA − 5 % =
2 850 FCFA, prix navigateur falsifié ignoré, ticket n° 1), rejeu idempotent
sans doublon, paiement Wave manuel de 400 FCFA, remboursement de 100 FCFA,
totaux de caisse 400/100/300, visibilité RLS du journal, second rattachement
refusé, `INSERT` direct sur `orders`/`payments` et `UPDATE` direct de
`deposit_paid_xof` refusés. Comptes vérifiés à zéro après annulation
(utilisateurs, profils, organisations, agences, clientes, commandes,
paiements) ; 10 migrations enregistrées.

### Inscriptions Auth ouvertes

- `disable_signup` passé à `false` ; **confirmation e-mail maintenue**
  (`mailer_autoconfirm=false`, connexion refusée tant que l'e-mail n'est
  pas confirmé).
- URL de redirection déjà autorisées : domaine de production
  (`https://laundrypressing.vercel.app/**`) et `http://localhost:3000/**`,
  couvrant `/connexion` après confirmation et `/` après réinitialisation.
- **Limite connue :** aucun SMTP personnalisé n'est configuré. Les e-mails
  partent par le service d'envoi intégré de Supabase, strictement limité par
  la plateforme et à délivrabilité variable (vérifier les courriers
  indésirables). Un SMTP de production, chez un fournisseur choisi par le
  propriétaire, reste à configurer dans le tableau de bord Supabase ; aucun
  identifiant SMTP ne doit transiter par le dépôt ni par une conversation.
- Longueur minimale de mot de passe côté projet : 6 caractères
  (l'interface en exige 8).
- Ce réglage ouvre aussi l'inscription cliente (`/client/inscription`) ;
  elle ne donne toujours aucun accès aux commandes sans liaison vérifiée
  par l'agence.

### Il reste, dans l'ordre

1. **Fusionner la PR #5** pour déployer les pages `/inscription`,
   `/connexion` et `/bienvenue` en production — en créant le premier compte
   dans la foulée, afin de ne pas laisser l'ERP de production exiger une
   connexion sans qu'aucun compte n'existe.
2. **Créer le premier compte propriétaire** via `/inscription`, confirmer
   l'e-mail, puis créer l'organisation dans `/bienvenue`.
3. Configurer un **SMTP de production** avant toute inscription à grande
   échelle.
4. Recetter avec de vrais jetons : inscription → onboarding → ERP, refus
   inter-tenant, puis parcours deux appareils.

## Limites assumées de ce lot

- Le POS n'écrit toujours pas dans Supabase : après l'onboarding, l'écran de
  succès le dit honnêtement — l'organisation et les accès existent côté
  serveur, mais les commandes de ce poste restent locales tant que le
  branchement distant du POS n'est pas activé (chantier suivant).
- Un propriétaire qui voudrait une **deuxième** organisation devra passer
  par une procédure d'administration : la RPC refuse volontairement tout
  compte déjà rattaché.
- Le `public_slug` public de l'agence n'est pas défini à l'onboarding ; il
  sera choisi lors de l'ouverture de l'espace client par agence.
