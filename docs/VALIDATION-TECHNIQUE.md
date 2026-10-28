# GOOGLEPRESS / PressingPro CI — validation technique du 28 octobre 2026

## Environnement et point de départ

- Dépôt : `/home/user/GOOGLEPRESS`
- Branche : `arena/ac6f461c-googlepress`
- Base : `8d77b75e10342f9105488db408f003bd0d4f695e`
- Node.js : `v22.22.3`
- npm : `10.9.8`
- Installation de référence : `npm ci` — 96 paquets, 0 vulnérabilité signalée
  pendant l’installation de baseline.

Les statuts ci-dessous distinguent strictement une exécution réussie, un
échec de code et un blocage d’environnement.

## Commandes exécutées

| Commande | Résultat constaté | Statut |
|---|---|---|
| `npm run lint` | `tsc --noEmit` sans erreur, TypeScript strict activé | RÉUSSI |
| `npm run test:coverage` | 9 fichiers, 57/57 tests ; couverture des cœurs configurés : 77,62 % instructions, 68,96 % branches, 80,72 % fonctions, 80,50 % lignes | RÉUSSI |
| `npm run test:phase0` | 50/50 vérifications PGlite | RÉUSSI |
| `npm run gen:supabase-types` | 38 tables, 522 colonnes, 5 fonctions, 0 enum | RÉUSSI |
| `npm run build` | build Vite réussi, 1 850 modules transformés, aucun avertissement de chunk > 500 kB après découpage | RÉUSSI |
| `npm audit --omit=dev` | 0 vulnérabilité de production | RÉUSSI |
| `npx playwright test --list` | 7 tests découverts dans `tests/e2e/smoke.spec.ts` | RÉUSSI |
| `npm run test:e2e` | 7 échecs avant exécution applicative : exécutable Chromium absent sous `/home/user/.cache/ms-playwright/...` | BLOQUÉ |
| Recherche de motifs de secrets versionnés | aucun motif `SUPABASE_SERVICE_ROLE_KEY`, clé secrète ou clé privée détecté ; aucune variable `VITE_*` de secret | RÉUSSI |

La recherche de secrets est un contrôle par motifs sur l’arbre versionné, pas
un audit exhaustif de tout l’historique Git ni des tableaux de bord Vercel /
Supabase.

## Couverture unitaire

Le périmètre de couverture reste volontairement limité aux bibliothèques
listées dans `vitest.config.ts`. Il ne faut donc pas présenter ces pourcentages
comme la couverture de toute l’application React.

| Module | Instructions | Branches | Fonctions | Lignes |
|---|---:|---:|---:|---:|
| Tous les cœurs configurés | 77,62 % | 68,96 % | 80,72 % | 80,50 % |
| `pricing.ts` | 100 % | 100 % | 100 % | 100 % |
| `staffAccess.ts` | 88,46 % | 92,85 % | 75 % | 87,50 % |
| `localPersistence.ts` | 67,24 % | 56 % | 90 % | 74 % |

Les 57 tests incluent notamment :

- remise supérieure à 100 %, valeurs négatives et non finies ;
- persistance JSON/texte et identifiants locaux ;
- modes d’accès personnel production/développement/démonstration explicite ;
- seuls les memberships actifs avec rôle personnel connu ouvrent l’ERP.

## Validation base de données locale

La suite `supabase/tests/phase0/run-isolation-pglite.mjs` applique toutes les
migrations locales, y compris
`20261028150000_order_creation_payments.sql`, puis vérifie 50 scénarios.

### Faits mesurés

- 38 tables publiques ont la RLS activée et forcée.
- L’insertion directe d’une commande par `authenticated` est refusée.
- Dans le scénario de création, le navigateur envoie `unitPrice=1` pour une
  chemise dont le catalogue vaut 500 XOF. Le serveur retient 500 XOF :
  quantité 2, sous-total 1 000, remise fidélité 5 % = 50, total 950 et ticket
  `#TK-2`.
- La même clé d’idempotence et le même contenu renvoient la même commande ;
  un contenu différent est rejeté.
- Une remise explicite de 101 % est rejetée.
- Un ramassage à domicile sans adresse/date/créneau est rejeté.
- Deux références catalogue incohérentes sont rejetées.
- Un agent atelier ne peut ni créer la commande ni enregistrer un paiement.
- Un paiement Wave confirmé manuellement de 400 XOF donne un acompte de 400
  et un reste de 550 ; sa répétition idempotente ne double pas l’écriture.
- Un paiement dépassant le total est rejeté.
- Des métadonnées arbitraires du navigateur sont rejetées.
- Les écritures directes dans `payments` et la modification directe de
  `deposit_paid_xof` sont refusées.
