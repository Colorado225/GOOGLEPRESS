# Suivi GPS de livraison — le reste à faire

**Date :** 28 octobre 2026 · **Branche :** `arena/7aed267c-googlepress`
**Statut :** **proposition à valider** — aucun code écrit pour ce lot.
Les phases 0 et 1 sont déjà livrées ; ce document décrit ce qui reste pour que
« le GPS de livraison » serve vraiment dans **Remises comptoir** et
**Ramassage & livraison**, et dans quel ordre le construire.

---

## 1. La demande, reformulée

> « ok l'onglet remises et livraison. je veux implémenter des fonctionnalités
> de GPDS. comment faire ? »

« GPDS » = **GPS de livraison**. Les deux onglets cités sont :

- **Production & Remise → Remises comptoir** : la restitution du linge, y
  compris les commandes livrées à domicile ;
- **Paramètres → Ramassage & livraison** : les règles et tarifs des tournées.

L'objectif métier, dit simplement : **savoir où est le linge, quand il arrive,
et pouvoir le prouver** — sans transformer le pressing en compagnie de
logistique.

## 2. Ce qui existe déjà (constat, pas intention)

| Brique | État | Où |
| --- | --- | --- |
| Preuve de remise (photo, signature, code à 4 chiffres, réceptionnaire, note) | ✅ livrée | `src/lib/deliveryProof.ts`, `LogisticsActionModal` |
| Jalons *parti / arrivé / livré* | ✅ livrés | `LogisticsTask.startedAt`, `arrivedAt`, `completedAt` |
| Itinéraire Google Maps / Waze depuis l'adresse | ✅ livré | `src/lib/deliveryRoute.ts` |
| Point de livraison posé sur une carte | ✅ livré | `DestinationPickerModal`, `LogisticsTask.destination` |
| Partage de position depuis le téléphone (45 s / 50 m) | ✅ livré | `CourierTrackingControl`, `courierPositions.ts` |
| Heure d'arrivée en fourchette + fraîcheur de la position | ✅ livré | `geo.ts` (`estimateArrival`) |
| Carte Leaflet/OSM, liste + carte des tournées | ✅ livré | `TourMap`, `TourMapPanel` |
| Écran coursier plein écran `/tournee` | ✅ livré | `CourierPage.tsx` |
| Réglages GPS (activation, partage, vitesse, détour, validité) | ✅ livré | `SettingsPage` onglet *Ramassage & livraison* |
| Position visible sur un autre appareil (comptoir pendant que le coursier roule) | ❌ non | positions stockées en local, non partagées |
| Client final informé (lien de suivi) | ❌ non | — |
| Frais par quartier / zone tarifaire | ❌ non | deux montants forfaitaires seulement |
| Adresse → coordonnées automatique (géocodage) | ❌ non | adresse en texte libre |
| Compte de connexion ⇄ fiche employé (rôle coursier restreint) | ❌ non | rôle `courier` défini, jamais utilisé pour restreindre l'écran |
| Notification SMS / WhatsApp automatique | ❌ non | aucun fournisseur branché (position assumée du produit) |
| Optimisation d'itinéraire multi-arrêts | ❌ non | ordre par créneau, puis saisie |

Autrement dit : **le GPS fonctionne sur le téléphone du coursier, pas encore
entre les appareils**. Aujourd'hui, le comptoir ne voit la position que si
c'est le même navigateur ; le client ne voit rien.

## 3. Ce que le Web autorise réellement (à lire avant de promettre)

C'est le point qui décide de tout le reste.

- **HTTPS obligatoire** : déjà en place (Vercel).
- **Autorisation explicite** : l'utilisateur peut refuser, et le refus doit
  rester sans conséquence sur la tournée.
- **Onglet au premier plan uniquement.** Dès que l'écran se verrouille ou que
  le navigateur passe en arrière-plan, iOS Safari **arrête** `watchPosition`.
  Chrome Android est un peu plus tolérant, jamais garanti.
- **Batterie et data** : un suivi continu vide la batterie en une tournée ;
  d'où le rythme actuel (45 s / 50 m) et le partage déclenché à la main.
- **Précision** : 5 à 30 m en extérieur, plusieurs centaines de mètres en
  zone dense ou en intérieur. Toute heure d'arrivée est une **fourchette**.
- **Pas d'application native** : aucune promesse de « suivi continu écran
  éteint » ne peut être tenue. Le plan est donc construit autour d'un modèle
  **check-in** (le coursier agit à chaque étape) plutôt que d'un traceur
  permanent.

Conséquence de conception : **la valeur ne doit pas dépendre de la position**.
Chaque écran reste utilisable si le GPS refuse, si le réseau tombe ou si le
téléphone n'a pas de data — il dit alors pourquoi et propose l'action manuelle.

## 4. Les briques à construire

