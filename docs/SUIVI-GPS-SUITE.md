# Suivi GPS de livraison — la suite

> **Note de conception.** Écrite le 29 octobre 2026 sur la branche
> `arena/7aed267c-googlepress`. **Aucune ligne de code n'est encore écrite
> pour ce lot** : ce document sert à valider le périmètre avant de commencer.
>
> Périmètre demandé : « l'onglet Remises comptoir et l'onglet Ramassage &
> livraison, avec les fonctionnalités de GPS de livraison ».

## 1. Ce qui existe déjà

Les deux premiers lots sont livrés et vérifiés. Il faut le savoir avant de
planifier la suite, pour ne pas refaire ce qui marche.

| Brique | État | Où |
| --- | --- | --- |
| Carte des tournées du jour, arrêts numérotés, itinéraire Google Maps / Waze | **livré** | `src/components/logistics/LogisticsMapView.tsx`, `src/lib/deliveryRoute.ts` |
| Position du coursier (GPS du téléphone ou point placé à la main) | **livré** | `src/lib/geo.ts` |
| Heure d'arrivée estimée (fourchette, détour inclus) | **livré** | `estimateArrival` dans `src/lib/geo.ts` |
| Lien `/tournee` ouvert sur le téléphone du coursier | **livré** | `src/components/courier/CourierPage.tsx` |
| Preuve de remise : photo, signature, code à 4 chiffres, nom du réceptionnaire | **livré** | `src/lib/deliveryProof.ts`, `ProofStep.tsx` |
| Exigences de preuve réglées par le propriétaire | **livré** | `Paramètres → Preuve de remise` |
| Remises comptoir : checklist, preuve attachée, blocage des commandes à livrer | **livré** | `src/components/workshop/HandoverSection.tsx` |
| Historique des positions | **local, 7 jours**, un seul navigateur | `src/lib/courierPositions.ts` |
| Tarif de livraison | **deux montants fixes** (ramassage / livraison), pas de zones | `Paramètres → Ramassage & livraison` |
| Adresse du client | **texte libre**, aucune coordonnée enregistrée | `Customer.address`, `LogisticsTask.address` |

Autrement dit : le GPS fonctionne **sur le téléphone du coursier**, mais rien
n'est partagé avec le comptoir, et le client ne voit rien.

## 2. Les cinq manques à combler

1. **Aucune coordonnée d'adresse.** On sait où est le coursier, pas où est le
   client. La carte ne peut pas placer les arrêts, et l'heure d'arrivée
   n'existe que pour l'arrêt en cours.
2. **Aucun suivi partagé.** La position du coursier reste dans son navigateur :
   le comptoir ne sait pas qu'il est arrivé, le client non plus.
3. **Aucun tarif par zone.** Un colis à Yopougon et un colis à Cocody coûtent
   le même prix, quel que soit le trajet.
4. **Aucun lien avec un compte.** Le « coursier » est choisi dans une liste
   d'employés, mais n'importe quel compte connecté voit toutes les tournées.
5. **La preuve n'est pas située.** La photo et le code sont horodatés, pas
   géolocalisés : impossible de démontrer que la remise a eu lieu sur place.

## 3. Ce que le web permet — et ce qu'il ne permet pas

C'est la partie qui décide de tout le reste. Une application web (pas une
application native) est soumise à trois limites physiques :

- **Le GPS ne tourne que lorsque l'écran est allumé et l'onglet au premier
  plan.** Sur iPhone, verrouiller le téléphone arrête la position ; sur
  Android, cela dépend du navigateur. Aucune promesse de « suivi continu »
  n'est donc tenable.
- **La permission est explicite.** Le coursier doit l'accorder ; sans elle,
  l'écran doit rester utilisable (point placé à la main, comme aujourd'hui).
- **La précision est variable** : 5 à 30 m en plein air, plusieurs centaines de
  mètres en intérieur ou entre les immeubles. On n'affiche jamais mieux que la
  précision annoncée par l'appareil.

