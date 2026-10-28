# Routes de l'application — carte par contexte et workflow

**Date :** 28 octobre 2026 · **Branche :** `arena/ec8470d0-googlepress`
(lot ajouté à la PR #7, non fusionné).

## 1. Pourquoi ce lot

Avant ce lot, seuls les contextes publics avaient de vraies URL ; les dix
écrans de l'ERP vivaient dans l'état React (`activeScreen`) : actualisation
= retour au tableau de bord, boutons Précédent/Suivant sans effet sur les
écrans, aucun lien profond, et toute adresse inconnue (ex. `/nimporte-quoi`)
tombait silencieusement dans l'ERP. Ce lot donne à chaque écran une URL
française stable, synchronisée dans les deux sens, sans changer ni les
écrans, ni la barre latérale, ni les raccourcis clavier.

## 2. Carte des routes par contexte d'implémentation

La précédence est centralisée dans `resolveAppRoute` (`src/lib/routes.ts`) :
espace client → pages légales → accès du personnel → ERP.

### Espace client (public, hors shell ERP) — inchangé

| Chemin | Écran |
|---|---|
| `/client` | Compte client (commandes liées vérifiées) |
| `/client/connexion` | Connexion client |
| `/client/inscription` | Inscription client |
| `/client/nouveau-mot-de-passe` | Réinitialisation du mot de passe |
| `/espace-client/*` | Alias hérité, redirigé vers `/client/*` (canonicalisation existante) |
| autre sous-chemin `/client/…` | « Page introuvable » de l'espace client (existant) |

### Pages légales (publiques, statiques) — lot précédent

| Chemin | Écran |
|---|---|
| `/conditions` | Conditions d'utilisation (provisoires) |
| `/confidentialite` | Politique de confidentialité (provisoire) |

### Accès du personnel (public, hors `AppProvider`) — inchangé

| Chemin | Écran |
|---|---|
| `/connexion` | Connexion du personnel (+ mot de passe oublié) |
| `/inscription` | Création d'un compte propriétaire |
| `/bienvenue` | Onboarding : création de l'organisation et de la première agence (session sans rattachement) |

### ERP connecté (derrière `StaffAccessGate`) — nouveau dans ce lot

Ordre = workflow d'un pressing : pilotage → réception du dépôt →
production → suivi des commandes → gestion.

| Chemin canonique | Écran (`ScreenId`) | Libellé |
|---|---|---|
| `/` (alias `/tableau-de-bord`) | `dashboard` | Tableau de bord |
| `/reception` | `pos` | Réception (POS) |
| `/atelier` | `workshop` | Production & Suivi |
| `/commandes` | `orders` | Commandes |
| `/clients` | `clients` | Clients |
| `/personnel` | `employees` | Personnel |
| `/stocks` | `inventory` | Stocks |
| `/depenses` | `expenses` | Dépenses |
| `/rapports` | `reports` | Rapports |
| `/parametres` | `settings` | Paramètres |
| tout autre chemin | — | « Page introuvable » dans le shell ERP, avec retour au tableau de bord |

Frontière assumée : les **sous-onglets** d'un écran (production /
rangement / livraisons / remises / caisse / suivi distant dans l'atelier ;
onglets des paramètres) restent des vues internes sans URL propre, comme
avant. « Caisse & Clôture » reste une action (fenêtre de clôture Z), pas un
écran.

## 3. Mécanique de synchronisation

`useErpRouteSync` (`src/components/layout/useErpRouteSync.ts`), monté dans
`MainLayout` :

- **URL → écran** au chargement (lien profond, actualisation) et sur
  `popstate` (Précédent/Suivant) ;