- La cliente liée voit le paiement de sa commande, pas une autre cliente.
- Le caissier ne peut pas rembourser ; le propriétaire crée une
  contre-écriture de 100 XOF. L’acompte devient 300 et le reste 650.
- `get_payment_totals` renvoie pour Wave : brut 400, remboursements 100,
  net 300.

PGlite prouve la logique PostgreSQL/RLS locale. Il ne prouve ni PostgREST,
ni les jetons HTTP Supabase, ni la livraison Realtime entre appareils.

## Bundle de production

Mesures issues de la sortie Vite, fichiers minifiés :

| Mesure | Avant découpage, même arbre | Après découpage |
|---|---:|---:|
| JavaScript d’entrée | 1 055,80 kB | 375,27 kB |
| JavaScript d’entrée gzip | 297,22 kB | 114,59 kB |
| CSS principal | 108,77 kB | 108,81 kB |
| Avertissement chunk > 500 kB | Oui | Non |

Chunks notables après découpage :

- atelier : 155,60 kB ;
- POS : 92,96 kB ;
- paramètres : 56,05 kB ;
- portail client : 36,13 kB ;
- tableau de bord : 29,72 kB.

La baseline du commit `8d77b75` produisait déjà un JS principal de
1 052,64 kB (296,40 kB gzip). La comparaison ci-dessus utilise 1 055,80 kB
parce qu’elle a été mesurée immédiatement avant `React.lazy`, avec la garde
du personnel déjà ajoutée. Aucun temps réseau réel, Web Vital ou score
Lighthouse n’a été mesuré.

## Contrôles hébergés en lecture seule

Sur Pressing_Pro (`phjstsydxvggtduohfrl`) :

- santé des services : `ACTIVE_HEALTHY` ;
- dernière migration : `20261028124739_customer_registration_profile` ;
- compteurs : 0 utilisateur Auth, 0 organisation, 0 agence, 0 membership,
  0 cliente, 0 commande ;
- table `payments` : absente ;
- fonctions `create_order`, `record_order_payment`,
  `refund_order_payment`, `get_payment_totals` : absentes ;
- 16 fonctions `public`/`private` inspectées : aucune exécutable par `anon` ;
  les fonctions privilégiées existantes ont un `search_path` fixé à
  `private, pg_catalog` ;
- 89 politiques publiques ; 27 mentionnent `auth.uid()`, aucune sous la forme
  encapsulée `(select auth.uid())` recherchée ;
- 56 clés étrangères ne commencent pas par un index ayant exactement leurs
  colonnes en préfixe. Ce chiffre est un signal d’audit, pas une mesure de
  lenteur sur une base vide.

Aucune migration, donnée ou configuration hébergée n’a été modifiée pendant
cette validation.

## Ce que cette validation ne démontre pas

| Sujet | Statut | Raison |
|---|---|---|
| Connexion réelle d’un employé et refus par rôle avec jeton HTTP | NON VÉRIFIÉ | aucun compte/membership hébergé |
| Création POS distante de bout en bout | ÉCHOUÉ | POS non branché aux nouvelles RPC |
| Application du journal de paiements à Pressing_Pro | NON VÉRIFIÉ | migration locale seulement |
| Realtime sur deux appareils | NON VÉRIFIÉ | aucun tenant/commande hébergée |
| En-têtes HTTP sur le domaine déployé | NON VÉRIFIÉ | branche non déployée pendant la validation |
| Smoke tests navigateur de cette branche en local | BLOQUÉ | Chromium Playwright absent du bac à sable |
| Paiement Wave/Orange/MTN confirmé par le fournisseur | BLOQUÉ | aucune intégration/webhook fournisseur configurée |
| Performance SQL en charge | NON VÉRIFIÉ | base hébergée vide, aucun jeu représentatif ni `EXPLAIN` de charge |

## Revalidation minimale avant pilote

1. Appliquer la migration Lot 2 sur une copie ou après sauvegarde vérifiée.
2. Rejouer `test:phase0`, régénérer les types et comparer les catalogues
   hébergés : tables, politiques, grants, fonctions et publication Realtime.
3. Créer un tenant pilote et des comptes de chaque rôle ; tester les accès
   autorisés et refusés avec de vrais jetons.
4. Brancher le POS minimal et exécuter la recette comptoir → atelier →
   rangement → remise/livraison → solde sur deux appareils.
5. Exécuter Playwright dans la CI ou un environnement disposant de Chromium,
   puis vérifier les en-têtes sur l’URL de préproduction.
