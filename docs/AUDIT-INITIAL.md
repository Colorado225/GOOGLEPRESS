# Audit initial — GOOGLEPRESS / PressingPro CI

> **Date : 28 octobre 2026**
> **Branche de travail : `arena/ac6f461c-googlepress`**
> **Commit inspecté : `8d77b75e10342f9105488db408f003bd0d4f695e`**
> (`Merge pull request #4 from Colorado225/arena/7c1ae4d6-googlepress`)
>
> Ce rapport décrit l’état réel du dépôt avant les corrections du présent
> chantier. Il distingue les faits vérifiés dans le code, les résultats
> d’exécution et les points encore bloqués par l’environnement ou par
> l’absence de tenant réel.

## 1. Résumé exécutif

PressingPro CI possède déjà une base plus solide qu’un prototype purement
local :

- un ERP React/TypeScript complet pour le comptoir, l’atelier, les clients,
  la logistique, les stocks, les dépenses, les rapports et les paramètres ;
- un schéma Supabase multi-tenant avec organisations, agences, memberships,
  rôles, RLS activée et forcée, historique de commandes et RPC de transition ;
- un espace client séparé, relié à Supabase Auth, qui ne donne accès aux
  commandes qu’après liaison vérifiée par le pressing ;
- une sauvegarde locale chiffrée, des tests unitaires ciblés, une suite
  PGlite/RLS et une CI GitHub Actions.

En revanche, l’application **n’est pas encore exploitable comme système de
production multi-poste** :

1. les écrans métier de l’ERP restent accessibles sans session du personnel ;
2. les données historiques de l’ERP ont pour source de vérité le
   `localStorage` du navigateur courant et démarrent avec un jeu de
   démonstration ;
3. la caisse locale repose sur des compteurs incrémentés, sans journal de
   paiements, sans remboursement traçable et avec MTN MoMo/Orange Money
   fusionnés dans un même compteur ;
4. Supabase ne contient encore ni tenant, ni utilisateur, ni commande réelle ;
5. la création distante n’a pas encore de RPC `create_order` calculant les
   tarifs côté serveur avec idempotence ;
6. les en-têtes HTTP de sécurité ne sont pas définis et trois prototypes HTML
   publics inutilisés chargent des scripts externes.

La stratégie correcte reste donc une migration progressive, domaine par
domaine, sans reconstruire les écrans existants.

## 2. Périmètre inspecté

Ont été examinés notamment :

- `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts` ;
- `vercel.json`, `.env.example`, `playwright.config.ts`, `vitest.config.ts` ;
- `.github/workflows/ci.yml` ;
- `src/App.tsx`, `src/context/AppContext.tsx`, les composants par domaine,
  les helpers `src/lib/*`, le client Supabase et les pages client/personnel ;
- les six migrations locales de `supabase/migrations/` ;
- les tables, contraintes, index, triggers, fonctions et politiques RLS ;
- `supabase/tests/phase0/fixtures.sql` et
  `supabase/tests/phase0/run-isolation-pglite.mjs` ;
- les tests Vitest et Playwright ;
- les documents `docs/PLAN-BACKEND.md`,
  `docs/RISQUES-ET-FAIBLESSES.md` et les rapports Phase 0 ;
- l’état hébergé du projet Supabase Pressing_Pro via les outils de gestion.

Des recherches ciblées ont porté sur `localStorage.setItem`, `Math.random`,
les constantes de démonstration, les appels `supabase.from/rpc/auth`, les
fonctions `SECURITY DEFINER`, les montants et les références aux prototypes
publics.

## 3. Cartographie technique au commit inspecté

### 3.1 Frontend

- React 19, TypeScript, Vite 8, Tailwind CSS 4 et lucide-react.
- `src/App.tsx` sépare uniquement :
  - l’espace client `/client/...`, hors contexte local ;
  - l’ERP, monté sans garde d’authentification du personnel.
