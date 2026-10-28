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

## Ce qui reste à activer (hors code)

Ces pages sont **livrées mais pas encore utilisables en réel**. Il manque,
dans l'ordre :

1. **Appliquer les migrations à Pressing_Pro** (après sauvegarde) : d'abord
   `20261028150000_order_creation_payments.sql`, puis
   `20261028160000_owner_onboarding.sql`. Pressing_Pro est inchangé à ce
   jour : 0 tenant, 0 compte, pas de table `payments`, pas de RPC
   d'onboarding.
2. **Ouvrir les inscriptions dans le projet Supabase Auth** (désactivées
   aujourd'hui) et décider de la confirmation e-mail ; sans SMTP de
   production, les e-mails de confirmation/réinitialisation resteront
   limités au service par défaut.
3. **Vérifier les URL de redirection Auth** pour le domaine de production
   (`/connexion` après confirmation, `/` après réinitialisation).
4. **Fusionner la PR #5 après la création des premiers comptes**, sinon
   l'ERP de production exigera une connexion sans qu'aucun compte n'existe.
5. Recetter avec de vrais jetons : inscription → onboarding → ERP, refus
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
