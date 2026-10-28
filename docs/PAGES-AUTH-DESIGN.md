# Pages de connexion et d'inscription — refonte visuelle (direction « Magnific »)

**Date :** 28 octobre 2026 · **Branche :** `arena/ec8470d0-googlepress`
(base `main` = `d204e3c`, PR #5 fusionnée) · **Statut :** livré en PR, non fusionné.

## 1. Cadrage honnête

Les pages `/connexion` et `/inscription` **existaient déjà** (lot accès
personnel, déployées en production) et fonctionnaient avec Supabase Auth.
Ce lot est donc une **refonte visuelle et UX** selon la direction artistique
demandée (composition deux panneaux inspirée du modèle Magnific
« Modèle de page d'inscription au site Web »), **sans réécriture du système
d'authentification**.

Le rendu exact du modèle Magnific n'a pas pu être vérifié visuellement
(page accessible en texte seul depuis l'environnement de travail). La
direction écrite du prompt a été suivie ; aucune reproduction « pixel par
pixel » n'est revendiquée.

## 2. Diagnostic initial (étape A)

Existant confirmé par lecture du code et baseline verte (`tsc --noEmit` OK,
68 tests unitaires OK avant modification) :

- Routes `/connexion`, `/inscription`, `/bienvenue` hors `AppProvider`,
  lazy-loading, rewrites Vercel ; destination post-connexion selon les
  memberships actifs (`resolveStaffPostAuthPath`) ; confirmation e-mail
  respectée avec écran dédié ; erreurs en français sans énumération de
  comptes (`mapStaffAuthError`).
- Inscription déjà dotée de : nom complet (transmis en métadonnées Auth →
  `profiles.display_name` rempli par le trigger serveur `handle_new_user`),
  e-mail, téléphone optionnel, mot de passe + confirmation.
- Autorité serveur : garde ERP session + membership, RLS et RPC
  (`create_my_organization`). **Aucun changement SQL dans ce lot.**

Écarts traités : habillage emprunté à l'espace client (bleu/zinc, panneau
centré), titres demandés absents, pas d'indicateur de robustesse, pas
d'icônes de champs côté personnel, pas d'acceptation des conditions
(aucune page légale n'existait).

## 3. Direction artistique appliquée

- **Composition deux panneaux** dans une carte arrondie centrée : marque à
  gauche (tablette `0,85fr`, bureau `1,02fr`), formulaire blanc à droite.
  Sur mobile, le panneau devient un bandeau orange compact au-dessus du
  formulaire, affiché en priorité ; aucun défilement horizontal.
- **Palette du prompt** : orange `#F97316` → `#EA580C` (panneau marque),
  violet profond `#24113D`/`#352052` (titres, textes d'accent), fond
  `#F8FAFC`, texte `#171923`, secondaire `#64748B`, bordures `#E2E8F0`
  (slate-200). Ajustement d'accessibilité documenté : le bouton principal
  utilise l'orange-700 `#C2410C` (blanc dessus ≈ 4,9:1) car le blanc sur
  `#F97316` (≈ 3,3:1) ne respecte pas WCAG AA en petit texte ; l'orange vif
  reste réservé aux grandes surfaces et aux grands titres.
- **Illustration originale en SVG intégré** (machine à laver, cintre et
  chemise, linge plié, bulles) : aucune image distante, aucun fichier
  binaire ajouté. Trois cartes blanches de fonctions réelles du produit
  (réception/tickets, atelier tracé, caisse espèces + mobile money) —
  aucune métrique inventée.
- Mode sombre conservé (variantes `dark:` sur le panneau formulaire).

## 4. Modifications par fichier

| Fichier | Changement |
|---|---|
| `src/lib/staffAuth.ts` | Chemins légaux (`/conditions`, `/confidentialite`) + `parseLegalRoute` ; `getPasswordStrength` (score 0–4 + libellé FR) ; `acceptTerms` exigé dans `validateStaffRegistration` |
| `src/components/auth/StaffAuthLayout.tsx` (nouveau) | Layout deux panneaux, panneau de marque + illustration SVG, `StaffTextField` (icône), `StaffPasswordField` (cadenas + œil), `PasswordStrengthMeter`, classes bouton/input dédiées personnel |
| `src/components/auth/StaffAuthCommon.tsx` | Socle partagé conservé (garde + onboarding intacts), palette rafraîchie (fond `#F8FAFC`, accent orange-700, titres violets) |
| `src/components/auth/StaffLoginPage.tsx` | Nouveau layout ; titre « Heureux de vous retrouver » ; lien « Mot de passe oublié ? » ; logique Supabase inchangée |
| `src/components/auth/StaffRegisterPage.tsx` | Nouveau layout ; titre « Créez votre espace professionnel » ; jauge de robustesse ; case d'acceptation avec liens légaux ; logique Supabase inchangée |
| `src/components/auth/LegalPage.tsx` (nouveau) | Conditions d'utilisation et politique de confidentialité — contenu **provisoire signalé comme tel**, décrivant le fonctionnement réel, à finaliser par l'exploitant |
| `src/App.tsx` | Route paresseuse des pages légales (hors `AppProvider`) |
| `vercel.json` | Rewrites `/conditions` et `/confidentialite` |
| `tests/unit/staffAuth.test.ts` | +5 tests (conditions, robustesse ×2, routes légales ×2) |
| `tests/e2e/smoke.spec.ts` | Nouveaux titres + case conditions ; nouveau test pages légales |

L'espace client (`/client/*`) n'est pas touché : ses classes partagées
bleues ne sont plus utilisées par les pages du personnel.

## 5. Sécurité — ce qui est préservé

- Aucune clé `service_role`, aucun secret ; seules les variables publiques
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (déjà documentées dans
  `.env.example`, aucune nouvelle variable).
- Aucun mot de passe journalisé ni stocké ; les champs sont vidés après
  soumission (comportement existant conservé).
- Compte ≠ accès métier : l'inscription ne crée aucune organisation ni
  aucun rôle ; l'ERP exige toujours session + membership actif, et la
  création d'organisation passe par la RPC serveur contrôlée.
- Redirections post-authentification internes uniquement (`/` ou
  `/bienvenue` selon les memberships relus côté base).
- La case « conditions » est un contrôle d'expérience : elle ne remplace
  aucune vérification serveur (il n'y en a pas à ce stade pour les CGU).

## 6. Vérifications exécutées

| Contrôle | Résultat |
|---|---|
| Baseline avant modification (`lint`, `test:unit`) | RÉUSSI |
| `npm run lint` (TypeScript strict) | RÉUSSI |
| `npm run test:coverage` | RÉUSSI — 73/73 tests (10 fichiers) ; couverture globale 79,62 % instructions / 71,46 % branches / 81,71 % fonctions / 82,26 % lignes ; `staffAuth.ts` 98,78 % |
| `npm run build` | RÉUSSI — entrée 381,36 kB ; chunks paresseux : `StaffAuthLayout` 9,78 kB, `StaffLoginPage` 5,08 kB, `StaffRegisterPage` 6,27 kB, `LegalPage` 8,85 kB |
| `npx playwright test --list` | RÉUSSI — 9 tests découverts (1 nouveau : pages légales) |
| Playwright local | BLOQUÉ — Chromium absent du bac à sable ; exécution par la CI de la PR |
| Serveur de développement (port 3000) | RÉUSSI — HTTP 200 sur `/connexion`, `/inscription`, `/bienvenue`, `/conditions`, `/confidentialite` ; modules transformés sans erreur. Sans variables Supabase locales, les formulaires affichent l'alerte « non configuré » (comportement prévu) |
| `npm run test:phase0` | NON EXÉCUTÉ — aucune modification SQL dans ce lot (suite PGlite inchangée : 56/56 au lot précédent) |
| CI GitHub Actions | À constater sur la PR (runs consignés après ouverture) |

## 7. Critères d'acceptation du prompt

| Critère | Statut | Preuve / réserve |
|---|---|---|
| Deux routes accessibles | RÉUSSI | Dev 200 + e2e ; production après fusion de la PR |
| Direction artistique définie | RÉUSSI | Specs écrites appliquées ; modèle source non vérifiable visuellement (déclaré) |
| Cohérence bureau/tablette/mobile | NON VÉRIFIÉ (visuel) | Grilles responsive en place (`md:`/`lg:`, bandeau mobile) ; pas de capture possible localement — recette visuelle à faire sur l'aperçu |
| Formulaires ↔ Supabase réels | RÉUSSI | Code d'auth inchangé, déjà en production ; aucun compte de test créé dans ce lot |
| Erreurs et succès gérés | RÉUSSI | Existant + nouvelle validation « conditions » testée |
| Aucun privilège métier automatique | RÉUSSI | Inchangé (RLS/RPC, redirection par memberships) |
| Protections de routes non affaiblies | RÉUSSI | Garde, RLS et SQL intacts |
| Tests pertinents | RÉUSSI (unitaires) / CI (navigateur) | 73/73 locaux ; 9 e2e listés, exécutés par la CI |
| TypeScript, lint, build | RÉUSSI | Voir §6 |
| Aucun secret exposé | RÉUSSI | Aucune variable ajoutée |
| Migrations/config documentées | RÉUSSI | Aucune migration requise ; rewrites versionnées |

## 8. Reste à faire (hors de ce lot)

1. Fusionner la PR pour déployer le nouveau design en production.
2. Recette visuelle réelle (mobile ~390 px, tablette ~1024 px) sur
   l'environnement déployé.
3. Finaliser juridiquement les textes `/conditions` et `/confidentialite`
   (aujourd'hui provisoires et signalés comme tels).
4. SMTP de production (déjà identifié) pour des e-mails de confirmation
   fiables.