- `src/context/AppContext.tsx` compte **2 297 lignes** et compose la
  navigation, le POS, les commandes, la production, le rangement, la
  logistique, les clients, la caisse, le personnel, les stocks, les dépenses
  et les paramètres.
- Les écrans ERP sont importés statiquement ; aucun `React.lazy` n’est utilisé
  dans `App.tsx`.
- Le build de référence produit un JavaScript principal de
  **1 052,64 kB** (**296,40 kB gzip**) et déclenche l’avertissement Vite de
  chunk supérieur à 500 kB.
- Une sonde `npx tsc --noEmit --strict` réussit déjà sans erreur, bien que
  `strict` ne soit pas encore écrit dans `tsconfig.json`.

### 3.2 Sources de vérité actuelles

| Domaine | Source de vérité effective | État |
|---|---|---|
| Commandes créées au POS | `localStorage` (`pressingpro_orders`) | Mono-navigateur, démonstration au premier lancement |
| Clientes ERP | `localStorage` | Mono-navigateur |
| Caisse et clôture Z locale | `localStorage` + compteurs | Pas de journal financier |
| Tournées, rangement, personnel, stocks, dépenses | `localStorage` | Données de démonstration possibles |
| Paramètres boutique et préférences | `localStorage` | Acceptable temporairement pour les préférences, pas pour les réglages partagés |
| Commandes déjà présentes dans Supabase | Supabase/PostgreSQL + RLS + Realtime | Lecture et transitions seulement |
| Comptes clientes | Supabase Auth + `profiles` | Inscription publique encore fermée |
| Commandes clientes | Supabase, seulement après `customer_account_links` vérifié | Aucun tenant réel |

`src/lib/localPersistence.ts` centralise déjà une partie des lectures/écritures
JSON, mais `AppContext.tsx` et `ColorPicker.tsx` conservent des appels directs
à `localStorage`.

### 3.3 Cycle de commande

#### Parcours local

1. Le POS construit les lignes et appelle `calculateOrderTotals`.
2. `AppContext.submitNewOrder` attribue le numéro depuis un compteur
   `localStorage` propre au navigateur.
3. La commande est ajoutée à l’état React, puis persistée localement.
4. L’acompte incrémente directement les compteurs de caisse.
5. Le reste dû incrémente directement le solde de la cliente.
6. La remise/livraison décrémente le solde et incrémente la caisse.

Ce parcours est cohérent dans un seul navigateur, mais deux postes peuvent
attribuer le même numéro, diverger ou écraser leurs réalités respectives. Il
n’existe pas de transaction couvrant commande + paiement + caisse + solde.

#### Parcours distant déjà présent

- `public.orders` possède une unicité `(shop_id, ticket_number)`.
- `ticket_counters` est incrémenté par un trigger atomique.
- `order_events` journalise les transitions.
- `public.transition_order_status` verrouille la commande, contrôle le rôle,
  l’étape attendue et refuse les sauts ou la remise générique.
- Les mises à jour directes de `status`, `ready_at` et `delivered_at` ont déjà
  été révoquées pour `authenticated`.
- Il n’existe pas encore de RPC distante de création ni de branchement POS.

### 3.4 Tarifs et montants locaux

`src/lib/pricing.ts` est bien le point de calcul central :

- sous-total des lignes ;
- express à +50 % du sous-total ;
- remise fidélité sur les prestations uniquement ;
- frais de ramassage/livraison assainis séparément ;
- acompte plafonné au total.

Mais au commit inspecté :

- `loyaltyDiscountPercent` n’est pas borné entre 0 et 100 ;
- un pourcentage supérieur à 100 peut rendre le total négatif ;
- un sous-total ou un acompte `NaN`/infini peut produire un montant non
  fiable ;
- la base Supabase borne bien `customers.loyalty_discount_percent`, mais ne
  recalcule pas encore une commande créée directement.

### 3.5 Caisse et paiements au commit inspecté

