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
- `npm run test:unit` : 124 tests réussis, dont 18 nouveaux
  (`sidebarLayout` : fusion, bornes, réordonnancement, lectures défensives ;
  `subscription` : formules, états par défaut, validation, libellés) ;
- `npm run build` : OK ;
- rendu serveur contrôlé : 12 entrées `draggable`, poignées présentes, carte
  d'abonnement positionnée **avant** les raccourcis et le profil, ordre
  personnalisé relu depuis le stockage (première entrée « Paramètres »),
  bouton **Réinitialiser** absent à l'ordre par défaut et présent sinon.

**Non vérifié ici** : la manipulation réelle à la souris dans un navigateur
(aucun navigateur disponible dans cet environnement) ; les tests Playwright de
la CI couvrent le rendu de la barre, pas le glisser-déposer.
