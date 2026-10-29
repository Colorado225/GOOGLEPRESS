# Pages de connexion et d’inscription — reprise intégrale (v2)

**Date :** 28 octobre 2026 · **Branche :** `arena/7aed267c-googlepress`
(base `main` = `cbd45e4`) · **Statut :** livré sur la branche, vérifications
locales ci-dessous, recette navigateur à confirmer par la CI et l’aperçu.

## 1. Point de départ réellement constaté

Les routes existaient (`/connexion`, `/inscription`, `/bienvenue`,
`/conditions`, `/confidentialite`, `/client/*`), mais l’état entrant du dépôt
n’était pas utilisable :

| Constat | Preuve dans le code entrant |
|---|---|
| Page de connexion au balisage interrompu | `StaffLoginPage.tsx` mélangeait deux versions : fragments `setMessage(null); setError(validationError); if (validationError) return;` rendus **en texte** dans le formulaire, `</div>` orphelins, en-tête `<p>` refermé après le bloc e-mail |
| Deux bandeaux contradictoires | `{configured && <StaffAuthAlert tone="success">…configuré</…>}` **et** `{configured && <…tone="error">…n’est pas configuré…</…>}` — le second s’affichait alors que la condition était inversée |
| Trois layouts concurrents | `StaffAuthLayout` (orange/violet), `StaffPremiumAuthLayout` (violet `#5145E5`, image distante), `CustomerAuthLayout` (bleu/zinc) — deux d’entre eux desservaient les mêmes pages |
| Aucune redirection après connexion | `signInWithPassword` réussissait puis affichait « Connexion réussie ! Redirection… » sans jamais naviguer |
| « Mot de passe oublié » sans effet | le basculement de vue ne déclenchait aucun `resetPasswordForEmail` ; aucun formulaire de nouveau mot de passe pour le personnel |
| Socle tronqué | `StaffAuthCommon.tsx` se terminait sur un commentaire dupliqué sans code ; un `StaffAuthCTAButton` mort et des textes publicitaires (`StaffAuthCTATexts`) n’étaient utilisés nulle part |
| Incohérence de chunk | la garde ERP (bundle d’entrée) importait le layout **client** pour ses champs de mot de passe |

`tsc --noEmit` passait malgré tout : les fragments de code étaient, du point de
vue du parseur JSX, du simple texte. C’est précisément ce qui rendait le défaut
invisible en intégration continue.

## 2. Principe retenu : un seul système d’accès

La refonte ne rapièce pas les trois layouts : elle les **remplace** par un
socle unique, découpé pour rester compatible avec le chargement paresseux des
pages publiques.

| Module | Rôle |
|---|---|
| `src/components/auth/AuthShell.tsx` | Composition de page (panneau de marque + formulaire), illustration SVG, en-tête, pieds de carte, liens et boutons |
| `src/components/auth/AuthFields.tsx` | `AuthTextField`, `AuthPasswordField`, jauge de robustesse : libellé lié, icône, aide, erreur, œil, Verr. Maj. |
| `src/components/auth/AuthAlert.tsx` | Bandeaux erreur / succès / avertissement / information (`role`, `aria-live`) |
| `src/components/auth/authStyles.ts` | Jetons de style des champs, libellés, liens et boutons, sans aucun composant |

Les anciens fichiers `StaffAuthLayout.tsx`, `StaffPremiumAuthLayout.tsx` et
`CustomerAuthLayout.tsx` sont **supprimés**. Les écrans déjà livrés (garde
d’accès, onboarding, mentions légales, Mon espace client) consomment les mêmes
jetons : l’accès du personnel et l’espace client ne divergent plus.

### Direction visuelle

- **Fond lin** `#F7F5F2` (mode clair) / `#07090F` (mode sombre), carte blanche
  (ou `#0B101B`) avec bord chaud `#E4DFD6`.
