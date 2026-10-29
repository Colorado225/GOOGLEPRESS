# Preuve de remise des livraisons — phase 0

**Date :** 28 octobre 2026 · **Branche :** `arena/7aed267c-googlepress`
**Statut :** livré. Le suivi GPS (positions, carte, heure d'arrivée) reste la
phase 1 de [`docs/SUIVI-GPS-LIVRAISON.md`](SUIVI-GPS-LIVRAISON.md) ; ce lot-ci
met en place ce qui ne dépend ni du GPS ni d'un service externe.

## 1. À quoi ça sert

Prouver qu'une livraison a bien eu lieu : qui a reçu le linge, quand, avec
quelle photo, et éventuellement le code à 4 chiffres communiqué au client.
En cas de contestation (« je n'ai jamais reçu ma chemise »), le comptoir ouvre
la commande et montre la preuve — ou dit clairement qu'il n'y en a pas.

## 2. Parcours concret

1. **Création d'une commande avec livraison à domicile** : un code de remise à
   4 chiffres est généré et attaché à la tournée. Il apparaît sur la carte de
   tournée avec la mention « à communiquer au client ».
2. **Sur la route** : chaque tournée propose deux liens de navigation,
   **Itinéraire** (Google Maps) et **Waze**, construits depuis l'adresse saisie.
   Aucune clé, aucune carte intégrée.
3. **Arrivée** : le bouton **Arrivé sur place** horodate le passage ; la
   livraison reste « en route » jusqu'à la confirmation.
4. **Confirmation** : la fenêtre de remise contient un bloc **Preuve de remise**
   — photo (appareil photo du téléphone, compressée à 320 px), nom du
   réceptionnaire, code à 4 chiffres, signature au doigt, note libre.
5. **Consultation** : depuis la tournée terminée, le bouton **Preuve de
   remise** ouvre la fiche complète (photo, signature, réceptionnaire,
   horodatage, coursier, note). La même fiche apparaît dans **Remises comptoir**
   pour une commande livrée à domicile — ou dit explicitement qu'aucune preuve
   n'a été enregistrée.

## 3. Où c'est dans l'application

| Écran | Ce qui a été ajouté |
| --- | --- |
| **Production & Remise → Tournées** | Liens *Itinéraire* / *Waze*, jalon *Arrivé sur place*, code de remise, résumé de preuve et bouton **Preuve de remise** (fenêtre en lecture seule) sur les livraisons terminées. |
| **Fenêtre « Confirmer la livraison »** | Bloc complet de preuve (photo, réceptionnaire, code, signature, note). |
| **Production & Remise → Remises comptoir** | Fiche de preuve en lecture seule pour les commandes en livraison à domicile. |
| **Paramètres → Ramassage & livraison** | Nouvel encart « Preuve de remise des livraisons » : photo, signature et/ou code obligatoires. |

## 4. Ce qui est obligatoire — et ce qui ne l'est pas

Par défaut, **rien n'est obligatoire** : activer une contrainte sans que le
pressing l'ait demandée bloquerait des livraisons en cours. Le propriétaire
coche ce qu'il veut dans les Paramètres ; une preuve manquante bloque alors la
confirmation, avec un message explicite (« Ajoutez la photo du linge remis. »,
« Le code de remise ne correspond pas à celui de cette livraison. »).

Deux exceptions volontaires :

- **Livraisons antérieures** : elles n'ont pas de code. Même si le code devient
  obligatoire, la saisie reste facultative pour elles, et la fenêtre le dit.
- **Photo ou signature fournies mais illisibles** : elles sont refusées
  (format, taille), sans jamais être remplacées par une valeur inventée.

## 5. Données enregistrées

La preuve vit sur la tournée (`LogisticsTask.proof`), dans
`localStorage['pressingpro_logistics_tasks']`, avec la commande et la tournée :

```ts
interface DeliveryProof {
  photoDataUrl?: string;      // ≤ 350 000 caractères, WebP/PNG 320 px
  signatureDataUrl?: string;  // ≤ 40 000 caractères, PNG
  codeEntered?: string;       // 4 chiffres
  receiverName?: string;      // ≤ 60 caractères
  note?: string;              // ≤ 300 caractères
  capturedAt: string;         // horodatage ISO
  capturedByEmployeeId?: string;
  capturedByEmployeeName?: string;
}
```

**Immuabilité :** une preuve enregistrée n'est jamais réécrite par l'interface.
La relire depuis le stockage écarte ce qui est inexploitable (photo distante,
base64 invalide, horodatage absent) et conserve le reste.

## 6. Ce qui n'est pas encore là

- **Positions GPS, carte, heure d'arrivée** : phase 1 du plan, non commencée.
- **Preuve ajoutée après coup** : non proposé à l'écran ; une livraison
  confirmée sans preuve le reste. C'est un choix conservateur, à rouvrir si le
  terrain le réclame.
- **Code réellement secret** : le code est visible par l'équipe sur la carte de
  tournée (même écran que celui du coursier). Il contrôle une erreur de tournée,
  pas une fraude déterminée. Il deviendra réellement confidentiel quand
  l'espace coursier (phase 1) séparera les droits.
- **Envoi du code au client** : le code est affiché à l'équipe pour être
  communiqué oralement ou par SMS. Aucun envoi automatique n'a été inventé.

## 7. Limites de vérification, dites franchement

- **Aucun navigateur dans mon environnement** : la capture photo réelle, le
  dessin de la signature au doigt et l'ouverture de Google Maps / Waze n'ont pas
  été exécutés ici. Le rendu et la logique sont vérifiés, pas le geste physique.
- **Playwright (CI)** : les scénarios existants ne couvrent pas ce bloc ; il n'a
  pas été ajouté pour ne pas élargir le lot. La recette sur téléphone reste à
  faire côté pressing.
- Tout est **local au navigateur** : aucun envoi vers Supabase, comme le reste
  du module logistique aujourd'hui.

## 8. Vérifications effectuées

- `npx tsc --noEmit` et `npm run lint` : propres.
- **Tests unitaires** : 6 cas sur les liens d'itinéraire, 17 cas sur la preuve
  (génération de code, obligations, formats, plafonds, relecture, note seule),
  1 cas sur la relecture d'une tournée stockée.
- **Rendu serveur (SSR)** : tournées seedées → Itinéraire et Waze présents et
  encodés, code `7788` affiché puis masqué une fois la livraison confirmée,
  jalon d'arrivée, « Preuve de remise … Réceptionné par Awa Koné », photo
  rendue dans la fiche, mention « sans preuve enregistrée », encart des
  Paramètres avec ses trois cases.
- `npm run build` : OK.

## 9. Fichiers

- `src/lib/deliveryProof.ts` — génération du code, contrôle, construction,
  relecture et description de la preuve.
- `src/lib/deliveryRoute.ts` — liens Google Maps / Waze, nettoyage d'adresse.
- `src/components/logistics/DeliveryProofFields.tsx` — saisie (photo,
  réceptionnaire, code, signature, note).
- `src/components/logistics/DeliveryProofPanel.tsx` — fiche en lecture seule.
- `src/components/logistics/LogisticsTaskCard.tsx`,
  `LogisticsActionModal.tsx`, `src/components/workshop/HandoverSection.tsx` —
  intégration aux écrans existants.
- `src/context/AppContext.tsx` — jalons, validation et enregistrement.
- `src/types/index.ts`, `src/lib/shopSettings.ts`,
  `src/components/settings/SettingsPage.tsx` — réglages.
- `tests/unit/deliveryProof.test.ts`, `tests/unit/deliveryRoute.test.ts`,
  `tests/unit/logistics.test.ts`.