```
      Adresse du client
             │
      (A) point de livraison  ──────► figé sur la fiche client
             │
 (B) positions du coursier ──► (C) carte + (D) heure d'arrivée
             │                                │
             ├──► (E) preuve géolocalisée      ├──► (F) lien client à jeton
             │                                 └──► (G) zones tarifaires
             └──► (H) compte ⇄ employé (rôle coursier)
```

### (A) Adresse → point sur la carte

Trois options, à trancher :

1. **Point posé à la main, une fois par client** (recommandé) — le coursier
   (« Utiliser ma position ») ou le comptoir place le point au premier passage,
   il est mémorisé sur la fiche client puis réutilisé pour toutes ses tournées.
   Zéro coût, zéro clé, précision réelle. C'est le prolongement naturel de
   `DestinationPickerModal` déjà livré.
2. **Géocodage automatique** — adresse texte → coordonnées. OSM/Nominatim est
   gratuit mais sa politique d'usage interdit un trafic soutenu et sa couverture
   des quartiers d'Abidjan est inégale ; Google/Mapbox donnent de meilleurs
   résultats mais demandent une clé, un compte de facturation et un quota.
3. **Les deux** : tentative de géocodage, puis correction à la main.

Recommandation : **1 d'abord**, géocodage facultatif plus tard, derrière un
réglage et une clé fournie par vous.

Modèle : `Customer.deliveryPoint?: GeoPoint`, `deliveryPointSource:
'manual' | 'gps' | 'geocoded'`, `deliveryPointUpdatedAt`.

### (B) Positions du coursier

Le partage existe, mais il vit dans le navigateur du coursier. Pour que le
comptoir le voie :

- table Supabase `delivery_positions` (`organization_id`, `task_id`,
  `employee_id`, `lat`, `lng`, `accuracy_m`, `recorded_at`) ;
- écriture autorisée au coursier authentifié pour **ses** tournées en route ;
- lecture réservée au personnel de l'organisation ; **aucun accès public** ;
- purge automatique après 7 jours (même règle qu'aujourd'hui) ;
- Supabase Realtime pour l'affichage au comptoir, avec repli en lecture
  périodique (30 s) si le canal temps réel échoue.

Sans backend (aujourd'hui), la position reste locale : c'est acceptable pour un
seul téléphone par pressing, pas pour un patron qui veut suivre.

### (C) Carte

Leaflet + OSM suffit pour une tournée (≤ 20 arrêts). À prévoir :

- regroupement des marqueurs au-delà de ~50 points, sinon la carte devient
  illisible ;
- politique d'usage des tuiles OSM respectée (attribution visible, pas de
  préchargement massif) ; si le volume grandit, une clé MapTiler/Mapbox ;
- aucune tuile en cache hors-ligne pour l'instant (phase optionnelle).

### (D) Heure d'arrivée

`estimateArrival` donne déjà une fourchette à partir d'une position, d'une
vitesse moyenne et d'un facteur de détour. Améliorations utiles :

