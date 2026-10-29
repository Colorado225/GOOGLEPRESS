# Les casiers enregistrés dans la base

> État : livré le 29 octobre 2026 — branche `arena/7aed267c-googlepress`.
> Table concernée : `public.storage_locations` (projet `Pressing_Pro`).

## 1. Le problème

Le plan de rangement (portants, bacs, casiers) était une configuration
**locale** : il vivait dans `pressingpro_storage_locations`, donc sur un seul
navigateur. Un pressing qui change de téléphone, ajoute un poste au comptoir ou
ouvre un second point de vente repartait d'un plan vide ou perdait le sien.
Les commandes rangées continuaient pourtant de pointer vers ces casiers.

Depuis ce lot, sur un **compte réel**, le plan de l'agence est lu et écrit dans
`public.storage_locations` : il est identique sur tous les appareils du
pressing, sans toucher aux commandes déjà rangées.

## 2. Ce qui est enregistré

| Champ de l'écran | Colonne | Règle |
| --- | --- | --- |
| `id` local | `legacy_id` | conservé tel quel : les commandes rangées gardent leur repère |
| `code` | `code` | normalisé en majuscules (contrainte de la table) |
| `label` | `label` | libellé affiché ; à défaut, le code |
| `zone` | `zone` | `hanging`, `folded`, `delivery`, `bulky`, `hold`, `other` |
| `capacityPackages` | `capacity_packages` | 1 à 999 |
| `description` | `description` | facultatif |
| `isActive` | `is_active` | un casier retiré est **désactivé**, jamais supprimé |

`organization_id` et `shop_id` viennent de l'espace de travail courant ; aucune
valeur n'est inventée côté client.

## 3. Le flux

1. **À la connexion** (compte réel avec agence), l'application lit
   `storage_locations` pour l'agence. Si la base est encore vide, le plan local
   affiché devient le plan de l'agence : une seule écriture, pas de perte.
2. **À chaque modification** (création, édition, série, activation), un envoi
   part après **800 ms** : l'application relit l'état serveur, calcule les
   écarts, puis crée / modifie / désactive ce qui doit l'être.
3. **L'appariement** se fait par `legacy_id`, puis par code à défaut : une ligne
   ajoutée à la main dans l'éditeur SQL n'est pas dupliquée.
4. **En cas d'échec**, le plan reste en mémoire et sur l'appareil, un bandeau
   rouge l'annonce et propose **Réessayer**. Rien n'est présenté comme
   enregistré tant que la base n'a pas répondu.

## 4. Côté base

- **RLS** : lecture pour tout membre actif de l'agence (`has_shop_access`) ;
  création et modification réservées au propriétaire et au responsable.
- **Pas de politique de suppression** et pas de `grant delete` : retirer un
  casier passe par `is_active = false`, ce qui préserve l'historique des
  commandes passées par ce casier.
- **Droits par colonne** : seul le sous-ensemble `code, label, zone,
  capacity_packages, description, is_active` est modifiable par
  `authenticated`.
- **Contraintes** : code en majuscules (`^[A-Z0-9]+(?:-[A-Z0-9]+)*$`,
  16 caractères), libellé de 1 à 160 caractères, capacité entre 1 et 999,
  unicité `(shop_id, code)`.

## 5. Pannes et cas limites

| Situation | Comportement |
| --- | --- |
| Base injoignable pendant l'envoi | bandeau rouge, plan conservé localement, bouton **Réessayer** |
| Rôle insuffisant (caissier) | la base refuse : message explicite, rien n'est présenté comme enregistré |
| Un casier est retiré du plan | ligne serveur **désactivée**, pas effacée |
| Base encore vide | le plan affiché est envoyé une fois, puis relu comme celui de l'agence |
| Démonstration locale | aucun envoi : le bandeau dit que le plan reste dans le navigateur |
| Deux appareils modifient en même temps | le dernier envoi gagne ; recharger pour voir la version distante |
| Ligne sans code valide | ignorée à la lecture : aucun casier fantôme dans l'écran |

## 6. Limites, dites franchement

- **Pas de temps réel** : un second appareil déjà ouvert doit recharger la page
  pour voir le nouveau plan. Aucun abonnement Realtime n'est posé.
- **Pas de fusion fine** : deux postes qui renomment le même casier au même
  moment ne fusionnent pas, le dernier enregistrement l'emporte.
- **Le plan proposé A–E part en base à la première connexion** si aucun plan
  n'existe encore, y compris sur un compte neuf. C'est le comportement
  historique (ce plan sert de proposition de démarrage, entièrement éditable) ;
  il est visible tel quel dans l'écran et peut être vidé en désactivant les
  casiers.
- **Les préférences d'affichage** du rangement (filtres, vue, recherche)
  restent propres à l'appareil : ce sont des goûts d'utilisateur.

## 7. Vérifications

- **7 tests unitaires** (`tests/unit/storageLocationsSync.test.ts`) : lecture
  d'une ligne, lignes invalides, identifiant local réutilisé, plan sans écart,
  créations et modifications, désactivation des casiers retirés, appariement
  par code.
- **PGlite — 64 vérifications** (`supabase/tests/phase0/run-isolation-pglite.mjs`)
  dont : le propriétaire crée un casier et toute l'agence le lit ; un caissier
  ne peut ni créer ni modifier un casier ; les casiers d'une autre agence
  restent invisibles ; un casier ne peut pas être supprimé, seulement
  désactivé.
- `npx tsc --noEmit`, `npm run build` : OK.

## 8. Fichiers

- `src/lib/storageLocationsSync.ts` — lecture, appariement, écriture des écarts,
  messages d'erreur.
- `src/context/AppContext.tsx` — hydratation à la connexion, envoi différé
  (800 ms), état `storageSync`, `retryStorageSync`.
- `src/components/workshop/StorageSyncBanner.tsx` — bandeau « où vit le plan ».
- `src/components/workshop/StoragePanel.tsx` — bandeau ajouté à l'écran réel.
- `tests/unit/storageLocationsSync.test.ts`, `vitest.config.ts` (couverture).
- `supabase/tests/phase0/run-isolation-pglite.mjs` — contrôles RLS.
