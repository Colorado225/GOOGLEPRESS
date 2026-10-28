# Plan backend multi-postes — PressingPro CI

> **Statut : document de cadrage à valider. Aucun code backend n'a été écrit.**
> Objectif : passer d'une application mono-navigateur (localStorage) à une
> application partagée entre plusieurs postes (comptoir, atelier, gérance),
> sans changer les écrans ni les règles métier actuelles.

---

## 1. État actuel (point de départ réel)

| Aspect | Aujourd'hui |
|---|---|
| Interface | React + Vite + Tailwind, 64 composants, PWA installable (hors ligne pour l'interface) |
| Couche données | Un seul contexte `src/context/AppContext.tsx` (1 130 lignes) : tous les écrans passent par lui |
| Stockage | `localStorage` du navigateur — **13 clés** `pressingpro_*` |
| Collections métier (11) | `orders`, `customers`, `cash_register`, `employees`, `attendance`, `inventory_products`, `stock_movements`, `expenses`, `expense_categories`, `next_ticket_number`, `shop_settings` |
| Préférences par appareil (2) | `pressingpro_theme`, `pressingpro_custom_colors` (restent locales) |
| Écritures critiques | Numérotation séquentielle des tickets ; `recordStockMovement` = seul chemin de modification des quantités de stock |
| Règles métier | Centralisées (`lib/pricing.ts`, `lib/dates.ts`, `lib/inventory.ts`…) et testées |

**Limites à lever** : un seul navigateur voit les données ; aucune sauvegarde
externe ; aucun compte utilisateur ni traçabilité individuelle ; si le poste
tombe en panne, les données sont perdues.

**Atout décisif** : comme toute l'application lit/écrit via `AppContext`,
on peut remplacer *l'implémentation* du contexte (localStorage → Supabase)
**sans modifier les écrans**. C'est la stratégie de tout ce plan.

## 2. Architecture cible

```
Poste comptoir (POS) ─┐
Poste atelier (Kanban) ┼─ HTTPS ─► Supabase (projet « Pressing_Pro », eu-west-1)
Poste/tablette gérance┘            ├─ PostgreSQL 17 (données ci-dessous)
                                   ├─ Auth (comptes employés, JWT)
                                   ├─ Row Level Security (règles d'accès par rôle)
                                   └─ Realtime (mises à jour entre postes)
Interface hébergée sur Vercel (build Vite actuel, inchangé)
```

- **Supabase** fournit base + authentification + temps réel sans serveur à administrer.
- Un projet **« Pressing_Pro »** (région eu-west-1, PostgreSQL 17, état sain)
  **existe déjà** sur le compte connecté — le plan propose de le réutiliser
  après vérification de son contenu.
- **Vercel** sert l'application statique (même `npm run build`), HTTPS natif —
  la PWA existante devient pleinement exploitable (installation + hors ligne).

## 3. Modèle de données (PostgreSQL)

Une table par collection actuelle, colonnes fidèles aux types TypeScript
existants (`src/types/index.ts`), plus systématiquement : `id`, `shop_id`
(prépare un futur multi-boutiques sans l'imposer), `created_at`, `updated_at`,
`created_by` (traçabilité). Les **identifiants actuels sont conservés** lors
de la migration (colonnes texte) pour garder la traçabilité des tickets.

| Table | Points d'attention |
|---|---|
| `shops` | 1 ligne au départ (`shop_settings` y est rattaché ou table dédiée) |
| `profiles` | Lien compte Auth ↔ employé ; `role` : `admin` (gérance) / `caisse` / `atelier` |
| `customers` | Index recherche nom/téléphone |
| `orders` | Lignes de commande en **JSONB** en v1 (fidèle au modèle actuel, lecture atomique d'une commande) ; table `order_lines` possible en v2 si besoin de statistiques par article |
| `ticket_counter` + fonction `next_ticket_number()` | **Atomique** (`UPDATE … RETURNING`) : deux postes ne peuvent jamais obtenir le même numéro |
| `cash_register` (+ historique des clôtures Z) | État du jour + table `cash_closings` pour l'historique |
| `employees` | Identité RH ; le compte de connexion est séparé (`profiles`) |
| `attendance_records` | **Contrainte unique** `(employee_id, date)` — déjà la règle métier actuelle |
| `products` | Quantité jamais modifiée directement (voir mouvements) |
| `stock_movements` | Fonction SQL transactionnelle `record_stock_movement()` : calcule `quantity_before/after`, **refuse toute sortie sous zéro**, met à jour le produit dans la même transaction |
| `expense_categories`, `expenses` | Dépenses `cancelled` exclues des totaux via vues SQL alignées sur `reports.ts` |
| `shop_settings` | 1 ligne par boutique (identité pour ticket/rapports) |

**Défense en profondeur** : les règles déjà testées côté client
(totaux, seuils, exclusions) restent ; le serveur ajoute
des garde-fous indépendants (contraintes uniques, fonctions atomiques,
RLS). Même si un poste contourne l'interface, la base reste cohérente.

## 4. Comptes, rôles et sécurité (Supabase Auth + RLS)

- **Un compte par personne** (recommandé pour la traçabilité : chaque
  écriture porte `created_by`), ou par poste en variante simplifiée —
  décision demandée §10.
- **Rôles** :
  - `admin` (gérance) : tout, y compris Paramètres, Dépenses, rapports financiers, gestion des comptes ;
  - `caisse` : commandes, clients, caisse, présences en lecture ;
  - `atelier` : commandes (production/remises), stocks en consultation + mouvements autorisés ; pas d'accès Dépenses/Rapports financiers.
- **Row Level Security** activée sur toutes les tables : un utilisateur ne
  voit que les lignes de sa boutique (`shop_id`) et dans les limites de son
  rôle. Aucune donnée ne transite sans jeton valide.
- Mots de passe gérés par Supabase Auth (hachage, réinitialisation par
  e-mail). Sessions longues sur les postes de la boutique ; déconnexion
  manuelle ; option ultérieure : verrouillage rapide par code PIN entre
  utilisateurs d'un même poste.
- Données personnelles (clients, employés) hébergées en **UE (eu-west-1)** ;
  penser à l'information des personnes conformément à la loi ivoirienne
  n°2013-450 sur la protection des données personnelles.

## 5. Temps réel et gestion des conflits

- Abonnements Supabase Realtime (`postgres_changes`) sur `orders`,
  `stock_movements`/`products`, `attendance_records`… : une commande créée
  au comptoir apparaît sur le Kanban de l'atelier en ~1 s ; une remise
  validée à l'atelier met à jour la caisse.
- **Conflits** : les opérations critiques sont atomiques côté serveur
  (numéro de ticket, mouvement de stock) donc sans conflit possible.
  Pour les fiches (client, employé, produit), règle « dernier qui écrit
  gagne » appuyée sur `updated_at` — suffisant à l'échelle d'une boutique.
- Indicateur d'état de connexion dans l'en-tête (en ligne / reconnexion).

## 6. Hors ligne : stratégie en deux temps

1. **V1 (ce plan)** : écriture en ligne uniquement. La PWA continue de
   servir l'interface hors ligne, mais la création de commande exige la
   connexion (le numéro de ticket doit être unique et central).
2. **Option chiffrée séparément** : file d'écritures locale au comptoir
   (outbox) avec numéros provisoires réconciliés à la reconnexion.
   C'est le poste le plus complexe du multi-postes ; à n'engager que si
   les coupures réseau de la boutique le justifient.

## 7. Migration des données existantes

1. Ajout d'un **bouton d'export JSON** dans les Paramètres (lit les 11 clés
   métier du navigateur actuel, produit un fichier unique).
2. **Script d'import** (exécuté une fois, avec la clé `service_role`) :
   insertion en conservant les identifiants actuels, compteur de tickets
   initialisé à `max(ticket) + 1`, identité boutique reprise.
3. **Recette de contrôle** avant bascule : nombre de lignes par table,
   total des dépenses hors annulées, total des commandes, stock par
   produit = dernier `quantity_after` — mêmes contrôles que ceux déjà
   automatisés côté front (41 vérifications).
4. **Bascule** un jour de fermeture : gel des saisies locales → import →
   contrôles → tous les postes passent sur la version connectée.
   L'ancien mode local reste présent derrière un interrupteur pendant une
   phase de transition (retour arrière possible sans perte, tant qu'aucune
   écriture distante n'a divergé).

## 8. Déploiement

- **Front** : projet Vercel lié au dépôt GitHub ; `npm run build` inchangé ;
  variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` ; chaque
  branche Git = un aperçu automatique (utile pour valider chaque phase).
- **Base** : projet Supabase existant « Pressing_Pro » (à confirmer) ;
  schéma géré par **migrations SQL versionnées** dans le dépôt.
- **Coûts indicatifs** (à confirmer au moment du lancement) : démarrage
  possible en offres gratuites (Supabase Free, Vercel Hobby) pour une
  boutique ; prévoir ~20–25 $/mois par service en formule « Pro » si usage
  commercial confirmé, sauvegardes avancées ou volume en croissance.

## 9. Étapes et effort (ordres de grandeur, en sessions de travail)

| Phase | Contenu | Jalon de validation | Effort estimé |
|---|---|---|---|
| 0 | Fondations : projet cible confirmé, schéma SQL v1, RLS de base, comptes de test | Base interrogeable, schéma relu ensemble | 1–2 sessions |
| 1 | Couche données : client Supabase, AppContext rebranché (11 collections), compteur atomique, fonction SQL stock | L'app fonctionne à l'identique, données distantes, 1 poste | 3–4 sessions |
| 2 | Authentification : écran de connexion, profils, rôles + RLS fine, `created_by` | Chaque rôle ne voit/fait que ce qui lui est permis | ~2 sessions |
| 3 | Temps réel : abonnements, indicateur de connexion, tests à 2 navigateurs | Comptoir ↔ atelier synchronisés en direct | ~2 sessions |
| 4 | Migration + recette : export/import, contrôles comptables, bascule | Totaux avant/après identiques, go/no-go | 1–2 sessions |
| 5 | Durcissement (à la carte) : sauvegardes et supervision, file hors ligne POS, guide d'exploitation, formation | Exploitation sereine documentée | selon options |

Chaque phase est livrable et validable séparément, comme les chantiers
précédents. Les estimations excluent vos temps de validation et les
éventuels allers-retours de cadrage.

## 10. Risques, alternatives écartées, décisions demandées

**Risques principaux** : connexion internet de la boutique instable
(mitigation : 4G de secours, option hors ligne §6) ; adoption des comptes
par le personnel (sessions longues, PIN en option) ; coûts récurrents
modestes mais réels ; dépendance à Supabase (atténuée : PostgreSQL
standard, schéma portable, exports possibles à tout moment).

**Alternatives écartées** : Firebase (modèle NoSQL mal adapté aux
rapports relationnels et aux contraintes) ; backend Node sur mesure
(administration et sécurité à notre charge) ; statu quo localStorage
(ne répond pas au besoin multi-postes).

**Décisions demandées avant la phase 0** :

1. Feu vert global sur ce plan ?
2. Projet Supabase cible : le projet existant « Pressing_Pro » (eu-west-1) ?
3. Comptes **par personne** (recommandé, traçabilité) ou **par poste** ?
4. Mono-boutique en v1 avec `shop_id` prévu partout (recommandé) ?
5. Hors ligne POS : v1 en ligne uniquement (recommandé) ou exigé d'emblée ?
6. Démarrage en offres gratuites, passage « Pro » seulement si besoin ?
7. Jour de bascule envisagé (fermeture) et personne qui validera la recette §7 ?

---

*Document rédigé le 28 octobre 2026, sur la base du code livré
(branches à jour : pagination, paramètres persistants, catalogue 100 % IA).
Aucun élément backend n'existe encore dans le dépôt : ce plan est le
point de départ de la phase 0.*