- **Écran → URL** quand `activeScreen` change par la navigation interne
  (barre latérale, raccourcis F1–F4/Alt+…, actions rapides) — `pushState`
  du chemin canonique, seulement si l'URL ne désigne pas déjà cet écran
  (alias compris, pour ne pas polluer l'historique) ;
- premier rendu et absorption d'une navigation navigateur protégés pour
  ne jamais réécrire l'adresse demandée (notamment une route inconnue) ;
- `document.title` suit l'écran (« Réception (POS) — PressingPro CI », …)
  et vaut « Page introuvable — PressingPro CI » sur la 404.

Aucune dépendance de routage ajoutée : le mécanisme manuel existant
(`pathname` + `history`) est conservé et étendu.

## 4. Retour après connexion (lien profond protégé)

Un visiteur non authentifié qui vise un écran ERP (ex. `/atelier`) est
redirigé par la garde vers `/connexion?retour=%2Fatelier`. Après connexion
réussie **avec un accès métier actif**, il est ramené sur cet écran.

Sécurité : le paramètre `retour` est validé par **liste blanche**
(`resolveStaffReturnPath`) — seuls les chemins canoniques des dix écrans
ERP sont acceptés ; URL absolue, `//domaine`, autre contexte
(`/client/…`), requête ou antislash sont rejetés et retombent sur `/`.
Aucune redirection ouverte n'est possible. Sans rattachement actif, la
destination reste l'onboarding `/bienvenue` (le `retour` est ignoré).

## 5. Production (Vercel)

`vercel.json` déclare les rewrites de chaque écran ERP (actualisation et
lien profond servis par `index.html`) puis un filet `/(.*)` final pour que
les chemins inconnus aboutissent aussi dans l'application (404 interne,
garde d'accès) plutôt que sur une erreur d'hébergeur. Les fichiers
statiques existants restent servis en priorité par Vercel.

## 6. Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/routes.ts` (nouveau) | Table ERP (workflow), parseurs, `resolveAppRoute`, retour post-connexion — fonctions pures |
| `src/components/layout/useErpRouteSync.ts` (nouveau) | Synchronisation URL ⇄ `activeScreen`, titre du document, état « introuvable » |
| `src/App.tsx` | Résolution de contexte via `resolveAppRoute` ; vue `ErpNotFound` dans le shell |
| `src/components/auth/StaffAccessGate.tsx` | Redirection connexion avec `?retour=` |
| `src/components/auth/StaffLoginPage.tsx` | Destination post-connexion tenant compte du retour validé |
| `vercel.json` | Rewrites des écrans ERP + filet SPA |
| `tests/unit/routes.test.ts` (nouveau) | 10 tests : parseurs, aller-retour canonique, contextes, anti-redirection ouverte |
| `tests/e2e/smoke.spec.ts` | Lien profond `/reception`, clic → `/atelier`, `goBack`, route inconnue → 404 → retour accueil |

## 7. Vérifications exécutées

| Contrôle | Résultat |
|---|---|
| Baseline avant modification (`lint`, `test:unit`) | RÉUSSI (73/73) |
| `npm run lint` (TypeScript strict) | RÉUSSI |
| `npm run test:coverage` | RÉUSSI — 83/83 tests (11 fichiers) ; couverture globale 80,63 % / 72,32 % / 82,70 % / 83,16 % ; `routes.ts` 100 % instructions et lignes |
| `npm run build` | RÉUSSI — entrée 380,80 kB |
| `npx playwright test --list` | RÉUSSI — 10 tests découverts (1 nouveau : routes ERP) |
| Playwright local | BLOQUÉ — Chromium absent du bac à sable ; exécution par la CI de la PR #7 |
| Serveur de développement (port 3000) | RÉUSSI — HTTP 200 sur les 10 chemins ERP + alias + route inconnue ; modules transformés sans erreur |
| CI GitHub Actions | À constater sur la PR #7 après poussée de ce lot |

Non vérifié à ce stade : le retour post-connexion de bout en bout avec un
vrai compte (aucun compte réel n'existe encore ; la logique est couverte
par tests unitaires et le flux de connexion lui-même est inchangé), et le
comportement des rewrites sur le déploiement Vercel réel (après fusion).

## 8. Limites et suites possibles

- Le titre du document des écrans ERP est désormais posé par la
  synchronisation ; les écrans de la garde (avant montage de l'ERP)
  gardent le titre statique de `index.html`.
- Sur une route inconnue, cliquer dans la barre latérale l'entrée de
  l'écran déjà actif en arrière-plan ne change rien (aucun changement
  d'état) : le bouton « Retour au tableau de bord » de la page 404 est la
  voie de sortie explicite.
- Suites naturelles si besoin : URL des sous-onglets atelier/paramètres,
  liens profonds avec paramètres (ex. ouvrir une commande précise) — à
  cadrer avec le branchement distant du POS.
