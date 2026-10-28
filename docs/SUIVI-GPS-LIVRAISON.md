# Suivi GPS des tournées et preuve de remise — note de conception

**Date :** 28 octobre 2026 · **Branche :** `arena/7aed267c-googlepress`
**Statut :** **phases 0 et 1 livrées** (28 octobre 2026), écran coursier
`/tournee` compris — voir [`docs/PREUVE-DE-REMISE.md`](PREUVE-DE-REMISE.md) et
[`docs/CARTE-ET-SUIVI-GPS.md`](CARTE-ET-SUIVI-GPS.md). Les phases 2 et 3
restent des propositions. Ce document décrit
ce qui existe déjà, ce que « GPS » peut raisonnablement vouloir dire dans une
application web, le modèle de données proposé, les écrans, les cas limites et
un découpage en phases. Il se valide ou se corrige avant la première ligne de
code.

## 1. La demande

« GPDS » a été précisé en cours de discussion : il s'agit du **suivi GPS** des
tournées. Cible : **Production & Remise → Remises comptoir** et **Ramassage &
livraison**. Vous voulez :

1. **savoir où est le coursier** pendant sa tournée ;
2. **estimer son heure d'arrivée** chez le client ;
3. **prouver la remise** : photo, nom du réceptionnaire, horodatage et
   position au moment de la livraison ;