- **Panneau de marque encre** `#0B1220`, trame fine, halos colorés ; accent
  **ambre** pour le personnel, **turquoise** pour les clients. L’illustration
  (tambour de machine, cintre, linge plié / carte de suivi) est un **SVG
  original intégré** : aucune image distante, conforme à la CSP
  `img-src 'self' data: blob:`.
- **Action bleu** `#1D4ED8` (survol `#1E40AF`), reprise de la couleur d’action
  de l’ERP.
- Composition : une colonne sur mobile avec bandeau de marque compact, deux
  colonnes à partir de `md`, illustration affichée uniquement sur grand écran
  **et** hauteur ≥ 900 px — le formulaire reste visible sans défilement sur un
  portable.

### Contraste et accessibilité

| Élément | Couleurs | Ratio approx. |
|---|---|---|
| Bouton principal | `#1D4ED8` / blanc | 6,3:1 |
| Texte courant | `#111827` / blanc | 16,9:1 |
| Texte secondaire | `#5C6472` / blanc | 6,4:1 |
| Notes et mentions | `#6B665D` / `#F7F5F2` | 5,0:1 |
| Panneau sombre, description | blanc 65 % / `#0B1220` | 8,0:1 |
| Panneau sombre, mention | blanc 55 % / `#0B1220` | 6,2:1 |

- Tous les champs ont un `<label for>` explicite ; aide et erreur sont reliées
  par `aria-describedby`, l’erreur de champ porte `aria-invalid`.
- Bandeaux : `role="alert"` + `aria-live="assertive"` pour les erreurs,
  `role="status"` + `aria-live="polite"` sinon.
- L’œil du mot de passe est un `<button type="button">` avec `aria-pressed`
  et un libellé « Afficher / Masquer » ; l’avertissement Verr. Maj. apparaît à
  la frappe.
- Anneaux `focus-visible` sur tous les contrôles, `cursor-pointer` et
  réduction des animations déjà gérées globalement (`prefers-reduced-motion`).
- Les deux connexions principales n’ouvrent plus le clavier mobile d’office
  (`autoFocus` réservé aux vues « mot de passe oublié / nouveau mot de passe »).

## 3. Comportements livrés

### Personnel

| Vue | Comportement |
|---|---|
| `/connexion` | Validation locale (`validateStaffLogin`) **avant** tout appel réseau ; `signInWithPassword` ; lecture des memberships ; redirection vers `/` (ou l’écran demandé via `?retour=`, liste blanche) ou `/bienvenue` sans rôle actif. Session déjà ouverte : redirection immédiate sans ressaisie. |
| « Mot de passe oublié ? » | `resetPasswordForEmail` avec `redirectTo = <origine>/connexion` ; message neutre (pas d’énumération de comptes) ; renvoi possible ; retour à la connexion. |
| Lien de récupération | Détection `type=recovery` (URL) **et** événement `PASSWORD_RECOVERY` ; formulaire nouveau mot de passe + confirmation + jauge ; `updateUser` ; succès avec « Ouvrir mon espace » ou fermeture de la session. |
| `/inscription` | Nom, e-mail, téléphone facultatif, mot de passe + confirmation, jauge de robustesse, acceptation des CGU/politique (liens ouverts dans un onglet) ; `signUp` avec métadonnées `full_name` et `phone`. Session immédiate → `/bienvenue` ; sinon écran « Vérifiez votre adresse e-mail » avec **renvoi** du message de confirmation. |
| État non configuré | Bandeau explicite ; les formulaires restent consultables et la validation locale fonctionne ; l’envoi affiche une erreur nommée (« aucune vérification n’a été effectuée ») au lieu d’un clic silencieux. |

### Espace client

