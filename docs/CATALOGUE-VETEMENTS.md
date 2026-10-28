# Catalogue de vêtements créé depuis les Paramètres

Le catalogue du comptoir n'est plus figé dans le code : le pressing crée ses
propres types de vêtements, avec leur photo, et ils apparaissent aussitôt dans
la réception.

## Où créer un vêtement

**Paramètres → Prestations → Pressing → « Ajouter un vêtement au catalogue »** :

| Champ | Rôle |
| --- | --- |
| Nom du vêtement | 2 à 60 caractères, obligatoire |
| Catégorie | Tous · Hommes · Femmes · Linge maison · B2B / Pro |
| Prix de base (FCFA) | Prix appliqué par défaut, toutes prestations confondues |
| Photo (facultatif) | PNG, JPEG ou WebP, 2 Mo max, recadrée en carré 256 px |

« Ajouter au catalogue » crée le vêtement immédiatement : il rejoint la liste
des vêtements créés (vignette, nom, prix, catégorie, bouton de retrait) **et**
la grille « Prix par vêtement », où chaque prestation peut recevoir son propre
tarif.

## Ce que cela change au comptoir

- le vêtement apparaît **en tête** du catalogue de vêtements (les ajouts
  récents ne se perdent pas dans la liste), avec sa photo ;
- s'il n'a pas de photo, un emoji de secours le représente ;
- son prix suit la prestation choisie, exactement comme les vêtements fournis
  (prix de base tant qu'aucun prix spécifique n'est réglé) ;
- le retirer depuis les Paramètres le sort du catalogue et supprime ses prix
  par prestation.

Les 21 vêtements fournis au départ restent disponibles : les vêtements créés
s'ajoutent devant eux.

## Contraintes techniques

- **Photo en data URL** (`data:image/png|jpeg|webp;base64,…`, ≤ 350 000
  caractères), compatible avec la CSP `img-src 'self' data: blob:` et
  fonctionnelle hors ligne. SVG refusé (script embarqué).
- Redimensionnement navigateur (`fileToGarmentImageDataUrl`) : carré 256 px en
  mode « cover » (l'image remplit la vignette, recadrage centré), export WebP
  avec repli PNG.
- Une photo corrompue ou une URL distante trouvée dans le stockage est ignorée
  au chargement : le vêtement reste au catalogue avec son emoji, ses prix sont
  conservés.
- Identifiant stable préfixé `cg:` (`cg:chemise-en-lin`), dérivé du nom et
  rendu unique : un vêtement créé ne peut pas écraser une ligne existante
  (`c1`, `b1`…).
- Jusqu'à 60 vêtements créés.

## Fichiers

- `src/lib/garmentCatalog.ts` — normalisation, identifiants, validation,
  conversion en ligne de catalogue (`getGarmentCatalog`).
- `src/lib/imageDownscale.ts` — `fileToGarmentImageDataUrl` (recadrage « cover »).
- `src/components/settings/PressingSettingsSection.tsx` — formulaire de
  création et liste des vêtements créés.
- `src/components/pos/Step2ArticlesAndServices.tsx` et
  `src/components/pos/ClothingCatalogSection.tsx` — catalogue réel du comptoir.

## Vérifications effectuées

```bash
npx tsc --noEmit   # aucune erreur
npm run test:unit  # 201 tests / 19 fichiers (dont tests/unit/garmentCatalog.test.ts : 13)
npm run build      # build de production OK
```

Rendus serveur (harnais Vite SSR) :

- sans vêtement créé : formulaire présent (nom, catégorie, prix, photo),
  catégories proposées, aucune liste affichée ;
- avec un vêtement créé (« Chemise en lin », 2 500 FCFA, photo) : vignette et
  prix dans la liste, ligne `cg:chemise-en-lin` dans la grille de prix,
  vêtement visible au comptoir avec sa photo et son prix.

Non vérifié ici : la sélection réelle d'un fichier dans un navigateur (pas de
Chromium dans l'environnement de travail) ; la chaîne FileReader + canvas est
couverte par les fonctions pures, pas par un envoi réel. Les tests Playwright
tournent en CI.