L’ERP local met à jour directement :

- `cashAmount` pour les espèces ;
- `waveAmount` pour Wave ;
- `momoAmount` pour `momo` **et** `om`, donc sans séparer MTN Mobile Money et
  Orange Money ;
- `totalAmount` ;
- le solde de la cliente.

Il n’existe :

- ni ligne de paiement persistée ;
- ni référence fournisseur ;
- ni statut confirmé/en attente/échoué ;
- ni contre-passation/remboursement auditable ;
- ni protection serveur contre un double encaissement rejoué.

La base Phase 0 possède `cash_register_days`, mais sous forme d’agrégats
journaliers modifiables par les rôles caisse. Elle ne possède pas de table
`payments` au commit inspecté.

### 3.6 Identité, rôles et RLS

Le schéma contient déjà :

- `profiles`, `platform_admins`, `organizations`, `shops`, `memberships` et
  `invitations` ;
- les rôles `organization_owner`, `shop_manager`, `cashier`, `workshop` et
  `courier` ;
- les helpers `private.has_shop_access`,
  `private.has_organization_access`, `private.is_customer_linked`, etc. ;
- des fonctions `SECURITY DEFINER` avec `search_path` explicite ;
- 37 tables hébergées et 89 politiques au moment du contrôle.

L’espace client est correctement séparé de l’ERP. En revanche :

- la session Supabase du personnel n’existe que dans **Paramètres → Backend**
  et dans le panneau de suivi distant ;
- elle ne protège ni le tableau de bord, ni le POS, ni les Paramètres, ni les
  données locales ;
- l’ERP n’affiche pas encore l’identité/rôle serveur comme frontière
  d’accès ;
- aucun compte ou membership réel n’existe pour tester un verrouillage
  complet sans bloquer le pilote.

### 3.7 État hébergé Pressing_Pro

Contrôle effectué le 28 octobre 2026 sur `phjstsydxvggtduohfrl` :

| Élément | Résultat |
|---|---:|
| Tables publiques | 37 |
| Politiques publiques | 89 |
| Utilisateurs Auth | 0 |
| Organisations | 0 |
| Agences | 0 |
| Memberships | 0 |
| Clientes CRM | 0 |
| Commandes | 0 |
| Journées de caisse | 0 |
| Table `payments` | absente |
| RPC `create_order` | absente |
| RPC `transition_order_status` | présente |

Les sept migrations distantes vont de
`20261028094204_phase0_remove_legacy_pressingpro` à
`20261028124739_customer_registration_profile`.

Configuration Auth constatée, inchangée pendant cet audit :

- e-mail/mot de passe activé ;
- téléphone désactivé ;
- inscription publique désactivée (`disable_signup=true`) ;
- confirmation e-mail requise, sans SMTP personnalisé ;
- captcha désactivé ;
- longueur minimale serveur du mot de passe : 6 ;
- domaine de production et `localhost:3000` autorisés.

## 4. Résultats de référence réellement exécutés

### 4.1 Installation

```bash
npm ci
```

Résultat : **réussi**, 96 paquets ajoutés, audit initial `found 0
vulnerabilities`. Node `v22.22.3`, npm `10.9.8`.

### 4.2 TypeScript

```bash
npm run lint
npx tsc --noEmit --strict
```

Résultats :

- `npm run lint` : **réussi** ;
- sonde `--strict` : **réussie, 0 erreur**. Le risque n’est donc pas un
  chantier de correction massive, mais l’absence d’engagement permanent dans
  `tsconfig.json`.

### 4.3 Tests unitaires et couverture

```bash
npm run test:coverage
```

Résultat : **48/48 tests réussis**.

Couverture du périmètre configuré :

- instructions : 78,21 % ;
- branches : 68,93 % ;
- fonctions : 80,79 % ;
- lignes : 81,00 %.

Ces chiffres ne couvrent que les bibliothèques explicitement listées dans
`vitest.config.ts`, pas tout le frontend.