| Vue | Comportement |
|---|---|
| `/client/connexion` | Onglets Connexion / Inscription, connexion, « mot de passe oublié » avec `redirectTo` vers `/client/nouveau-mot-de-passe`, message neutre et renvoi ; lien vers l’espace professionnel. |
| `/client/inscription` | Nom, téléphone normalisé (`+225…`), e-mail, mot de passe + jauge, confirmation, attestation du numéro de dépôt ; métadonnées `full_name`, `phone_e164`, `account_type: customer` ; écran de confirmation avec renvoi de l’e-mail. |
| `/client/nouveau-mot-de-passe` | Session de récupération exigée ; sinon explication « lien expiré ou déjà utilisé » ; `updateUser` ; succès avec ouverture de Mon espace. |

Aucun parcours ne simule un succès : chaque message décrit ce qui s’est
réellement passé, y compris quand le service n’est pas configuré.

## 4. Fichiers

**Créés**

- `src/components/auth/AuthShell.tsx`
- `src/components/auth/AuthFields.tsx`
- `src/components/auth/AuthAlert.tsx`
- `src/components/auth/authStyles.ts`
- `src/lib/passwordStrength.ts`

**Réécrits**

- `src/components/auth/StaffLoginPage.tsx`
- `src/components/auth/StaffRegisterPage.tsx`
- `src/components/auth/StaffAuthCommon.tsx`
- `src/components/customer/CustomerLoginPage.tsx`
- `src/components/customer/CustomerRegisterPage.tsx`
- `src/components/customer/CustomerPasswordResetPage.tsx`

**Adaptés**

- `src/lib/staffAuth.ts` (réexport de la jauge, `validateStaffLogin`)
- `src/components/auth/StaffAccessGate.tsx`, `StaffOnboardingPage.tsx`
  (imports des primitives partagées, plus aucun layout client)
- `src/components/customer/CustomerPortalApp.tsx`,
  `CustomerAccountPage.tsx` (bandeaux et classes partagés)
- `src/components/auth/LegalPage.tsx` (palette alignée)
- `tests/e2e/smoke.spec.ts`, `tests/unit/staffAuth.test.ts`,
  `tests/unit/customerAuth.test.ts`

**Supprimés**

- `src/components/auth/StaffAuthLayout.tsx`
- `src/components/auth/StaffPremiumAuthLayout.tsx`
- `src/components/customer/CustomerAuthLayout.tsx`

Aucune route, aucune migration SQL et aucune variable d’environnement n’est
ajoutée.

## 5. Sécurité — invariants préservés

- Aucune clé `service_role` ni secret : seules `VITE_SUPABASE_URL` et la clé
  publique existantes.
- Aucun mot de passe journalisé ni conservé en état après envoi.
- Les redirections post-authentification restent internes : `/`, `/bienvenue`,
  ou un écran ERP validé par liste blanche (`resolveStaffReturnPath`).
- Créer un compte ne donne aucun rôle métier : la garde exige session +
  membership actif, et la création d’organisation passe par la RPC serveur.
- Le message de réinitialisation est identique que le compte existe ou non.
- La validation côté navigateur reste un confort : la RLS, les RPC et la
  configuration Supabase demeurent l’autorité.