**Conséquence de conception :** on ne vend pas un « tracker », on livre un
**suivi par étapes** — départ, arrivées, remises — complété par des positions
quand l'écran est allumé. C'est plus honnête et suffisant pour un pressing.

## 4. Architecture cible

```
 Téléphone du coursier            Base (Supabase)              Comptoir / Client
 ─────────────────────           ─────────────────             ─────────────────
 /tournee  ── position ───────►  delivery_positions   ──────►  Tournées → Carte
           ── arrivée ────────►  logistics_tasks      ──────►  Remises comptoir
           ── preuve + point ─►  delivery_proofs      ──────►  fiche commande
           ◄─ arrêts du jour ──  (RLS par agence)               /suivi/:token
```

Deux modes de partage, réglés séparément :

- **Interne** (comptoir ↔ coursier) : positions visibles par les membres de
  l'agence.
- **Externe** (client) : lien à jeton, limité dans le temps, révocable, qui
  n'expose **ni l'adresse exacte ni le tracé**.

## 5. Brique par brique

### 5.1 Donner des coordonnées aux adresses — le vrai prérequis

Trois approches, à choisir :

| Approche | Avantages | Limites | Coût |
| --- | --- | --- | --- |
| **A. Épingle posée une fois** (le coursier place le point sur la carte au premier passage, il est enregistré sur la fiche client) | gratuit, précis, fonctionne dans les quartiers sans adressage | demande 20 s au premier passage | 0 |
| **B. Géocodage OpenStreetMap (Nominatim)** | gratuit, automatique | couverture inégale à Abidjan, politique d'usage stricte (1 requête/s, attribution, pas de géocodage massif) | 0 |
| **C. Google Geocoding / Places** | meilleure couverture, autocomplétion d'adresse | clé API + facturation à l'usage, dépendance externe | à l'usage |

**Recommandation : A, avec C en option.** On enregistre le point sur la fiche
client (`deliveryPoint`), on garde l'adresse écrite comme aujourd'hui, et le
géocodage ne sert qu'à **proposer** un point que l'humain confirme. Rien ne part
chez un tiers sans que le propriétaire l'ait activé dans les paramètres.

Données ajoutées à la fiche client :

```ts
interface Customer {
  // …existant
  deliveryPoint?: GeoPoint;          // lat, lng, accuracyM, source, recordedAt
  deliveryPointLabel?: string;       // « Rue des Jardins, près de la pharmacie »
  deliveryPointUpdatedAt?: string;
}
```

Règle : à la création d'une tournée, le point du client est recopié dans la
tâche (`LogisticsTask.destination`, champ déjà présent) — la tournée garde la
position **du jour**, même si l'adresse est corrigée plus tard.

### 5.2 Zones et tarifs de livraison

Aujourd'hui : `pickupFee` et `deliveryFee`, deux montants uniques.

Cible : une grille de zones nommées par le pressing (les quartiers qu'il
livre), avec un tarif et un délai indicatif par zone.

```ts
interface DeliveryZone {
  id: string;
  name: string;              // « Cocody », « Yopougon »…
  feeXof: number;
  minDelayHours?: number;    // délai plancher annoncé au client
  isActive: boolean;
}
```

- La zone est **choisie à la création de la tournée** et son tarif est
  **figé sur la tâche** : changer la grille demain ne réécrit pas les
  livraisons d'hier.
- Zone inconnue ou non renseignée → tarif par défaut (l'actuel
  `deliveryFee`), et l'écran le dit.
- Facultatif : déduire la zone du **point** quand il existe (distance au
  pressing), mais uniquement en proposition.

### 5.3 Positions partagées entre appareils

Aujourd'hui les positions vivent dans `pressingpro_courier_positions`, purgées
à 7 jours, sur un seul navigateur. Pour que le comptoir les voie :

- Nouvelle table `public.delivery_positions` (`id`, `organization_id`,
  `shop_id`, `employee_id`, `courier_name`, `lat`, `lng`, `accuracy_m`,
  `source`, `recorded_at`), RLS : lecture pour les membres de l'agence,
  écriture pour le coursier porteur de la position.
