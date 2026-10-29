# Prestations du pressing et type de service express

Deux notions distinctes, souvent confondues dans l'ancien écran « Articles &
Prestations » :

- le **type de prestation** (traitement) : ce qu'on fait au vêtement —
  lavage + repassage, nettoyage à sec, repassage seul, teinture… Il se règle
  dans les Paramètres, avec un prix par vêtement ;
- le **type de service** (délai) : **normal** ou **express 24 h**. Ce n'est pas
  un traitement : il s'applique à la commande entière et **double le montant
  des prestations**.

## Ce qui a changé au comptoir

| Avant | Après |
| --- | --- |
| Lavage + Repassage, **Pressing à sec**, Repassage seul, Teinture, **Express 24h** | Lavage + Repassage, **Nettoyage à sec**, Repassage seul, Teinture |

« Express 24h » a disparu de la liste des prestations : il reste proposé comme
délai de la commande (Standard 48 h / **Express 24 h** / différé), avec une
majoration de **100 %** au lieu de 50 %. Une commande express coûte donc le
double d'une commande normale :

```
total express = 2 × sous-total des prestations
              + frais de ramassage/livraison
              − remise fidélité (calculée sur les prestations)
```

Texte affiché dans le panier : « Type de service express 24h (×2) ».

## Où se règlent les prestations

**Paramètres → Prestations** propose deux volets : **Pressing** et
**Blanchisserie**.

Volet Pressing (`src/components/settings/PressingSettingsSection.tsx`) :

1. **Types de prestation** : liste éditable (renommer, ajouter jusqu'à 8,
   supprimer en gardant au moins une prestation). Les quatre traitements de
   départ sont Lavage + Repassage, Nettoyage à sec, Repassage seul, Teinture.
2. **Prix par vêtement** : un tableau vêtements × prestations (21 vêtements du
   catalogue × 4 prestations = 84 cases). La colonne « Base » rappelle le prix
   du catalogue.

**Une case laissée vide applique le prix de base du catalogue** (affiché en
gris dans la case). Aucun tarif n'est inventé : c'est le prix déjà en vigueur
qui continue de s'appliquer tant que le propriétaire ne saisit rien de
spécifique.

Techniquement : `shopSettings.pressing = { services, prices }`, où
`prices['<articleId>:<prestationId>']` contient le prix réglé.
`resolvePressingPrice` (`src/lib/pressing.ts`) renvoie ce prix s'il existe,
sinon `ClothingItem.unitPrice`.

## Effet au comptoir

- le filtre « traitement » de l'étape 2 est alimenté par la liste réglée ;
- le prix affiché sur chaque carte de vêtement **suit la prestation
  sélectionnée** (ex. Chemise : 1 500 en lavage + repassage, 4 000 si le
  nettoyage à sec a été fixé à 4 000) ;
- si une prestation est renommée ou supprimée, le filtre retombe sur la
  première prestation disponible au lieu de garder un libellé fantôme ;
- la ligne du panier conserve le libellé de la prestation et le prix appliqué.

## Catalogue Supabase

`buildPressingCatalogEntries` produit une ligne par vêtement et par prestation,
à clé stable (`pressing:<prestation>:<vêtement>`), avec le prix résolu. Elle
n'est pas encore synchronisée : les tarifs restent dans les paramètres locaux
de la boutique tant que le branchement des commandes distantes n'est pas fait.

## Vérifications effectuées

```bash
npx tsc --noEmit   # aucune erreur
npm run test:unit  # 188 tests / 18 fichiers (dont tests/unit/pressing.test.ts : 15)
npm run build      # build de production OK
```

Rendus serveur (harnais Vite SSR) :

- Paramètres → Prestations : les quatre traitements sont éditables, aucun champ
  « Express 24h » parmi les prestations, la note explique le doublement
  express, la matrice affiche 84 cases de prix avec le prix de base en
  indication ;
- comptoir : le filtre propose les quatre prestations réglées, sans express, et
  un prix fixé (chemise en nettoyage à sec à 4 000) s'affiche bien à la place
  du prix de base.

Test unitaire de tarification mis à jour : une commande express de 3 500 FCFA
de prestations donne 3 500 FCFA de majoration (total 7 150 avec 500 de course
et 350 de remise), au lieu de 1 750 auparavant.

Non vérifié ici : la saisie réelle dans un navigateur (pas de Chromium dans
l'environnement de travail) ; les tests Playwright tournent en CI.
