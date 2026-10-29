# Paramètres enregistrés dans la base

**Date :** 28 octobre 2026 · **Branche :** `arena/7aed267c-googlepress`
**Statut :** livré.

## 1. Le problème

Jusqu'ici, l'écran **Paramètres** n'écrivait que dans le navigateur
(`pressingpro_shop_settings`). Trois conséquences, toutes visibles en
production :

- deux appareils du même pressing pouvaient afficher **deux configurations
  différentes** ;
- vider les données du navigateur — ou changer de téléphone — **effaçait la
  grille tarifaire**, les prestations, les vêtements créés, les réglages de
  livraison et de preuve ;
- la base connaissait les tarifs de ramassage/livraison (colonnes
  `pickup_fee_xof`, `delivery_fee_xof`) mais ignorait tout du reste.

Désormais, **chaque enregistrement part vers la base** dès qu'un compte réel
est ouvert, et l'écran dit franchement s'il est arrivé.

## 2. Ce qui est enregistré

Tout l'objet de paramètres de l'application :

| Famille | Contenu |
| --- | --- |
| Identité | nom commercial, logo, slogan, adresse, téléphone |
| Caisse | devise, TVA d'affichage, notifications locales, imprimante |
| Tournées | frais de ramassage et de livraison, vitesse moyenne, détour, fraîcheur GPS |
| Preuve de remise | photo / signature / code exigés |
| Rangement | assignation obligatoire, dépassement de capacité, suggestions, capacité par défaut |
| Blanchisserie | forfaits au nombre de vêtements, prix, composition |
| Pressing | prestations, prix par vêtement, type de service (normal / express ×2) |
| Catalogue | vêtements créés par le pressing, retouches et masquages des vêtements fournis |

En plus de l'instantané JSON, les colonnes historiques (`tagline`,
`pickup_fee_xof`, `delivery_fee_xof`, `enable_sms`, `storage_*`, …) restent
écrites : les RPC de commande continuent de les lire sans modification.

L'identité (nom, adresse, téléphone) est aussi reportée sur `public.shops`,
pour que les documents, l'espace client et le libellé de l'ERP restent
d'accord avec l'écran Paramètres.

## 3. Comment ça marche

```
ouverture de l'ERP (compte réel)
        │
        ├── lecture de public.shop_settings  ──► fusion avec les valeurs par défaut
        │                                        et la copie locale
        │                                        (une clé absente n'écrase rien)
        │
Enregistrer les réglages
        │
        ├── copie locale immédiate (l'écran reste utilisable hors ligne)
        └── envoi vers Supabase après 600 ms (les clics rapprochés sont groupés)
                 │
                 ├── succès  → « Réglages enregistrés dans la base · 28/10/2026 14:32 »
                 └── échec   → bandeau rouge explicite + bouton « Réessayer »
```

- **La base fait foi à l'ouverture** : un second appareil récupère la
  configuration enregistrée, pas celle du navigateur.
- **La copie locale est conservée** : un poste sans réseau garde ses réglages
  et peut continuer à travailler.
- **Aucune valeur inventée** : une ligne encore vide (compte créé avant cette
  évolution) reçoit la configuration courante au premier chargement ; une clé
  absente de la sauvegarde reprend la valeur par défaut, jamais zéro.
- **Le logo reste dans l'instantané** (data URL 256 px). C'est simple et
  suffisant pour une enseigne ; un stockage d'objets dédié serait préférable
  si les logos devenaient nombreux ou lourds.

## 4. Côté base

Migration `supabase/migrations/20261028180000_shop_settings_snapshot.sql` :

- `shop_settings.settings` (JSONB, défaut `{}`) : l'instantané complet ;
- `shop_settings.settings_updated_at` : horodatage **serveur** du dernier
  enregistrement, posé par un trigger (l'horloge du téléphone n'est pas crue) ;
- `grant update (settings, settings_updated_at)` : le droit est accordé colonne
  par colonne, comme le reste de la phase 0 ;
- policies inchangées : **lecture** par propriétaire, responsable, caisse et
  atelier ; **écriture** réservée au propriétaire et au responsable d'agence.

Un caissier qui tente d'enregistrer les paramètres n'obtient aucune ligne
modifiée : l'écran affiche « Votre rôle ne permet pas de modifier les
paramètres de cette agence. »