## 6. Vérifications exécutées

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | **RÉUSSI** |
| `npm run test:unit` | **RÉUSSI** — 87/87 tests, 11 fichiers (dont 2 nouveaux blocs : `validateStaffLogin`, jauge partagée) |
| `npm run build` | **RÉUSSI** — entrée **316,35 kB** (94,57 kB gzip) contre 392,05 kB à l’entrée de lot ; chunks paresseux `AuthShell` 18,69 kB, `StaffLoginPage` 9,44 kB, `StaffRegisterPage` 6,97 kB |
| Modules transformés (serveur de dev) | **RÉUSSI** — 15 modules d’accès servis sans erreur de transformation |
| Routes servies | **RÉUSSI** — HTTP 200 sur `/connexion`, `/inscription`, `/bienvenue`, `/conditions`, `/confidentialite`, `/client/connexion`, `/client/inscription`, `/client/nouveau-mot-de-passe` |
| Rendu structurel (SSR ponctuel via Vite, hors production) | **RÉUSSI** — 6 écrans rendus sans exception ; libellés liés (`for`/`id`), aucun fragment de code affiché, textes conformes |
| `npx playwright test --list` | **RÉUSSI** — 11 tests découverts (dont 1 nouveau : absence de défilement horizontal en 390 px sur les 4 pages d’accès) |
| Playwright local | **NON EXÉCUTÉ** — Chromium absent du bac à sable, téléchargement bloqué par le réseau |
| CI GitHub Actions (run `40755102071`) | **RÉUSSI** — « Lint, tests et build » et « Smoke tests navigateur » : **11/11** tests Chromium au vert |
| `npm run test:phase0` | **NON EXÉCUTÉ en local** — aucune modification SQL ; exécuté avec succès par la CI (PGlite) |
| Recette visuelle (captures) | **NON FAITE** — aucun navigateur dans cet environnement ; à valider sur l’aperçu (390 px, 768 px, 1440 px, clair et sombre) |

## 7. Critères d’acceptation

| Critère | Statut | Preuve / réserve |
|---|---|---|
| Pages de connexion et d’inscription utilisables | RÉUSSI (code) | Validation locale, appels Supabase, écrans de confirmation ; recette serveur à faire avec un vrai compte |
| Connexion et inscription pour les deux espaces | RÉUSSI | 6 vues + nouveau mot de passe client et personnel |
| Design unifié et original | RÉUSSI | Une seule composition, deux accents d’audience, SVG intégrés |
| Responsive sans débordement | RÉUSSI (structure) | Grilles, `overflow-hidden`, test e2e 390 px fourni ; contrôle visuel à faire |
| Accessibilité de base | RÉUSSI | Labels, `aria-describedby`, `aria-live`, focus visibles, contrastes documentés |
| Aucun privilège automatique | RÉUSSI | Garde, memberships, RLS inchangés |
| Aucune régression de routes | RÉUSSI | `vercel.json` inchangé ; 8 URLs en 200 |
| Tests à jour | RÉUSSI | 87/87 unitaires ; 11/11 e2e dans la CI (run `40755102071`) |
| TypeScript et build | RÉUSSI | Voir §6 |
| Aucun secret exposé | RÉUSSI | Aucune variable ajoutée |

## 8. Limites et reste à faire

1. **Recette visuelle réelle** (mobile 390 px, tablette 768 px, bureau
   1440 px, clair/sombre) sur l’aperçu ou l’environnement déployé.
2. **Redirect URLs Supabase** : le lien de réinitialisation du personnel
   renvoie vers `/connexion`. Cette URL doit figurer dans les *Redirect URLs*
   du projet (comme `/client/nouveau-mot-de-passe`), sinon Supabase refuse
   l’envoi et la page affiche l’erreur traduite.
3. **SMTP de production** et anti-abus (captcha) avant ouverture commerciale ;
   sans SMTP fiable, les e-mails de confirmation et de réinitialisation ne
   partiront pas.
4. **Alignement serveur du mot de passe** : l’interface impose 8 caractères,
   le projet Supabase en autorise encore 6 ; relever le minimum serveur.
5. **Textes juridiques** `/conditions` et `/confidentialite` toujours
   provisoires, signalés comme tels.
6. **Compte de recette** : aucune inscription réelle n’a été tentée ici ; la
   preuve de bout en bout (confirmation, connexion, réinitialisation, liaison
   par le pressing) reste à faire avec un compte de test.
7. **CI** : verte au commit `b236019` (run `40755102071`) — lint, tests
   unitaires, PGlite, build et 11 smoke tests navigateur. Le premier run du lot
   (`40754729655`) a d’ailleurs révélé une ambiguïté de sélecteur entre le lien
   légal du formulaire et celui du pied de page ; elle est corrigée et couverte
   par le run vert.
