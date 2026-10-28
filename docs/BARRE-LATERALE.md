# Barre latérale : mise en page, réorganisation et abonnement

## Occupation de tout l'espace

La barre latérale est désormais une colonne pleine hauteur :

- l'en-tête (enseigne) reste fixe en haut ;
- la navigation occupe **tout l'espace libre** (`flex-1 min-h-0`) et devient la
  seule zone défilante ;
- le bloc bas (plan d'abonnement, raccourcis, profil) reste ancré en bas.

Auparavant, c'est la barre entière qui défilait et le contenu s'accumulait vers
le haut, laissant un grand vide au milieu. Chaque entrée porte maintenant un
identifiant stable (`dashboard`, `pos`, `workshop:production`, …) au lieu d'une
position, ce qui permet de la déplacer sans casser sa cible.

## Groupe « Production & Remise » et sous-onglets

L'atelier n'occupe plus quatre lignes de même niveau. « Production & Remise »
est désormais **un onglet principal** dont les écrans de l'atelier sont les
**sous-onglets** :

| Sous-onglet | Onglet réel de l'atelier |
|---|---|
| Production | `production` |
| Rangement atelier | `storage` |
| Remises & Livraisons | `logistics` |
| Caisse & Clôture | `cash` |

Comportement :

- un clic sur la ligne principale ouvre l'atelier **sans perdre l'onglet en
  cours** (on ne retombe pas systématiquement sur Production) ;
- le chevron, bouton distinct, déplie ou replie les sous-onglets sans naviguer ;
- l'état déplié est mémorisé par organisation
  (`pressingpro_sidebar_group_workshop`) ;
- arriver sur l'atelier par un autre chemin (F3, carte du tableau de bord,
  lien des Paramètres) déplie automatiquement le groupe ;
- le sous-onglet affiché est surligné, y compris quand l'onglet est changé
  ailleurs (par exemple depuis une carte Kanban « Prêts ») : l'onglet courant
  vit dans le contexte de l'application, plus dans un état local de l'écran ;
- les badges du groupe et de « Rangement atelier » / « Remises & Livraisons »
  restent des compteurs réels calculés sur les commandes et tournées.

La définition des sous-onglets vit dans `src/lib/workshopNav.ts` (et non dans le
composant) : une entrée ne peut donc pas pointer vers un onglet inexistant, et
la structure est testée.

### Animation et fluidité

- **Dépliage sans mesure** : la hauteur s'anime via une grille passant de
  `grid-rows-[0fr]` à `grid-rows-[1fr]`, avec
  `transition-[grid-template-rows,opacity]` — fluide quel que soit le nombre de
  sous-onglets, sans calcul JavaScript.
- **Cascade** : chaque sous-onglet apparaît avec un délai de 35 ms cumulé et un
  léger glissement vertical.
- **Chevron** : rotation de 180° en 300 ms.
- **Repère d'onglet actif** : barre bleue qui se déploie en largeur (3 px) au
  lieu d'apparaître brutalement.
- **Survol** : translation horizontale de 0,5 et mise à l'échelle de l'icône.
- Toutes les transitions sont annulées automatiquement par la règle globale
  `prefers-reduced-motion: reduce` déjà présente dans `index.css`.

### Accessibilité

- le chevron porte `aria-expanded` et `aria-controls` vers le panneau ;
- le panneau est un `role="group"` étiqueté ;
- replié, les sous-onglets sont retirés de l'ordre de tabulation
  (`tabIndex={-1}`) ;
- l'entrée active porte `aria-current="page"` ;
- les libellés du chevron ne répètent pas « Production & Remise », pour rester
  sans ambiguïté au lecteur d'écran et dans les tests.

## Réorganisation des entrées

| Méthode | Geste |
|---|---|
| Souris | Glisser une entrée par sa poignée (six points, visible au survol) et la déposer sur une autre |
| Clavier | Sur une entrée focalisée : `Alt + ↑` / `Alt + ↓` |
| Retour à l'ordre d'origine | Bouton **Réinitialiser**, affiché uniquement quand l'ordre a été modifié |

Principes :

- l'ordre est **mémorisé par organisation** (`pressingpro_workspace_<org>__pressingpro_sidebar_order`),
  donc deux comptes du même navigateur ne se marchent pas dessus ;
- une entrée ajoutée dans une version future apparaît **automatiquement en fin
  de liste**, sans réinitialiser le choix de l'utilisateur ;
- une entrée retirée est ignorée silencieusement ;
- une sauvegarde illisible ne vide jamais la navigation : l'ordre par défaut
  est restauré ;
- un bandeau `aria-live` annonce chaque déplacement (« Stocks déplacé en
  position 9. ») pour les lecteurs d'écran ;
- le glisser-déposer est désactivé quand la barre est repliée (icônes seules).

Les fonctions sont pures et testées (`src/lib/sidebarLayout.ts`,
`tests/unit/sidebarLayout.test.ts`) : fusion avec les entrées disponibles,
déplacements bornés, réordonnancement, détection de personnalisation, lecture
défensive du stockage.

## Carte « Plan d'abonnement »

Un composant dédié (`src/components/layout/SubscriptionPlanCard.tsx`) est placé
**juste avant le widget des raccourcis**. Il affiche :

- la formule (`Formule Découverte`, `Standard`, `Pro`) ;
- un badge de statut (`essai`, `actif`, `suspendu`) et son libellé complet ;
- un bouton **Gérer la formule** qui ouvre les Paramètres ;
- une variante icône seule lorsque la barre est repliée.

### Ce que la carte n'invente pas

Aucune facturation n'existe encore côté serveur. La carte affiche donc un état
réel et vérifiable :

- un compte réel démarre en **Formule Découverte / Essai — sans facturation** ;
- la démonstration locale affiche **Formule Pro / essai**, jamais « Abonnement
  actif » ;
- aucune date d'échéance ni aucun quota n'est affiché tant qu'ils ne sont pas
  enregistrés (`renewsOn` vaut `null` par défaut).

L'état est une préférence locale (`pressingpro_subscription`, préfixée par
l'organisation) validée à la lecture : une valeur douteuse retombe sur le
défaut. Le jour où Supabase portera les abonnements, seule la source de
`resolveSubscriptionState` changera — l'affichage restera identique.

## Vérifications

- `npx tsc --noEmit` : OK ;
- `npm run test:unit` : 138 tests réussis, dont 32 sur la barre latérale
  (`sidebarLayout` : fusion, migration des anciennes clés, bornes,
  réordonnancement, lectures défensives ; `subscription` ; `workshopNav` :
  structure des sous-onglets, clés uniques, cible valide, onglet actif) ;
- `npm run build` : OK ;
- rendu serveur contrôlé : 9 entrées de premier niveau + 4 sous-onglets,
  `aria-expanded`/`aria-controls` câblés, `role="group"`, classes d'animation
  de grille, chevron pivoté, délais en cascade 0/35/70/105 ms ; état replié
  relu depuis le stockage avec `tabIndex=-1` sur les quatre sous-onglets ;
  carte d'abonnement toujours **avant** les raccourcis et le profil.

**Non vérifié ici** : la manipulation réelle à la souris dans un navigateur
(aucun navigateur disponible dans cet environnement) ; les tests Playwright de
la CI couvrent le rendu de la barre, pas le glisser-déposer.