- Envoi **au plus une position toutes les 45 s et 50 m** — les seuils déjà
  codés dans `courierPositions.ts` sont réutilisés tels quels, donc pas de
  surconsommation data.
- Purge : tâche quotidienne ou `delete … where recorded_at < now() - 7 days`
  au moment de la lecture (même règle que le local).
- Temps réel : abonnement Supabase Realtime sur la tournée du jour, **ou**
  rafraîchissement toutes les 60 s si l'abonnement n'est pas activé. Le second
  suffit pour démarrer et ne coûte rien.
- Repli : sans réseau, les positions restent locales et remontent au retour.

### 5.4 Lien de suivi pour le client

Un lien que le comptoir peut envoyer par WhatsApp/SMS :

```
https://<domaine>/suivi/<jeton>
```

- **Jeton aléatoire de 32 octets**, stocké haché, lié à une commande, avec
  date d'expiration (par défaut : 24 h après la livraison) et bouton
  **Révoquer** côté pressing.
- Page publique, **sans connexion** : numéro de ticket, articles, statut,
  fenêtre d'arrivée estimée, « votre linge est en route », « livré ».
- **Aucune adresse exacte, aucun tracé, aucune position brute** : tout au plus
  « le coursier est à environ 1,2 km ». C'est une protection du client comme
  du pressing.
- Le lien ne donne accès qu'à **une** commande : ni le nom du pressing n'est
  exposé en clair, ni le téléphone du coursier.

### 5.5 Preuve de remise située

La preuve existe (photo, signature, code, nom). On ajoute :

- `proof.location?: GeoPoint` — position au moment de la capture, avec sa
  précision, et `proof.locationMatchesDestination?: boolean` calculé si la
  destination est connue ;
- affichage dans **Remises comptoir** : « Remis à 14 h 22 · à 35 m du point
  prévu » avec lien « voir sur la carte » ;
- jamais de blocage : une preuve hors zone ou sans GPS reste valide, elle est
  seulement signalée (même philosophie que les preuves facultatives).

### 5.6 Rattacher un compte à un employé (rôle coursier)

Le type `EmployeeRole` connaît déjà `courier`, mais aucun écran ne restreint la
navigation. Cible :

- `employees.user_id` (nullable) : le propriétaire rattache un compte au
  coursier depuis **Personnel** ;
- un coursier connecté ne voit que : **Ma tournée**, ses remises, ses preuves.
  Ni chiffre d'affaires, ni prix des prestations, ni paramètres ;
- l'écran de tournée ne permet de lire que **les arrêts qui lui sont
  affectés** (filtre serveur, pas seulement visuel).

C'est ce lot qui rend le GPS réellement utile en équipe ; sans lui, la
géolocalisation reste une commodité du patron.

### 5.7 Tournée optimisée (optionnel, en dernier)

Un simple « plus proche voisin » à partir du pressing, en respectant les
créneaux promis, avec réordonnancement manuel possible. Pas de solveur, pas de
promesse de trafic : la météo d'Abidjan n'est pas dans nos données.

### 5.8 Notifications au client (à trancher)

Aucun fournisseur SMS/WhatsApp n'est branché aujourd'hui, et on ne va pas
inventer un envoi. Trois niveaux :

1. **Manuel** (par défaut) : « Copier le message » + ouverture de WhatsApp avec
   le lien de suivi.
2. **SMS via un fournisseur** : coût par message, contrat, clé API ; à décider
   en connaissance de cause.
3. **Notifications navigateur** : peu fiables sur iPhone, à écarter.

## 6. Modèle de données

### Types applicatifs (ajouts)

```ts
// Customer
deliveryPoint?: GeoPoint;
deliveryPointLabel?: string;
deliveryPointUpdatedAt?: string;

// LogisticsTask
zoneId?: string;
zoneName?: string;
deliveryFeeXof?: number;      // tarif figé à la création
distanceKm?: number;          // distance pressing → destination

// DeliveryProof
location?: GeoPoint;
locationMatchesDestination?: boolean;

// ShopSettings
deliveryZones: DeliveryZone[];
trackingLinkEnabled: boolean;
shareCourierPositionWithCustomer: boolean;
```