### 4.4 Tests Supabase locaux

```bash
npm run test:phase0
```

Résultat : **29/29 vérifications PGlite réussies**, dont isolation
multi-tenant, RLS, compteur de tickets, RPC de transition et profil
d’inscription.

Limite : PGlite ne prouve ni les vrais jetons HTTP, ni Realtime, ni la
concurrence réelle entre connexions PostgreSQL.

### 4.5 Build de production

```bash
npm run build
```

Résultat : **réussi**, avec avertissement de chunk principal supérieur à
500 kB.

### 4.6 Playwright local

```bash
npx playwright test --list
npm run test:e2e
```

Résultats :

- compilation/listing : **7 tests** ;
- exécution locale : **échec d’environnement** avant les assertions, car
  l’exécutable Chromium est absent de
  `/home/user/.cache/ms-playwright/.../chrome-headless-shell` ;
- aucun échec fonctionnel navigateur local n’est donc déduit de cette
  tentative. La CI du commit `8d77b75` avait déjà exécuté ces parcours, mais
  ce rapport ne substitue pas ce résultat historique à une nouvelle
  exécution.

### 4.7 Dépendances

```bash
npm audit --omit=dev --audit-level=moderate
```

Résultat : **0 vulnérabilité** signalée sur le périmètre audité.

### 4.8 Recherche de secrets évidents

Une recherche par motifs dans les fichiers suivis n’a pas mis en évidence de
clé privée ou de jeton évident. Les occurrences de `service_role` sont des
rôles/grants SQL, de la documentation ou des avertissements de configuration.
Ce contrôle ne remplace ni un scan complet de l’historique Git ni GitHub
Secret Scanning.

## 5. Constats classés par sévérité

### Critiques

#### C1 — ERP accessible sans authentification du personnel

- **Preuve :** `src/App.tsx` rend `AppProvider`/`MainLayout` pour tout chemin
  hors `/client`, sans session ni membership.
- **Impact :** toute personne ayant l’URL peut ouvrir les écrans et manipuler
  les données présentes dans le navigateur.
- **Nuance :** les données Supabase restent protégées par RLS ; le risque
  immédiat porte sur l’ERP local et sur une future bascule mal gardée.
- **Correction requise :** garde personnel Supabase + membership actif, après
  création contrôlée du premier tenant et des comptes.

#### C2 — Données métier mono-navigateur et démonstration par défaut

- **Preuve :** `AppContext` initialise commandes, clientes, caisse, personnel,
  stocks, dépenses et tournées depuis `INITIAL_*` lorsque le stockage est
  absent.
- **Impact :** pas de synchronisation multi-poste, risque de présenter des
  montants fictifs comme réels, perte en cas d’effacement du navigateur.
- **Atténuation existante :** mentions de démonstration et sauvegarde locale
  chiffrée manuelle.
- **Correction requise :** Supabase source de vérité domaine par domaine ;
  production vide explicite ; démonstration uniquement sur scénario dédié.

#### C3 — Argent représenté par des compteurs mutables

- **Preuve :** création/remise/livraison incrémentent `cashRegister` et le
  solde cliente dans `AppContext` ; aucune table `payments` distante.
- **Impact :** double comptage, correction silencieuse, rapprochement par
  fournisseur impossible, surtout MTN/Orange fusionnés.
- **Correction requise :** journal `payments` immuable par RPC, idempotence,
  remboursements par écritures liées et totaux recalculés.

#### C4 — Création distante encore contournable et non recalculée

- **Preuve :** `authenticated` possède encore `INSERT` sur `orders` et peut
  modifier `deposit_paid_xof`/`payment_method` selon les grants Phase 0.
- **Atténuation existante :** RLS par agence, ticket imposé par trigger et
  contraintes relationnelles.
- **Risque :** un employé autorisé à créer peut soumettre des totaux qui ne
  correspondent ni au catalogue ni aux règles de remise.