- **arrêts restants** dans le calcul (aujourd'hui : une seule course) ;
- **temps de service** par arrêt (paramètre, 5 min par défaut) ;
- message explicite quand aucune position n'est disponible : « heure
  d'arrivée inconnue », jamais une invention.

### (E) Preuve de remise géolocalisée

La preuve existe. Ajout à faible coût : enregistrer au moment de la capture
`lat`, `lng`, `accuracy` et l'horodatage de l'appareil, puis afficher
« remise à 14 h 32 · ± 12 m · 5,2481, -3,9912 » dans la fiche de preuve — et un
lien *Voir sur la carte* depuis **Remises comptoir**. Utile en cas de
contestation, sans dépendre d'un service externe.

### (F) Lien de suivi pour le client

- URL `/suivi/<jeton>` sans connexion ; jeton de 32 octets, non devinable,
  révocable, expiration par défaut 6 h après la livraison.
- Contenu : statut (« en route », « arrivé », « livré »), fourchette d'arrivée,
  distance **arrondie** (ex. « à environ 1,2 km »), nom du coursier.
  **Pas d'adresse exacte ni de trace complète** : la position du coursier
  n'est pas une information à diffuser telle quelle.
- Envoi du lien : message copiable et ouverture WhatsApp/iMessage (comme le
  message client actuel), **pas** de SMS automatique — aucun fournisseur n'est
  branché et cela reste une décision commerciale.
- Bandeau « partage arrêté » dès la livraison confirmée.

### (G) Zones tarifaires

Aujourd'hui : deux montants forfaitaires (`pickupFee`, `deliveryFee`). Demain :

- table `delivery_zones` par organisation : quartier, frais, délai indicatif ;
- résolution au moment de la création de la tournée, **frais figé** ensuite
  (même règle que les prix de prestation) ;
- quartier inconnu → tarif par défaut, clairement affiché ;
- écran Paramètres → *Ramassage & livraison* : liste éditable, ajout/suppression,
  import simple par copier-coller.

### (H) Compte de connexion ⇄ fiche employé

Aujourd'hui, l'écran coursier demande de **choisir son nom** sur l'appareil.
C'est honnête et ça marche, mais n'importe qui peut choisir n'importe qui.
Pour un vrai espace coursier :

- rattacher l'utilisateur à un employé (`employees.user_id`) via le flux
  d'invitation existant ;
- rôle `courier` : accès à `/tournee`, au détail de **ses** commandes, sans
  les chiffres de marge ni les écrans de gestion ;
- code de remise masqué pour les autres rôles sur les livraisons en cours ;
- journal d'audit : qui a confirmé quoi, à quelle heure.

### (I) Optimisation de tournée — plus tard

Trier les arrêts par plus proche voisin à l'intérieur d'un créneau, avec
réorganisation manuelle par glisser-déposer. Gain réel mais secondaire : la
plupart des pressings ont 3 à 8 courses par jour, dans deux ou trois quartiers.

## 5. Données

```ts
// src/types/index.ts — ajouts proposés
interface Customer {
  deliveryPoint?: GeoPoint;            // point posé une fois
  deliveryPointSource?: 'manual' | 'gps' | 'geocoded';
  deliveryPointUpdatedAt?: string;
}

interface DeliveryProof {
  lat?: number;                        // position au moment de la remise
  lng?: number;
  accuracyM?: number;
}

interface DeliveryZone {
  id: string;
  district: string;                    // « Cocody », « Yopougon »…
  fee: number;                         // FCFA
  etaMinutes?: number;
  isActive: boolean;
}

interface ShopSettings {
  deliveryZones: DeliveryZone[];       // vide = frais forfaitaires actuels
  deliveryTracking: {
    customerLinkEnabled: boolean;      // défaut : false
    linkTtlHours: number;              // défaut : 6
    shareExactPosition: boolean;       // défaut : false
  };
}
```

Tables Supabase (phase 3 seulement) : `delivery_positions`, `delivery_shares`,
`delivery_zones`, colonnes `users.employee_id`.

## 6. Écrans, onglet par onglet

**Paramètres → Ramassage & livraison** (existe, à compléter)

| Section | Contenu |
| --- | --- |
| Tarifs | frais de ramassage / livraison par défaut — *existe* |
| Zones | tableau quartier → frais, ajout, suppression, tarif de repli |
| GPS | activation carte, partage, vitesse, détour, validité — *existe* |
| Suivi client | lien activé, durée de validité, position arrondie ou non |
| Preuve | photo obligatoire ? code obligatoire ? signature ? |

**Production & Remise → Remises comptoir** (existe, à compléter)

- bloc de preuve déjà affiché pour les livraisons à domicile ;
- ajout : position de la remise (« ± 12 m »), lien *Voir sur la carte*,
  mention explicite « remise hors du point prévu » si l'écart dépasse 250 m ;
- rien à changer au blocage actuel : une commande à livrer ne se solde pas au
  comptoir, elle passe par la tournée.

**Production & Remise → Tournées**

- vue Carte déjà livrée : arrêts + dernière position connue de chaque coursier ;
- ajout : âge de la position en clair (« il y a 40 s », « il y a 12 min —
  non actualisée ») et bouton *Actualiser*.

**Écran coursier `/tournee`** (livré)

- ajout : distance au prochain arrêt, « ouvrir dans Waze », et rappel du point
  de livraison mémorisé du client ;
- avertissement « partage interrompu » si le navigateur a suspendu le suivi.

**Page publique `/suivi/<jeton>`** (à créer)

- une seule colonne, lisible sur un téléphone d'entrée de gamme ;
- statut, fourchette, distance arrondie, numéro du pressing ;
- aucune donnée client au-delà du prénom et du numéro de ticket.

## 7. Règles et cas limites

| Cas | Comportement prévu |
| --- | --- |
| Autorisation GPS refusée | tournée utilisable ; bandeau « position non partagée » ; aucun blocage |
| Position périmée (> validité) | aucune heure d'arrivée ; mention de l'âge |
| Réseau coupé en cours de route | positions mises en file locale, envoyées au retour ; jalons conservés |
| Adresse introuvable | point posé à la main, sinon itinéraire depuis l'adresse texte |
| Client absent | échec motivé, aucune preuve inventée, reprogrammation manuelle |
| Deux coursiers sur la même tournée | dernier arrivé gagne, avec journal ; pas de fusion silencieuse |
| Tournée annulée alors qu'un coursier roule | partage coupé, statut annulé prioritaire |
| Jeton de suivi partagé ou fuité | révocable en un clic depuis la commande, expiration courte |
| Preuve dépassant les limites (photo > 350 ko, signature > 40 ko) | compression avant enregistrement, message clair si refus |
| Téléphone partagé entre coursiers | choix local mémorisé, changement en deux gestes ; le rattachement compte ⇄ employé règle le fond |

## 8. Vie privée et sécurité

- La position d'un salarié est une **donnée personnelle** : information
  préalable, consentement écrit, usage limité au temps de service, conservation
  courte. Le cadre ivoirien (loi n° 2013-450 relative à la protection des
  données à caractère personnel, autorité ARTCI) doit être confirmé par un
  juriste avant mise en service — ce n'est pas un avis juridique.
- Aucune position en dehors des tournées `en_route`.
- Aucune position dans les journaux serveur ni dans les rapports.
- Jeton client : opaque, à durée de vie, révocable, sans coordonnées exactes.
- Écritures Supabase soumises à RLS : le coursier n'écrit que pour ses tournées,
  le client ne lit rien d'autre que sa page à jeton.

## 9. Découpage proposé

| Lot | Contenu | Dépendance | Effort |
| --- | --- | --- | --- |
| **2A — Précision & preuve** | point de livraison mémorisé par client, réutilisation automatique, géolocalisation de la preuve, écart au point prévu dans Remises comptoir | aucune | 2 à 3 jours |
| **2B — Zones tarifaires** | table des quartiers, tarif figé, repli, écran Paramètres | aucune | 2 jours |
| **2C — Lien de suivi client** | jetons, page publique, révocation, bouton d'envoi | aucune (stockage local) ou Supabase pour multi-appareils | 2 à 3 jours |
| **3 — Positions partagées** | tables Supabase, RLS, Realtime, repli périodique, purge | projet Supabase réel | 4 à 6 jours |
| **4 — Rôle coursier** | rattachement compte ⇄ employé, navigation restreinte, code masqué, audit | flux d'invitation existant | 2 à 3 jours |
| **5 — Confort** | optimisation d'arrêts, cache de tuiles hors-ligne, notifications | — | 3 jours (optionnel) |

Chemins critiques : **2A** apporte la valeur immédiate (moins d'appels
« où est ma chemise ? ») sans aucune dépendance ; **3** est le seul lot qui
change vraiment l'expérience du comptoir ; **4** est un sujet de confiance,
pas de fonctionnalité.

## 10. Vérifications prévues

- **Tests unitaires** : résolution du point client (manuel, GPS, géocodé,
  absent), écart au point, tarif de zone (connu, inconnu, désactivé),
  jeton (génération, expiration, révocation), preuve géolocalisée (coordonnées
  valides/invalides, précision), heure d'arrivée avec arrêts restants.
- **Rendu serveur** : bloc preuve + écart dans Remises comptoir, section Zones
  des Paramètres, page `/suivi` avec jeton valide, expiré, révoqué.
- **Playwright en CI uniquement** : `context.grantPermissions(['geolocation'])`
  + `setGeolocation` permettent de simuler une position sans téléphone. Les
  tuiles OSM ne sont pas garanties dans l'environnement de test ; le test doit
  tolérer une carte vide sans échouer sur l'essentiel.
- **Ce que je ne pourrai pas vérifier ici** : la précision réelle en rue,
  l'arrêt du suivi à l'extinction de l'écran, le comportement iPhone, la
  consommation de batterie, le rendu au soleil. Ces points demandent un
  téléphone et une tournée réelle.

## 11. Décisions à trancher

| # | Question | Recommandation |
| --- | --- | --- |
| 1 | Point de livraison : posé à la main, géocodé, ou les deux ? | posé à la main d'abord ; géocodage facultatif ensuite |
| 2 | Le client reçoit-il un lien de suivi ? | oui, mais statut + fourchette + distance arrondie, jamais la position exacte |
| 3 | Positions partagées entre appareils : tout de suite ? | non — après 2A ; c'est le lot 3, avec Supabase |
| 4 | Zones tarifaires par quartier : maintenant ? | oui (lot 2B), léger et très attendu au comptoir |
| 5 | Un coursier = un compte de connexion ? | oui à terme (lot 4) ; le choix local reste le repli |
| 6 | Notifications SMS/WhatsApp automatiques ? | non pour l'instant : message copiable, lien WhatsApp manuel |

## 12. Suite immédiate si vous validez

1. **Lot 2A** : point de livraison mémorisé par client + preuve géolocalisée +
   écart dans Remises comptoir — livrable en un lot, testé, sans dépendance
   externe.
2. **Lot 2B** : zones tarifaires paramétrables.
3. **Lot 2C** : page `/suivi/<jeton>`.
4. Ensuite seulement, décider du passage aux positions partagées via Supabase.

Rien de ce document n'est engagé : dites-moi ce que vous gardez, ce que vous
retirez, et dans quel ordre.
