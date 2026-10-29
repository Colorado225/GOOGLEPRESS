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

« Express 24h » a disparu de la liste des prestations : il se règle comme
**délai propre à chaque article**, avec une majoration de **100 %** au lieu de
50 %. Une ligne Express coûte donc le double de la même ligne au délai Normal,
sans modifier les autres lignes du panier :

```
total = sous-total de toutes les lignes
      + sous-total des seules lignes Express
      + frais de ramassage/livraison
      − remise fidélité (calculée sur les prestations)
```

Texte affiché dans le panier : « Supplément Express 24h — lignes sélectionnées (×2) ».

## Où se règlent les prestations

**Paramètres → Prestations** propose deux volets : **Pressing** et
**Blanchisserie**.

Volet Pressing (`src/components/settings/PressingSettingsSection.tsx`) :

1. **Types de prestation** : liste éditable (renommer, ajouter jusqu'à 8,
   supprimer en gardant au moins une prestation). Les quatre traitements de
   départ sont Lavage + Repassage, Nettoyage à sec, Repassage seul, Teinture.
2. **Modèle de facturation par prestation** : à la pièce, au kilo (prix/kg), ou
   forfait fixe (poids couvert, prix du forfait et prix facultatif du kilo
   supplémentaire). Une prestation sans modèle enregistré reste à la pièce.
3. **Prix par vêtement** : un tableau vêtements × prestations **à la pièce**.
   La colonne « Base » rappelle le prix du catalogue.

**Une case laissée vide applique le prix de base du catalogue** (affiché en
gris dans la case). Aucun tarif n'est inventé : c'est le prix déjà en vigueur
qui continue de s'appliquer tant que le propriétaire ne saisit rien de
spécifique.

Techniquement : `shopSettings.pressing = { services, prices }`, où
`prices['<articleId>:<prestationId>']` contient le prix réglé à la pièce.
`resolvePressingPrice` (`src/lib/pressing.ts`) renvoie ce prix s'il existe,
sinon `ClothingItem.unitPrice`. Chaque service peut aussi porter
`pricingMode: 'kilo'` avec `kiloPrice`, ou `pricingMode: 'forfait'` avec
`packageWeightKg`, `packagePrice` et `extraKiloPrice`. Les montants sont
normalisés et validés avant enregistrement ; aucun tarif au poids n'est créé
par défaut.

## Effet au comptoir

- le filtre « traitement » de l'étape 2 est alimenté par la liste réglée ;
- le prix affiché sur chaque carte de vêtement **suit la prestation
  sélectionnée** (ex. Chemise : 1 500 en lavage + repassage, 4 000 si le
  nettoyage à sec a été fixé à 4 000) ;
- une prestation au kilo ou au forfait remplace le catalogue par une saisie du
  poids et un devis immédiat. Ex. 2,5 kg × 600 FCFA = 1 500 FCFA ; un forfait
  de 5 kg à 2 500 FCFA avec 1,5 kg supplémentaires à 600 FCFA/kg coûte
  3 400 FCFA ;
- le dépassement est bloqué si aucun tarif de kilo supplémentaire n'est défini.
  Le forfait et son dépassement restent deux lignes lisibles dans le panier,
  sur le récapitulatif et sur le reçu ;
- si une prestation est renommée ou supprimée, le filtre retombe sur la
  première prestation disponible au lieu de garder un libellé fantôme ;
- la ligne du panier conserve le libellé de la prestation et le prix appliqué.

## Catalogue Supabase

`buildPressingCatalogEntries` produit une ligne par vêtement et par prestation
à la pièce (`pressing:<prestation>:<vêtement>`), une entrée `kilo` pour la
vente au poids, et des entrées distinctes `unit`/`kilo` pour un forfait et ses
kilos supplémentaires. Elle n'est pas encore synchronisée : les tarifs restent
dans les paramètres locaux de la boutique tant que le branchement des
commandes distantes n'est pas fait.

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

## Alignement serveur (29/10/2026)

La RPC `create_order` appliquait encore +50 % alors que le comptoir était
passé à ×2. La migration `20261029150000_align_express_surcharge.sql`
reprend sa formule (`service_fees = sous-total` en express), vérifiée par
Phase 0 (« create_order facture l'express au double », tickets ×2 : 1 000
de prestations → 2 000 au total, hors remise et courses). Le POS n'écrivant
pas encore dans Supabase, aucun ticket réel n'était concerné.

## Commandes mixtes Normal / Express (29/10/2026)

Le délai est maintenant porté par chaque ligne (`isExpress`). Un même client
peut donc déposer des lots normaux et Express dans une seule réception, y
compris deux lots du même vêtement. Le supplément de 100 % est calculé sur la
somme des seules lignes Express ; les anciennes lignes sans drapeau conservent
le repli sur l'option globale de retrait.

La migration `20261029160000_mixed_express_lines.sql` applique la même règle
dans `create_order`, valide le booléen de chaque ligne et marque la commande
comme urgente dès qu'une ligne est Express. Le contrôle Phase 0 couvre une
commande de deux chemises normales et une Express (1 500 FCFA de prestations,
500 FCFA de supplément, 2 000 FCFA au total).

Au moins une ligne Express donne automatiquement à toute la commande la
**priorité atelier Express 24h**. Les lignes Normal restent normales et non
majorées. Les options Standard, Différé et date libre sont désactivées tant
qu'une ligne Express est présente : elles ne peuvent plus réécrire les délais
du panier ni repousser cette priorité. Une ancienne date libre est ignorée
pour la date promise dès que la priorité Express est active.

Le panier permet une recherche par article, prestation, couleur ou délai, avec
les filtres **Tous / Normal / Express**. L'historique des commandes propose
également ces délais ; une commande mixte est incluse dans le filtre Express,
puisqu'elle est prioritaire, et porte le libellé « Express · mixte ».
