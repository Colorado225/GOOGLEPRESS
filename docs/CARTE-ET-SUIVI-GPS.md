# Carte et suivi GPS des tournées — phase 1

**Date :** 28 octobre 2026 · **Branche :** `arena/7aed267c-googlepress`
**Statut :** **livrée en entier**, écran coursier `/tournee` compris
(voir § 8).
**Fournisseur de carte :** **Leaflet + tuiles OpenStreetMap**, gratuit, sans clé
ni compte — choix retenu après la phase 0.

## 1. Ce que ça apporte

- Une **vue Carte** dans *Production & Remise → Tournées* : arrêts à faire et
  position des coursiers en route.
- Un **point de livraison** placé à la main sur la carte (ou avec la position
  du téléphone quand l'équipe est sur place). Il remplace l'adresse textuelle
  pour l'itinéraire : « Rue des Jardins, Cocody » ne dit pas quel portail.
- Un **partage de position** déclenché par le coursier, jamais implicite.
- Une **heure d'arrivée estimée en fourchette**, avec l'âge de la position et
  la précision annoncée. Aucune heure si la position est périmée.
- Des **réglages** clairs : carte activée ou non, partage autorisé ou non,
  vitesse moyenne, détour routier, durée de validité d'une position.
- Un **écran coursier** plein écran, pensé pour une main : les arrêts du jour
  dans l'ordre, un gros bouton par étape, l'itinéraire et l'appel à portée de
  pouce.

## 2. Parcours concret

1. Sur une tournée, **Placer le point** : la carte s'ouvre centrée sur Abidjan,
   un clic pose le point, « Utiliser ma position » prend celle du téléphone.
2. **Itinéraire** (Google Maps) et **Waze** partent désormais du point
   lorsqu'il existe, sinon de l'adresse écrite.
3. Le coursier appuie sur **Partager ma position** au départ. Tant que l'écran
   reste ouvert, la position est réécrite au maximum toutes les 45 s ou après
   50 m de déplacement.
4. La fiche affiche **Arrivée estimée 14 h 32 – 14 h 55 · 3,4 km · position il
   y a 40 s**. Au-delà de la validité (3 min par défaut), le message devient
   « Position non actualisée… aucune heure d'arrivée n'est annoncée ».
5. La vue **Carte** rassemble les arrêts et les coursiers du jour.
6. Sur le téléphone, le coursier ouvre **Ma tournée** (barre latérale, ou le
   bouton du panneau Tournées). Il choisit son nom une fois — le choix est
   retenu sur l'appareil — puis enchaîne Démarrer → Arrivé sur place →
   Confirmer. Le partage de position n'apparaît que sur la course en route.

## 3. Choix techniques et pourquoi

| Sujet | Choix | Raison |
| --- | --- | --- |
| Bibliothèque | **Leaflet** (import dynamique) | libre, ~43 kB gzip, aucune clé ; chargée **uniquement** quand une carte s'affiche |
| Tuiles | `https://{s}.tile.openstreetmap.org` | gratuites, attribution affichée et conservée |
| Géocodage | **aucun** | une adresse ivoirienne libre donne souvent le mauvais quartier ; un clic est plus fiable |
| Position | `navigator.geolocation.watchPosition` | standard, sans permission persistante cachée |
| Fréquence | 45 s ou 50 m | batterie et données mobiles ménagées |
| Stockage | `localStorage['pressingpro_courier_positions']`, **une position par tournée** | l'historique du trajet n'apporte rien à l'heure d'arrivée |
| Rétention | 7 jours, purge à l'ouverture | données personnelles limitées au nécessaire |

### Deux blocages de production corrigés

Ils auraient rendu la carte et le GPS inopérants sur Vercel :

- `Content-Security-Policy` → `img-src` autorise désormais
  `https://*.tile.openstreetmap.org` (sinon aucune tuile ne se charge) ;
- `Permissions-Policy` → `geolocation=(self)` (la valeur `()` interdisait
  purement et simplement la géolocalisation).

## 4. Calcul de l'heure d'arrivée

```
distance  = haversine(position, point) × détour (1,3 par défaut)
conduite  = distance / vitesse moyenne (18 km/h par défaut) × 60
délai     = conduite + arrêts restants × 8 min
fourchette = [max(1, délai − 10 min) ; délai + 15 min]
             (marges portées à 15/25 min si précision > 150 m)
```

- Position de plus de `maxAgeSeconds` (180 s par défaut) → **aucune** estimation.
- Précision > 150 m → mention « position approximative » et fourchette élargie.
- Arrêts restants = nombre d'arrêts du même coursier avant celui-ci.
- Aucune coordonnée → ni distance ni heure, seulement le créneau promis.

## 5. Données

```ts
interface GeoPoint {
  lat: number;
  lng: number;
  accuracyM?: number;
  source: 'device' | 'manual';
  recordedAt: string; // ISO
}

// LogisticsTask
destination?: GeoPoint;

// localStorage['pressingpro_courier_positions']
{ [taskId]: { ...GeoPoint, taskId } }
```

Les points `0,0`, les coordonnées hors bornes et les horodatages invalides sont
**rejetés** à la lecture : aucune position n'est inventée ou réparée.

## 6. Vie privée

- Le partage démarre sur un appui explicite et s'arrête au clic sur « Arrêter »,
  au changement d'écran ou à la fermeture de la page. **Aucun suivi en
  arrière-plan, aucun envoi écran éteint.**
- Une seule tournée peut partager à la fois (le partage précédent est coupé).
- Les positions ne quittent pas le navigateur : pas de table Supabase, pas
  d'envoi serveur, comme le reste du module logistique.
- La position n'est acceptée que pour une tournée **en route** ; elle est
  purgée après 7 jours.
- Côté client, rien n'est exposé : l'espace client ne montre toujours pas la
  position (phase 2, avec lien à jeton).

## 7. Ce qui n'est pas encore là

- **Lien de suivi client** à jeton, position arrondie : phase 2.
- **Zones tarifaires** par quartier : phase 2.
- **Optimisation d'itinéraire** et géocodage automatique : hors périmètre.
- **Synchronisation Supabase** des positions : phase 3.

## 8. Écran coursier — `/tournee`

Une page à part, pas un onglet de plus dans l'atelier : le coursier est debout,
dehors, souvent en plein soleil, avec une main libre.

- **Route stable** `/tournee` (alias `/ma-tournee`) : le titre du document
  devient « Ma tournée — <nom du pressing> ».
- **Choix du coursier local.** Les comptes de connexion ne sont pas encore
  reliés aux fiches employés ; l'écran retient le dernier nom choisi dans
  `localStorage` (clé `pressingpro_active_courier`). Le choix mémorisé est
  ignoré s'il a été désactivé, et le personnel dont le poste contient
  « livraison » est proposé en tête. Avec un seul employé actif, pas de
  sélecteur : juste son nom.
- **Ordre réel** : créneaux de `LOGISTICS_TIME_SLOTS` d'abord, puis date de
  création ; les tournées terminées descendent en fin de liste ; les
  annulations disparaissent ; les échecs restent visibles avec leur badge.
- **Une action principale par état** : `Démarrer` (programmée) puis `Arrivé
  sur place`, `Confirmer la collecte` ou `Confirmer la livraison`, et
  `Signaler un échec`. Les modales sont celles du panneau Tournées — même
  code, mêmes règles (encaissement du solde, code de remise, preuve).
- **Sur place** : `Itinéraire` (Google Maps, depuis le point de livraison)
  et `Appeler` (`tel:`) toujours visibles, plus `Placer` / `Modifier le point
  de livraison`.
- **Position** : le contrôle de partage n'apparaît que si une course est *en
  route* **et** que le partage est autorisé dans les paramètres. Sinon, une
  phrase dit pourquoi (carte désactivée, partage désactivé, aucune course en
  cours) — jamais un bouton mort.
- **Fin de tournée** : quand tous les arrêts sont traités, le récapitulatif
  s'affiche (arrêts traités, encaissé, preuves, échecs à reprogrammer) et
  « Terminer la tournée » coupe le partage de position, où qu'il soit monté.

Fonctions pures associées, testées sans navigateur : `resolveActiveCourierId`,
`getCourierStops`, `summarizeCourierTour`, `getNextCourierStop`
(`src/lib/courierTour.ts`).

## 9. Vérifications réellement effectuées

- `npx tsc --noEmit`, `npm run lint` : propres.
- **260 tests / 24 fichiers** : géographie (haversine, bornes, fraîcheur,
  fourchette, précision), positions (relecture, purge, fréquence), itinéraire
  (coordonnées prioritaires, repli sur l'adresse), tournée stockée, et côté
  écran coursier : choix du coursier, filtrage par coursier et par jour,
  ordre des créneaux, terminées en fin, annulations exclues, récapitulatif
  encaissé/reste/preuves, prochain arrêt.
- Couverture : `geo.ts` 96,5 %, `deliveryRoute.ts` 100 %, `courierPositions.ts`
  couverte par ses 6 cas, `courierTour.ts` 83,6 % ; seuils globaux respectés.
- **Rendu serveur** avec tournées seedées : bascule Liste/Carte, « Modifier le
  point » / « Placer le point », « Arrivée estimée » et fourchette `14 h 32 –
  14 h 55`, distance, « Position non actualisée », « Partager ma position »,
  encart des Paramètres avec ses cinq champs, mention Leaflet/OSM.
- `npm run build` : OK ; Leaflet est isolé dans son propre morceau de
  **43,3 kB gzip**, chargé seulement à l'ouverture d'une carte.
- CI : voir le run associé au commit.

## 10. Limites, dites franchement

- **Aucun navigateur ni téléphone dans mon environnement** : les tuiles OSM,
  l'autorisation de géolocalisation, la précision réelle en rue et le
  comportement iPhone n'ont **pas** été exercés ici. La carte et le partage
  sont vérifiés par le rendu et les tests, pas par un parcours réel.
- Les scénarios Playwright existants ne couvrent pas la carte ; ils n'ont pas
  été étendus dans ce lot.
- L'heure d'arrivée reste une **estimation** : fourchette, âge de la position et
  mention « approximative » sont là pour que personne ne la prenne pour une
  promesse.
- L'écran coursier est **responsive et vérifié au rendu**, pas au doigt : la
  taille réelle des boutons, le soleil sur l'écran et le port d'un gant ne se
  testent pas ici. Aucun parcours mobile réel n'a été enregistré.

## 11. Fichiers

- `src/lib/geo.ts` — haversine, validation, fraîcheur, estimation, formats.
- `src/lib/courierPositions.ts` — stockage local, purge, fréquence d'envoi.
- `src/components/logistics/TourMap.tsx` — carte Leaflet (import dynamique).
- `src/components/logistics/TourMapPanel.tsx` — vue Carte des tournées.
- `src/components/logistics/DestinationPickerModal.tsx` — choix du point.
- `src/components/logistics/CourierTrackingControl.tsx` — partage de position,
  et `stopActiveCourierWatch()` pour couper net en fin de tournée.
- `src/components/courier/CourierPage.tsx` — écran coursier `/tournee`.
- `src/lib/courierTour.ts` — filtres, ordre des arrêts, récapitulatif.
- `LogisticsTaskCard.tsx`, `LogisticsPanel.tsx`,
  `src/components/settings/SettingsPage.tsx` — intégration.
- `src/context/AppContext.tsx`, `src/lib/shopSettings.ts`, `src/types/index.ts`.
- `vercel.json` — CSP tuiles + autorisation de géolocalisation.
- `tests/unit/geo.test.ts`, `tests/unit/courierPositions.test.ts`,
  `tests/unit/deliveryRoute.test.ts`, `tests/unit/logistics.test.ts`,
  `tests/unit/courierTour.test.ts`.