### Migration Supabase (esquisse)

```sql
-- 1. Zones : stockées dans l'instantané des paramètres, rien à créer.
-- 2. Positions partagées
create table public.delivery_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  employee_id uuid,
  courier_name text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m integer,
  source text not null check (source in ('device', 'manual')),
  recorded_at timestamptz not null default now()
);
-- index (shop_id, recorded_at desc) ; RLS par has_shop_access ; pas de delete public.

-- 3. Jetons de suivi
create table public.delivery_tracking_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null,
  order_id uuid not null,
  token_hash text not null unique,   -- jamais le jeton en clair
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

-- 4. Compte ↔ employé
alter table public.employees add column user_id uuid;
```

Chaque table suit les règles déjà en place dans le dépôt : `organization_id` +
`shop_id`, RLS `has_shop_access`, droits **par colonne**, aucune politique de
suppression là où l'historique compte.

## 7. Ce que chaque onglet gagne

### 7.1 Paramètres → Ramassage & livraison

Quatre sections dépliables, dans cet ordre :

1. **Tarifs** : montants par défaut (existant) + **grille de zones** (ajouter,
   renommer, activer, supprimer une zone jamais utilisée).
2. **Suivi GPS** : interrupteurs
   - « Partager la position du coursier avec le comptoir » ;
   - « Envoyer un lien de suivi au client » ;
   - « Autoriser le coursier à placer l'adresse sur la carte ».
3. **Preuve de remise** : exigences existantes + « exiger que la preuve soit
   géolocalisée » (désactivé par défaut, jamais rétroactif).
4. **Lien de suivi** : durée de validité (6 h / 24 h / 7 jours), bouton
   « Révoquer tous les liens actifs ».

### 7.2 Remises comptoir

- Bandeau **« Où est le coursier »** : dernier point connu, âge de la mesure
  (« il y a 3 min »), bouton *Voir sur la carte*.
- Dans la fiche de remise : **preuve située** (§ 5.5) et, pour une commande à
  livrer, le rappel « à remettre au coursier, pas au comptoir » (déjà présent).
- Bouton **« Envoyer le lien de suivi »** (copier / WhatsApp).

### 7.3 Tournées → Carte

- Les **arrêts sont enfin placés** grâce aux coordonnées des clients ; ceux
  sans point sont listés à part « à situer » (aucune invention de position).
- Filtre « aujourd'hui / en cours / terminé », comme aujourd'hui.
- Distance totale et temps estimé de la tournée.

### 7.4 /tournee (téléphone du coursier)

- « Prochain arrêt » en haut : distance, cap, bouton *Itinéraire*.
- Enregistrement de l'arrivée (déjà présent) + **envoi des positions** (§ 5.3).
- Preuve : photo, signature, code, **point GPS** au moment de la remise.
- Hors réseau : file d'attente locale, envoi au retour — sans bloquer la remise.

### 7.5 /suivi/:jeton (public)

Bandeau d'état vertical : *reçu → en traitement → prêt → en livraison → livré*,
avec la fenêtre horaire quand elle existe. Aucun prix, aucune adresse exacte,
aucune position brute.

## 8. Cas limites à traiter

| Cas | Comportement prévu |
| --- | --- |
| Permission GPS refusée | l'écran fonctionne : point placé à la main, aucune relance harcelante |
| Téléphone verrouillé en route | les positions s'arrêtent ; le comptoir voit « dernière mesure il y a 12 min » |
| Client absent | preuve avec `note`, statut « échec » et motif (déjà codé) ; le point est conservé |
| Adresse introuvable | le coursier place le point ; il est proposé au propriétaire pour la fiche client |
| Réseau coupé | remise possible hors ligne, positions et preuves en attente, envoi au retour |
| Deux coursiers sur la même tournée | positions distinctes (par employé), le dernier point gagne pour l'affichage |
| Commande annulée en route | le lien de suivi affiche « annulée » et expire immédiatement |
| Jeton partagé à tort | révocation en un clic, expiration courte par défaut |
| Photo trop lourde | compression avant stockage (limite déjà en place : 350 000 caractères) |
| Preuve sans GPS | acceptée, signalée « non située » |

