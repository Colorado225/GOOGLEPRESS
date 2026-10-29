# Identité de l'établissement (nom et logo)

Un pressing inscrit ne voit plus « PressingPro CI » à la place de son nom :
l'interface de gestion affiche **son** enseigne et **son** logo. PressingPro CI
reste le nom du logiciel, uniquement sur les pages publiques (connexion,
inscription, mentions légales, accueil produit).

## Où se règle l'identité

**Paramètres → Identité de l'établissement** :

| Élément | Règle |
| --- | --- |
| Nom commercial | Champ texte obligatoire, enregistré dans les paramètres de la boutique (par organisation). |
| Logo | PNG, JPEG ou WebP, 2 Mo maximum, redimensionné en carré 256 px. Boutons « Téléverser un logo » / « Changer le logo » / « Retirer ». |

Le logo est appliqué immédiatement (sans attendre « Enregistrer »), parce que
c'est une donnée d'identité et non un réglage de facturation.

## D'où vient le nom affiché

Ordre de priorité (`resolveShopDisplayName`, `src/lib/shopIdentity.ts`) :

1. le nom enregistré dans **Paramètres → Nom commercial** ;
2. le nom de l'**agence** créée à l'inscription (Supabase `shops.name`) ;
3. le nom de l'**organisation** (Supabase `organizations.name`) ;
4. à défaut, un libellé neutre : « Mon pressing » sur un espace réel,
   « PressingPro CI (démonstration) » en démonstration locale.

Aucun nom n'est inventé : un espace réel dont le nom n'est pas encore saisi
affiche « Mon pressing » et les initiales « MP », jamais une enseigne fictive.

## Où l'identité remplace le nom du produit

- barre latérale (marque + sous-titre = adresse, sinon libellé de l'espace) ;
- en-tête de l'ERP (marque repliée et fil d'Ariane) ;
- titre d'onglet du navigateur (`… — Nom du pressing`) ;
- ticket client / fiche atelier imprimés (logo ou initiales) ;
- bandeau du POS, récapitulatif de commande, message WhatsApp, en-tête des rapports.

Restent au nom du produit : accueil, connexion et inscription du personnel,
espace client public, mentions légales, titres d'onglet de ces pages.

## Contraintes techniques

- **Data URL uniquement** (`data:image/png|jpeg|webp;base64,…`, ≤ 350 000
  caractères) : la CSP `img-src 'self' data: blob:` n'autorise pas d'image
  distante, et un logo stocké localement fonctionne hors ligne.
- **SVG refusé** : un SVG peut embarquer du script ; le convertir en raster
  n'apporte rien pour un logo de pressing.
- Redimensionnement côté navigateur (`src/lib/imageDownscale.ts`) : cadrage
  « contain » centré, proportions conservées, transparence préservée, export
  WebP puis repli PNG.
- Une valeur corrompue ou une URL distante trouvée dans le stockage local est
  ignorée au chargement : retour aux initiales, sans erreur bloquante.
- Sans logo, un monogramme d'initiales (`getBrandInitials`) remplace l'image :
  « Éclat Cocody » → « ÉC ».

## Vérifications effectuées

```bash
npx tsc --noEmit          # aucune erreur
npm run test:unit         # 153 tests / 16 fichiers (dont tests/unit/shopIdentity.test.ts)
npm run build             # build de production OK
```

Contrôles de rendu serveur (harnais Vite SSR, portée réelle, org « Pressing
Éclat / Agence Yopougon ») :

- sans réglage : marque latérale = « Agence Yopougon », initiales « AY »,
  aucune occurrence de « PressingPro CI » ;
- avec réglage (`name` + logo PNG) : nom « Pressing Éclat Abidjan », `<img>`
  en data URL, `alt` vide (image décorative à côté du texte) ;
- logo en URL distante dans le stockage : ignoré, initiales affichées ;
- écran Paramètres : champ fichier `accept="image/png,image/jpeg,image/webp"`,
  libellé « Téléverser un logo » puis « Changer le logo » + bouton « Retirer »
  quand un logo existe.

Non vérifié en navigateur réel : le téléversement (FileReader + canvas) n'a pas
été exécuté dans un navigateur depuis cet environnement (pas de Chromium dans
le bac à sable) ; seules les fonctions pures et le rendu des composants sont
couverts ici. Les tests Playwright tournent en CI.