4. **rattacher cette preuve à la remise comptoir**, pour trancher un litige
   (« je n'ai jamais reçu ma chemise »).

## 2. Constat : ce que le code fait déjà

Le module logistique existe et fonctionne, mais **il ne connaît aucune
coordonnée**. Recherche `geolocation|latitude|longitude` dans `src/` :
**zéro résultat**.

| Élément | État réel dans le code |
| --- | --- |
| Tournée (`LogisticsTask`, `src/types/index.ts`) | `address` et `addressDetails` en **texte libre** ; créneau ; coursier assigné ; frais ; sacs estimés/collectés ; motifs d'échec. Aucune latitude/longitude. |
| Cycle de vie | `scheduled` → `en_route` → `completed` / `failed` / `cancelled` (`src/lib/logistics.ts`). |
| Actions (`LogisticsActionModal.tsx`) | confirmer la collecte, **confirmer la livraison** (montant encaissé + mode de paiement), signaler un échec, annuler. |
| Écran logistique (`LogisticsPanel.tsx`) | vues Jour / À traiter / Historique, filtres, pagination. Aucune carte. |
| Remises comptoir (`HandoverSection.tsx`) | checklist des pièces, contrôle qualité, encaissement du solde. La case **« Photo » est un simple marqueur visuel** : `qcState.photo` est un booléen, aucune image n'est capturée ni conservée. Les commandes en livraison à domicile y sont volontairement bloquées : « ouvrez sa tournée pour confirmer la remise ». |
| Réglages (`SettingsPage.tsx`, onglet *Ramassage & livraison*) | deux montants forfaitaires (ramassage, livraison). Rien d'autre. |
| Persistance | `localStorage['pressingpro_logistics_tasks']` (`LOGISTICS_TASKS_STORAGE_KEY`). Pas de table Supabase pour les tournées. |
| Rôle coursier | `courier` existe dans `src/lib/staffAccess.ts` (« Coursier »), mais **aucun écran dédié** : le coursier est choisi parmi les employés actifs dans le formulaire de tournée. |

**Conséquence :** il n'y a rien à « brancher ». Il faut d'abord décider ce que
le GPS doit produire, puis ajouter coordonnées, positions et preuves.

## 3. Ce qu'une application web peut réellement faire

C'est le point qui décide de tout le reste. Une application web (celle-ci)
n'est pas une application mobile native : elle ne peut pas suivre un coursier
en arrière-plan de façon fiable. Trois contraintes :

1. **Permission.** `navigator.geolocation` demande l'autorisation explicite du
   téléphone. Refusée, elle ne se réactive que dans les réglages du navigateur.
2. **Écran allumé.** Sur iOS Safari, dès que l'onglet passe en arrière-plan ou
   que l'écran se verrouille, les mises à jour de position sont suspendues.
   Sur Android, c'est meilleur mais variable selon le constructeur et le
   navigateur. **Aucun suivi fiable écran éteint.**
3. **Précision.** En ville dense, la précision annoncée varie de 10 m à
   plusieurs centaines de mètres (arrière-cour, immeuble, réseau). Une
   position n'est pas une adresse.

**Décision de conception qui en découle :** deux modes complémentaires.

- **Mode A — jalons (toujours fiable, sans GPS).** Le coursier confirme
  *Départ*, *Arrivé sur place*, *Livré*. Ces jalons existent en partie
  (statuts). On y ajoute l'heure réelle et, si disponible, la position. C'est
  ce mode qui **prouve** la remise, même sans réseau.
- **Mode B — position live (confort).** Tant que la page *Ma tournée* est
  ouverte et l'écran allumé, l'application envoie la position toutes les
  45–60 s. Le bureau et le client voient la progression. Elle s'arrête dès que
  la page est fermée : **on ne prétend pas suivre un coursier en continu**.

Autrement dit : le GPS améliore le suivi, il ne le remplace pas.

## 4. Les cinq briques

### 4.1 Coordonnées de la destination

Une adresse en texte libre ne donne pas de point. Trois options, à trancher :

| Option | Avantage | Limite |
| --- | --- | --- |
| **A. Saisie du point sur une carte** au moment de créer la tournée (clic sur la carte, ou « Ma position actuelle » depuis le téléphone d'un employé sur place) | fiable, ne dépend d'aucun service payant, fonctionne avec des adresses ivoiriennes approximatives | demande 5 secondes à la création |
| **B. Géocodage automatique** de l'adresse par un service (Nominatim/OpenStreetMap, Mapbox, Google Geocoding) | aucun geste | qualité médiocre sur les adresses informelles ; quota, clé, facturation ; dépendance externe |
| **C. Rien** | zéro travail | pas de distance, pas d'ETA, pas de contrôle « remise hors zone » |

**Recommandation : A, avec B en option.** On saisit le point une fois (ou on
réutilise le point déjà enregistré pour ce client), et un bouton « retrouver
l'adresse » peut tenter le géocodage si une clé est configurée. Un client
récurrent garde son point : `Customer` gagne `location?: GeoPoint`.

Le vrai gain pour Abidjan n'est pas le géocodage mais les **quartiers**
(Cocody, Yopougon, Marcory…). Un champ `district` optionnel servira plus tard
aux **frais par zone**.

### 4.2 Position du coursier

- Page **Ma tournée** (`/logistique/tournee`), mobile d'abord, accessible aux
  rôles `courier`, `shop_manager`, `organization_owner`.
- `navigator.geolocation.watchPosition` avec `enableHighAccuracy: true`,
  filtrage : on n'enregistre un point que si **45 s** ou **50 m** séparent du
  précédent, ou si la précision s'améliore nettement.
- Chaque point : latitude, longitude, précision, horodatage, identifiant de
  tournée et d'employé. ~80 octets, négligeable en données mobiles.
- **File d'attente hors-ligne** : les points s'accumulent dans
  `pressingpro_courier_positions` (local) et l'écran affiche « N positions en
  attente ». Rien n'est inventé si le réseau manque.
- Bouton explicite **« Terminer la tournée »** qui coupe le suivi — condition
  de l'accord des coursiers.

### 4.3 Carte

| Choix | Coût | Remarques |
| --- | --- | --- |
| **Leaflet + tuiles OpenStreetMap** | gratuit, pas de clé | nécessite internet pour les tuiles, attribution obligatoire ; cache partiel possible |
| Google Maps JS | clé + facturation à l'usage | meilleure couverture des adresses locales, plus lourd |
| Aucune carte | 0 | on affiche distance et ETA en texte |

**Recommandation : Leaflet + OSM**, avec une carte qui **dégrade proprement** :
si les tuiles ne chargent pas, on garde la liste, la distance et l'ETA. Pas de
clé à payer pour démarrer, et la même bibliothèque sert au bureau et au client.

### 4.4 Heure d'arrivée estimée

Volontairement simple, et **toujours annoncée en fourchette** :

```
distance_km   = haversine(position, destination) × facteur_détour (1,3 par défaut)
temps_conduite = distance_km / vitesse_moyenne (18 km/h par défaut, réglable)
arrêts_restants = nombre de tournées du même coursier avant celle-ci × temps_arrêt (8 min)
ETA = maintenant + temps_conduite + arrêts_restants
fourchette = [ETA − 10 min, ETA + 15 min]
```

Règles d'affichage :

- position de plus de **3 minutes** → « position non actualisée (il y a X min) »
  et **pas d'ETA** ;
- précision > 150 m → mention « approximative » ;
- aucune coordonnée → ni distance ni ETA, seulement le créneau promis au client.

C'est moins « intelligent » qu'un calculateur d'itinéraire, mais c'est
explicable, testable, et ça ne promet pas une heure fausse.

### 4.5 Preuve de remise

Quatre preuves possibles, cumulables, réglables dans les paramètres :

1. **Photo** du linge remis (ou du carton) — réduction à 256 px WebP, même
   chaîne que les photos de vêtements (`src/lib/imageDownscale.ts`), plafond
   existant de 350 000 caractères pour la data URL.
2. **Signature** au doigt sur un canevas, exportée en PNG ≤ 40 000 caractères.
3. **Code de remise à 4 chiffres** généré à la commande, affiché au client
   (SMS/ticket) et saisi par le coursier.
4. **Nom du réceptionnaire** (texte libre) + **position et horodatage**.

Chaque preuve enregistre `capturedAt`, `capturedByEmployeeId` et, si le
téléphone l'a fourni, le point GPS. Une preuve est **immuable** : corriger
après coup crée une nouvelle entrée avec un motif, on ne réécrit pas.

## 5. Modèle de données proposé

Types ajoutés dans `src/types/index.ts` :

```ts
export interface GeoPoint {
  lat: number;
  lng: number;
  accuracyM?: number;
  source: 'device' | 'manual' | 'customer';
  recordedAt: string; // ISO
}

export interface DeliveryProof {
  method: 'photo' | 'signature' | 'code';
  imageDataUrl?: string;
  signatureDataUrl?: string;
  receiverName?: string;
  deliveryCodeUsed?: string;
  point?: GeoPoint;
  capturedAt: string;
  capturedByEmployeeId?: string;
  note?: string;
}

// LogisticsTask gagne :
destination?: GeoPoint & { label?: string };
proof?: DeliveryProof;
enRouteAt?: string;   // jalon « parti »
arrivedAt?: string;   // jalon « arrivé sur place »
```

Nouvelles clés de persistance (mêmes conventions que l'existant) :

| Clé | Contenu | Rétention |
| --- | --- | --- |
| `pressingpro_courier_positions` | dernier point par tournée + historique court | 7 jours |
| `pressingpro_delivery_zones` | quartiers et frais (phase 2) | permanente |
| `shopSettings.deliveryGps` | activation, vitesse, détour, exigences de preuve | permanente |

Réglages proposés :

```ts
interface DeliveryGpsSettings {
  enabled: boolean;
  trackPositions: boolean;          // mode B
  avgSpeedKmh: number;              // 18 par défaut
  detourFactor: number;             // 1,3 par défaut
  positionMaxAgeSeconds: number;    // 180 par défaut
  requirePhoto: boolean;
  requireSignature: boolean;
  requireCode: boolean;
  retentionDays: number;            // 30 par défaut
}
```

**Backend (phase 3 seulement).** Les tournées sont aujourd'hui locales. La
cible Supabase : `delivery_positions` (append-only) et `delivery_proofs`
(immuables), avec RLS par `organization_id`, accès coursier limité à ses
tournées. On ne bascule pas les tournées vers Supabase dans ce chantier : ce
serait un lot à part, déjà décrit dans `docs/PLAN-BACKEND.md`.

## 6. Écrans

### A. Paramètres → Ramassage & livraison → « Suivi GPS & preuve de remise »

Nouvel encart sous les deux forfaits : interrupteur *Suivi des positions*,
vitesse moyenne, facteur de détour, âge maximal d'une position, exigences de
preuve (photo / signature / code), rétention. Chaque champ a une aide en
français simple, comme les autres encarts.

### B. Ma tournée — nouvel écran `/logistique/tournee`

Mobile d'abord, gros boutons, utilisable d'une main :

- en-tête : date, nombre d'arrêts restants, bandeau **GPS actif / refusé** avec
  la marche à suivre pour le réactiver ;
- liste ordonnée des arrêts du coursier connecté : client, adresse, créneau,
  montant à encaisser (livraisons), bouton **Itinéraire** (lien profond
  `https://www.google.com/maps/dir/?api=1&destination=lat,lng` ou `waze://`) ;
- par arrêt : `Démarrer` → `Arrivé` → `Livré` (ouvre la preuve) ou
  `Échec` (motif existant) ;
- fin de tournée : récapitulatif (arrêts faits, encaissé, preuves) et bouton
  **Terminer la tournée**.

### C. Ramassage & livraison — vue carte

Dans `LogisticsPanel`, une bascule **Liste / Carte** : points des arrêts du
jour, position du coursier filtrée par employé, fraîcheur affichée
(« il y a 40 s » / « non actualisée »), bouton *Suivre* sur une tournée.
La liste reste le mode par défaut : la carte est un confort, pas une
dépendance.

### D. Remises comptoir — bloc « Preuve de remise »

Pour une commande livrée à domicile, `HandoverSection` affiche la preuve
rattachée à la tournée : vignette de la photo, nom du réceptionnaire, date et
heure, coordonnées et lien carte, mode de preuve. Sans preuve : mention
explicite « Remise confirmée par le coursier, sans preuve photo » — on
n'invente jamais une preuve manquante.

### E. Espace client

Sur la commande en cours : statut de la tournée (« En route », « Livré à
14 h 12 ») et, si activé, une **fourchette d'arrivée**. Deux options de
position côté client, à trancher :

- **statut seul** (par défaut) : aucune coordonnée n'est exposée ;
- **lien de suivi à jeton** (phase 2) : URL à durée de vie courte, position
  **arrondie à ~300 m**, révocable par le pressing.

### F. Journal et rétention

Écran ou section listant les preuves d'une période, avec purge automatique
après `retentionDays`. C'est aussi la pièce à produire en cas de litige.

## 7. Règles et cas limites

| Cas | Comportement prévu |
| --- | --- |
| Permission GPS refusée | mode A seul ; bandeau d'explication ; aucune coordonnée inventée ; preuve toujours possible (photo, nom, code). |
| Position trop ancienne | badge « non actualisée », pas d'ETA. |
| Précision dégradée (> 150 m) | mention « approximative », ETA en fourchette large. |
| Hors-ligne | points et preuves stockés localement, badge de file d'attente, envoi à la reconnexion. |
| Coordonnées 0,0 ou hors Abidjan | point rejeté à la saisie (bornes de la Côte d'Ivoire), message clair. |
| Adresse non géocodée | distance et ETA masquées, jamais estimées sur une adresse inconnue. |
| Remise loin du point prévu (> 500 m) | **avertissement**, pas blocage : le coursier peut être au portail voisin ; motif facultatif consigné. |
| Coursier réassigné | les positions restent attachées à l'ancien employé, marquées « avant réassignation ». |
| Tournée annulée puis reprise | nouveaux jalons, historique conservé. |
| Appareil partagé | le suivi s'arrête à « Terminer la tournée » ; pas de suivi implicite. |
| Preuve après coup | nouvelle entrée datée, motif obligatoire ; la première n'est pas modifiée. |
| Litige « non reçu » | la fiche remise montre preuve + horodatage + position ; l'absence de preuve est dite telle quelle. |
| Batterie / données | envoi espacé (45–60 s), payload minuscule, arrêt manuel, pas de boucle en arrière-plan. |

## 8. Vie privée, consentement, sécurité

- **Coursiers** : information écrite, consentement recueilli à l'activation,
  suivi **limité à la tournée**, bouton d'arrêt explicite, aucune position
  conservée au-delà de la rétention.
- **Clients** : par défaut, statut sans coordonnées. Un lien de suivi est
  nominatif, à jeton, expirant, révocable.
- **Accès** : positions et preuves visibles par le propriétaire et le
  responsable d'agence ; le coursier ne voit que ses tournées.
- **Réglementation** : traitement de données personnelles (dont la
  géolocalisation) soumis à la loi ivoirienne sur la protection des données ;
  une formalité auprès de l'ARTCI peut être requise — **à confirmer avec votre
  juriste avant mise en service**, ce n'est pas un avis juridique.
- **Technique** : HTTPS obligatoire pour la géolocalisation (déjà le cas) ;
  aucune clé de service dans le navigateur ; journaux sans coordonnées.

## 9. Découpage en phases

Les durées sont des ordres de grandeur de développement, hors temps de recette
sur téléphone réel.

| Phase | Contenu | Dépendance externe | Estimation |
| --- | --- | --- | --- |
| **0 — Preuve + jalons** ✅ **livrée** | preuve photo/signature/code, nom du réceptionnaire, jalons *parti / arrivé / livré*, bloc preuve dans Remises comptoir, bouton *Itinéraire* (lien profond Maps/Waze) — [`docs/PREUVE-DE-REMISE.md`](PREUVE-DE-REMISE.md) | aucune | livrée |
| **1 — Positions + carte + ETA + écran coursier** ✅ **livrée** | point de destination, envoi de positions, carte Leaflet, fraîcheur, fourchette d'arrivée, réglages GPS, écran coursier `/tournee` (arrêts ordonnés, gros boutons, fin de tournée) — [`docs/CARTE-ET-SUIVI-GPS.md`](CARTE-ET-SUIVI-GPS.md) | tuiles OSM (gratuit) | livrée |
| **2 — Client + zones** | lien de suivi à jeton, position arrondie, frais par quartier, `district` client | optionnelle | 2 jours |
| **3 — Backend** | tables Supabase, RLS, temps réel multi-appareils, PWA hors-ligne complète, optimisation de tournée | Supabase | à planifier séparément |

Les **phases 0 et 1 sont livrées**. Reste la **phase 2** (lien de suivi client,
zones tarifaires) puis la **phase 3** (Supabase : positions partagées entre
appareils, temps réel, hors-ligne).

## 10. Stratégie de test

**Tests unitaires** (nouveaux, dans `tests/unit/`) :

- `geo.test.ts` : distance haversine (0 même point, valeurs connues, bornes
  lat/lng), validation d'un point (Côte d'Ivoire, `NaN`, `0,0`), fraîcheur
  d'une position, précision.
- `deliveryEta.test.ts` : ETA avec détour, arrêts restants, position périmée
  → aucune ETA, précision faible → mention.
- `deliveryProof.test.ts` : validation photo/signature/code, plafonds de
  taille, immuabilité, preuve hors zone, absence de preuve.
- `deliveryZones.test.ts` (phase 2) : résolution du frais par quartier,
  quartier inconnu → tarif par défaut.
- `logistics.test.ts` : jalons et transitions sans casser l'existant.

**Rendu serveur (SSR)** : comme pour les lots précédents, un script temporaire
dans `scripts/` charge `LogisticsPanel` et `HandoverSection` avec des tournées
et preuves seedées, et vérifie le texte rendu (« position il y a 40 s »,
« Preuve de remise », « sans preuve photo »).

**Navigateur (CI uniquement)** : Playwright sait **simuler une position**
(`context.setGeolocation`) et refuser la permission (`permissions: []`). On
testera donc les deux chemins en CI. Mon bac à sable n'a pas de navigateur :
la recette réelle sur un téléphone Android et un iPhone reste **à faire par
vous**, et je le dirai tel quel.

## 11. Ce que je ne peux pas garantir ici

- Pas de navigateur ni de téléphone dans mon environnement : la géolocalisation
  réelle, la batterie, la précision en rue ne sont **pas** testables par moi.
- Les tuiles OSM et un éventuel géocodage dépendent d'un accès internet côté
  utilisateur ; à Abidjan, le mode dégradé n'est pas une option, c'est le cas
  normal.
- Aucune estimation d'heure ne sera présentée comme exacte : fourchette,
  fraîcheur affichée, et rien du tout sans coordonnées.
- Le suivi en arrière-plan écran éteint n'est **pas** promis.

## 12. Décisions à prendre

1. **Carte** : ✅ **Leaflet + tuiles OpenStreetMap** (gratuit, sans clé) —
   tranché et implémenté.
2. **Point de destination** : saisi sur carte au moment de la tournée
   (recommandé), géocodé automatiquement, ou les deux ?
3. **Preuve exigée** : photo, signature, code à 4 chiffres — ou plusieurs ?
   Recommandation : photo **ou** code, signature optionnelle.
4. **Téléphones des coursiers** : Android récents avec data ? Un par coursier
   ou partagés ? (décide de la viabilité de la phase 1)
5. **Client final** : statut seul (recommandé au départ) ou lien de suivi live ?
6. **Zones tarifaires** : maintenant (phase 2) ou plus tard ?

## 13. Prochaine étape proposée

Les phases 0 et 1 sont livrées, écran coursier compris. Les décisions encore
ouvertes (point de destination, téléphones réels, lien client, zones) portent
maintenant sur la **phase 2**. L'espace coursier restreint existe côté écran ;
le verrouillage par rôle viendra avec la liaison compte ⇄ fiche employé.