## 9. Vie privée et sécurité

- **La géolocalisation d'un salarié est une donnée personnelle.** Au regard de
  la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des
  données à caractère personnel, cela suppose une information préalable,
  un consentement du coursier, une finalité limitée (la tournée) et une durée
  de conservation courte (7 jours, comme aujourd'hui). **À faire valider par un
  juriste avant mise en service** ; ce document ne remplace pas un avis.
- Le partage au client est **opt-in**, limité à une commande, sans position
  brute.
- Jetons stockés **hachés**, comparaison à temps constant, pas de jeton dans
  les journaux.
- RLS stricte : un membre d'une agence ne lit jamais la position d'une autre.
- Aucune donnée GPS n'est envoyée à un tiers sans que le propriétaire ait
  activé un service de géocodage.

## 10. Découpage proposé

| Phase | Contenu | Charge | Ce qu'elle débloque |
| --- | --- | --- | --- |
| **2A** | Zone tarifaire + adresse épinglable + preuve située (100 % local, aucun service externe) | 3–4 j | arrêts sur la carte, tarif juste, preuve démontrable |
| **2B** | Lien de suivi client (jeton + page publique) | 3 j | le client sait où en est son linge |
| **3** | Positions partagées + Supabase + RLS + PGlite | 4–6 j | le comptoir voit le coursier, multi-appareils |
| **4** | Compte ↔ employé, navigation coursier restreinte | 2–3 j | usage en équipe, données cloisonnées |
| **5** | Hors ligne + tournée optimisée + notifications (option) | 3 j | confort, à décider après usage réel |

**Recommandation : commencer par 2A.** C'est la phase qui améliore le plus
l'existant pour le moins de risque : aucune clé, aucun service externe, aucune
donnée personnelle nouvelle, et elle rend la carte réellement utile.

## 11. Tests prévus

- **Unitaires** : fusion des zones, tarif figé, calcul de distance et de
  fourchette, jeton (génération, hachage, expiration, révocation), refus si
  coordonnées hors bornes, appariement du point client.
- **PGlite** : RLS des positions et des jetons (un membre d'une autre agence ne
  lit rien), écriture refusée au caissier, purge des positions anciennes,
  lecture d'un jeton expiré.
- **Playwright (CI uniquement)** : permission GPS simulée
  (`context.setGeolocation`) pour vérifier l'enregistrement du point et
  l'affichage de l'arrivée, sans dépendre d'un vrai téléphone.
- **Manuel, sur téléphone** : parcours réel avec verrouillage d'écran, perte de
  réseau, refus de permission — c'est le seul moyen de valider § 3.

## 12. Ce que je ne peux pas vérifier depuis cet environnement

- **Aucune vérification sur un vrai téléphone** : la précision GPS, la
  consommation de batterie et le comportement écran verrouillé restent à
  mesurer sur le terrain.
- **Pas de navigateur dans le sandbox côté preview** : les cartes s'affichent
  sans tuiles ici (pas de réseau sortant vers OpenStreetMap) ; le rendu carte
  est donc vérifié par les tests de données et en CI, pas à l'œil.
- **Pas de clé de géocodage** : l'option C (Google) ne peut pas être testée
  sans clé fournie par vous.

## 13. Décisions à trancher

1. **Adresses** : épingle manuelle seule (gratuit, recommandé), ou géocodage
   Google en plus ?
2. **Géolocalisation des employés** : acceptée avec consentement écrit et
   durée de conservation de 7 jours ?
3. **Suivi client** : lien à jeton (phase 2B) maintenant, ou plus tard ?
4. **Notifications** : message manuel WhatsApp (par défaut) ou fournisseur SMS
   payant ?
5. **Ordre** : valider la phase 2A telle que décrite, ou fusionner 2A + 2B ?