- **Correction requise :** RPC `create_order` transactionnelle, catalogue
  serveur, idempotence et révocation des écritures directes sensibles.

### Élevés

#### H1 — Remise et montants locaux insuffisamment bornés

`calculateOrderTotals` ne borne pas `loyaltyDiscountPercent` et ne protège pas
tous les nombres non finis. Une donnée importée ou corrompue peut produire un
total négatif ou `NaN`.

#### H2 — Numérotation locale non sûre entre appareils

Le compteur local évite les réutilisations dans un navigateur, mais deux
postes peuvent produire le même ticket. Le mécanisme distant est déjà sûr ;
le POS ne l’utilise pas encore.

#### H3 — Aucun tenant ni compte de validation réel

La RLS et les RPC sont testées avec des fixtures locales. Les tests HTTP avec
vrais jetons, Realtime entre deux appareils et le parcours complet restent
bloqués par l’absence d’identité réelle du pressing pilote.

#### H4 — En-têtes de production absents et prototypes publics

- `vercel.json` ne contient que des rewrites `/client`.
- `public/assets/aistudio/*.html` contient trois prototypes non référencés
  par le code, qui chargent Tailwind CDN, Google Fonts et un script de
  challenge tiers.
- Aucune CSP, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, protection d’iframe ni HSTS n’est déclarée.

#### H5 — Clôture distante non rapprochable à ce stade

`cash_register_days` stocke des totaux sans lien avec des écritures. Une
clôture ne peut pas être prouvée à partir des paiements tant que le journal
n’existe pas.

### Moyens

#### M1 — `strict` absent de la configuration

La sonde stricte passe déjà ; il faut figer ce niveau dans `tsconfig.json`
pour éviter toute régression silencieuse.

#### M2 — `AppContext` volumineux et couplé

Le fichier de 2 297 lignes concentre état UI, persistance et transitions. Une
extraction précipitée serait risquée ; elle doit suivre les repositories par
domaine.

#### M3 — Bundle principal unique

Le JavaScript de 1,05 MB confirme l’intérêt d’un découpage par écran après
les garanties d’intégrité, avec mesure avant/après.

#### M4 — Identifiants fondés sur `Math.random`

`createLocalId`, une clôture locale et le suffixe de canal Realtime utilisent
`Math.random`. Ce ne sont pas des secrets, mais les identifiants uniques
doivent privilégier `crypto.randomUUID`/les UUID PostgreSQL.

#### M5 — Contournements de la persistance centralisée

Les états commandes/clientes/caisse/compteur et les couleurs personnalisées
utilisent encore directement `localStorage`, même si les erreurs sont
globalement interceptées.

#### M6 — Couverture E2E encore limitée

Les sept smoke tests protègent des parcours visibles et l’état non configuré,
mais pas la connexion personnel, les rôles, la création distante,
l’encaissement ou une clôture avec de vrais jetons.

#### M7 — Points PostgreSQL à retraiter lors du prochain lot

Les rapports précédents signalent des index de clés étrangères manquants et
des appels `auth.uid()` non factorisés dans certaines politiques. Ils doivent
être revérifiés par requête catalogue sur la base cible avant de créer une
migration de performance.

## 6. Vérification des hypothèses de l’audit précédent