## 5. Ce qui se passe quand ça se passe mal

| Situation | Comportement |
| --- | --- |
| Hors ligne / serveur injoignable | bandeau « Serveur injoignable : les paramètres restent enregistrés sur cet appareil », bouton **Réessayer** |
| Rôle insuffisant | message explicite, aucune écriture, réglages locaux conservés |
| Aucune agence rattachée | mention « les réglages restent sur cet appareil » (rien n'est inventé) |
| Démonstration locale | aucun envoi : le bandeau dit que les réglages restent dans ce navigateur |
| Deux appareils modifient en même temps | **le dernier enregistrement gagne**, sans fusion ; recharger l'écran pour voir la version distante |
| Base pas encore migrée | repli automatique sur les colonnes historiques (slogan, tarifs, rangement) + avertissement invitant à appliquer la migration : aucun enregistrement perdu, aucun message technique |

## 6. Limites, dites franchement

- **Pas de temps réel** : un second appareil déjà ouvert ne voit pas les
  changements sans recharger la page. Le temps réel demande un abonnement
  Realtime et une gestion de conflits, hors de ce lot.
- **Les emplacements de rangement (casiers) ne sont pas encore synchronisés.**
  Ils vivent dans `pressingpro_storage_locations` et la table
  `public.storage_locations` existe, mais leur écriture n'est pas branchée :
  c'est la prochaine étape naturelle.
- **Les préférences d'interface restent par appareil** (thème, ordre de la
  barre latérale) : ce sont des goûts d'utilisateur, pas la configuration du
  pressing.
- **Le logo voyage en base64** dans le JSON : quelques dizaines de kilo-octets
  par enregistrement, acceptable à cette échelle.
- **Aucune migration n'a été appliquée au projet hébergé depuis cet
  environnement** : le SQL est vérifié en PGlite (voir § 8) mais reste à
  pousser vers `Pressing_Pro` avec `supabase db push` (ou l'éditeur SQL) avant
  que la production en profite. En attendant, le repli décrit au § 5 s'applique
  et l'écran affiche l'avertissement correspondant.

## 7. Sur un compte existant

La ligne `shop_settings` existe déjà (créée à l'onboarding). Elle n'a pas
d'instantané : au premier chargement, l'application lit les colonnes
historiques, les fusionne avec la configuration locale, puis **réenregistre**
l'instantané complet. Rien n'est perdu, rien n'est deviné.

## 8. Vérifications réellement effectuées

- `npx tsc --noEmit`, `npm run lint` : propres.
- **267 tests unitaires** (25 fichiers) : dont 7 nouveaux sur l'instantané
  (`buildShopSettingsRow` borne les montants négatifs, `readRemoteShopSettings`
  privilégie le JSON et retombe sur les colonnes, `mergeShopSettings` n'écrase
  rien avec une sauvegarde vide et nettoie les valeurs douteuses,
  `isMissingSettingsColumn` distingue une base non migrée d'un refus de rôle).
- **PGlite (58 vérifications)** : la migration s'applique, le propriétaire
  enregistre l'instantané, l'horodatage serveur est posé, un caissier ne
  modifie aucune ligne.
- **Rendu serveur** : l'écran Paramètres réaffiche la configuration sauvegardée
  (« Pressing Éclat », frais repris) et affiche le bandeau de démonstration au
  lieu d'un faux « enregistré dans la base ».
- `npm run build` : OK.

## 9. Fichiers

- `supabase/migrations/20261028180000_shop_settings_snapshot.sql` — colonne,
  trigger, droits.
- `src/lib/shopSettingsSync.ts` — lecture, écriture, messages d'erreur.
- `src/lib/shopSettings.ts` — `mergeShopSettings`, fusion défensive.
- `src/context/AppContext.tsx` — chargement au démarrage, envoi après
  enregistrement, état de synchronisation.
- `src/components/settings/SettingsSyncStatus.tsx` — bandeau d'état.
- `src/components/auth/StaffAccessGate.tsx`, `src/lib/workspaceScope.ts` —
  identifiant d'agence transmis à l'ERP.
- `src/lib/database.types.ts` — colonnes typées.
- `tests/unit/shopSettingsSync.test.ts`, `supabase/tests/phase0/` .
