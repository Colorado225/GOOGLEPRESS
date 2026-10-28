# Blanchisserie au forfait (nombre de vêtements)

Le modèle « blanchisserie au kilo » et son catalogue de pièces ont été
supprimés. La blanchisserie se vend désormais **au nombre de vêtements**, selon
une grille définie à l'avance dans les Paramètres.

## Les trois prestations

| Prestation | Facturation par défaut |
| --- | --- |
| **Lavage simple** | Forfait : N vêtements pour un prix fixe |
| **Lavage + repassage** | Forfait : N vêtements pour un prix fixe |
| **Repassage** | Au vêtement, au prix réglé dans les Paramètres |

Chaque prestation peut être basculée « au vêtement » dans les Paramètres (la
case *Facturer au vêtement*), auquel cas sa colonne de forfait n'est plus
utilisée.

## Où se règle la grille

**Paramètres → Prestations** (`src/components/settings/BlanchisserieSettingsSection.tsx`) :

- un tableau de **paliers** : nombre de vêtements × prix de chaque prestation
  au forfait — par exemple 10 / 20 / 30 vêtements ;
- le **prix du vêtement** pour chacune des trois prestations ; pour le lavage
  et le lavage + repassage il sert aux vêtements qui dépassent les forfaits,
  pour le repassage il constitue le tarif ;
- un **aperçu** immédiat (« 20 vêtements — Lavage + repassage = 5 000 FCFA »)
  avant d'enregistrer.

Rien n'est prérempli sur un espace réel : sans grille, le comptoir affiche
« La grille blanchisserie n'est pas encore définie » et propose d'ouvrir les
Paramètres. Seule la démonstration locale part avec une grille d'exemple.

## Comment le prix est calculé

`calculateBlanchisserieQuote` (`src/lib/blanchisserie.ts`) :

1. pour une prestation **au vêtement** : `nombre de vêtements × prix unitaire` ;
2. pour une prestation **au forfait** : on prend le plus gros palier possible,
   puis on recommence sur le reste ; les vêtements qui ne remplissent plus
   aucun palier sont facturés au **prix du vêtement supplémentaire**.

Exemples avec la grille 10 / 20 / 30 vêtements (3 000 / 5 000 / 6 500 FCFA) et
un vêtement supplémentaire à 500 FCFA :

| Vêtements déposés | Décomposition | Total |
| --- | --- | --- |
| 20 | 1 forfait de 20 | 5 000 |
| 25 | 1 forfait de 20 + 5 vêtements | 7 500 |
| 40 | 1 forfait de 30 + 1 forfait de 10 | 6 500 |
| 18 | 1 forfait de 10 + 8 vêtements | 7 000 |

La décomposition est **prévisible** (plus gros palier d'abord) et non « la moins
chère possible » : le caissier peut l'expliquer au client. Si la grille ne
permet pas de couvrir exactement un nombre de vêtements (aucun palier utilisable
et pas de prix à l'unité), le comptoir refuse le calcul et renvoie vers les
Paramètres plutôt que d'inventer un montant.

## Dans le panier et sur les tickets

Un devis devient une ou plusieurs lignes de commande, chacune avec
`prix unitaire × quantité = sous-total`, ce qui correspond exactement à la
formule de tarification du serveur :

- `1 × Forfait 20 vêtements — Lavage + repassage` → 5 000 ;
- `5 × Vêtements supplémentaires — Lavage + repassage` → 2 500.

Les lignes portent aussi le nombre de vêtements couverts (`garments`) et la
nature du bloc (`pricingBasis`), si bien que :

- le ticket compte les **vêtements** réels dans son récapitulatif, pas les
  blocs de forfait ;
- le récapitulatif de commande affiche « 1 forfait » ou « 5 vêtements ».

## Ce qui a disparu

- l'article « Linge au kilo » et la pesée au comptoir ;
- les articles de catalogue blanchisserie (draps, serviettes, couettes…) ;
- les cinq anciens libellés de traitement (« Blanchisserie complète »,
  « Lavage désinfectant », « Repassage calandre », « Lavage au kilo »,
  « Express 24h »), remplacés par les trois prestations ;
- le chemin `pricingType: 'kilo'` dans l'écran de vente (le type reste lu pour
  afficher d'éventuelles commandes historiques).

## Catalogue Supabase

`buildBlanchisserieCatalogEntries` produit, à partir de la même grille, les
lignes de `service_catalog_items` nécessaires pour que la RPC `create_order`
sache tarifer : un article `unit` par forfait (`unit_label = 'forfait'`, prix du
forfait) et un article au vêtement par prestation à l'unité. Les clés sont
stables (`bf:wash_iron:20`, `bf:iron_only:unit`) : régénérer la grille met à
jour les mêmes lignes.

Limite actuelle, à traiter au branchement des commandes distantes : la grille
elle-même est enregistrée avec les autres paramètres de la boutique, encore
locaux, et `createRemoteOrder` n'est pas encore appelé par le POS. La
génération des lignes de catalogue est donc prête et testée, mais pas encore
déclenchée vers Supabase.

## Vérifications effectuées

```bash
npx tsc --noEmit   # aucune erreur
npm run test:unit  # 173 tests / 17 fichiers (dont tests/unit/blanchisserie.test.ts : 20 tests)
npm run build      # build de production OK
```

Rendus serveur (harnais Vite SSR) :

- démonstration : les trois prestations sont proposées, deux marquées « Au
  forfait », le repassage « Au vêtement », devis 20 vêtements = 5 000 FCFA,
  aucune mention de kilo ;
- écran Paramètres : colonnes de prix par prestation, paliers 10/20/30, aperçu
  « 1 forfait de 20 vêtements » ;
- espace réel sans grille : message d'invitation à définir la grille, aucun
  montant affiché.

Non vérifié ici : la saisie réelle au clavier/souris dans un navigateur (pas de
Chromium dans l'environnement de travail). Les tests Playwright tournent en CI.