| Hypothèse | Verdict | Preuve synthétique |
|---|---|---|
| Absence d’authentification ERP | **Confirmée** | ERP monté sans garde ; session seulement optionnelle dans Paramètres/Suivi distant |
| Supabase Auth totalement absent | **Infirmée** | Auth cliente complète + session personnel dans le panneau Backend |
| Dépendance à `localStorage` | **Confirmée** | Tous les domaines historiques de l’ERP |
| Données de démonstration par défaut | **Confirmée** | Constantes `INITIAL_*` au premier lancement |
| Caisse par compteurs | **Confirmée** | Incréments `AppContext`, pas de `payments` |
| Risque concurrent de tickets | **Confirmé côté local, traité côté DB** | Compteur navigateur contre trigger/contrainte Supabase |
| TypeScript sans `strict` | **Confirmée dans la config** | Mais `tsc --strict` passe déjà |
| Contexte central volumineux | **Confirmée** | 2 297 lignes |
| Pas de découpage dynamique | **Confirmée** | Imports statiques et chunk 1,05 MB |
| Remise susceptible d’erreur | **Confirmée** | Pourcentage non borné dans `pricing.ts` |
| En-têtes incomplets | **Confirmée** | Aucun header dans `vercel.json` |
| Prototypes publics inutiles | **Confirmée** | Aucune référence applicative trouvée |
| Tests critiques insuffisants | **Confirmée partiellement** | Bons tests unitaires/PGlite, E2E authentifiés absents |

## 7. Plan de correction priorisé

### Lot 1 — Durcissements immédiats sans bascule métier

- activer `strict` dans TypeScript ;
- borner remises, lignes, frais et acomptes dans `pricing.ts` + tests ;
- remplacer les identifiants `Math.random` par des UUID cryptographiques ;
- centraliser les derniers accès `localStorage` non critiques ;
- ajouter les en-têtes Vercel adaptés à Supabase/Google Fonts/PWA ;
- retirer les prototypes publics inutilisés ;
- documenter et tester chaque changement.

### Lot 2 — Garanties serveur commandes et paiements

- ajouter l’idempotence aux commandes ;
- créer la table `payments` avec RLS et lecture seule API ;
- créer `create_order` recalculant depuis le catalogue serveur ;
- créer `record_order_payment` et `refund_order_payment` idempotentes ;
- recalculer `deposit_paid_xof` depuis les écritures confirmées ;
- révoquer l’insertion directe de commandes et la modification directe des
  montants encaissés ;
- étendre PGlite aux rôles interdits, doublons, remboursements excessifs et
  erreurs transactionnelles.

### Lot 3 — Tenant, personnel et garde ERP

- obtenir l’identité réelle du premier pressing et de son propriétaire ;
- créer organisation, agence, compte et membership sans mot de passe codé en
  dur ;
- ajouter la garde des écrans ERP par session + membership actif ;
- exécuter les tests HTTP avec vrais jetons et la recette deux appareils.

### Lot 4 — Bascule des domaines

- brancher le POS sur `create_order`, puis les paiements et la caisse ;
- synchroniser clientes, catalogue, paramètres et autres domaines ;
- supprimer les doubles écritures locales au fur et à mesure ;
- empêcher la démonstration en production après validation des états vides.

### Lot 5 — Performance et refactor

- extraire les domaines d’`AppContext` derrière les repositories ;
- découper les écrans lourds avec `React.lazy`/`Suspense` ;
- mesurer le bundle avant/après ;
- étendre les E2E authentifiés et les seuils de couverture.

## 8. Limitations de cet audit initial

- Chromium local absent : assertions Playwright non exécutées dans ce bac à
  sable.
- Aucun tenant/compte réel : tests HTTP avec jetons et Realtime réel non
  vérifiés.
- Aucune nouvelle migration n’avait encore été appliquée à Pressing_Pro au
  moment de ce diagnostic.
- La recherche de secrets est un contrôle par motifs, pas un audit complet de
  tout l’historique Git.
- Les performances SQL des politiques et les index manquants doivent être
  confirmés par les catalogues PostgreSQL et les advisors de l’environnement
  cible.

## 9. Conclusion de la Phase 0

Le projet ne doit pas être réécrit. Ses écrans, ses règles locales
centralisées, son schéma multi-tenant et sa RPC de transition sont des acquis.
Les corrections doivent maintenant fermer, dans l’ordre, les failles
d’intégrité financière, les écritures directes sensibles et l’absence de garde
du personnel, tout en gardant un chemin de migration testable depuis l’ERP
local actuel.
