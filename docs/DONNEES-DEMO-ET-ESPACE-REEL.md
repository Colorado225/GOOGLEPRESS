# Données de démonstration et espace réel

> Décision du 28 octobre 2026 : **un compte réel ne voit jamais les données de
> démonstration**. Un pressing qui vient d'être créé par l'onboarding démarre
> avec un tableau de bord vide.

## Le problème corrigé

L'ERP conserve encore ses données métier dans le navigateur pendant la
migration progressive vers Supabase. Jusqu'ici, l'état local était toujours
amorcé avec les jeux d'exemple (`INITIAL_ORDERS`, `INITIAL_CUSTOMERS`,
`INITIAL_EMPLOYEES`, …). Une organisation réellement créée héritait donc, dès
sa première ouverture, des clients fictifs, des commandes de démonstration, de
la caisse du jour pré-remplie et de l'enseigne « Pressing Cocody ».

## Le principe

Deux portées de données, décidées par la frontière d'accès :

| Portée | Déclencheur | Amorçage |
|---|---|---|
| `demo` | Démonstration locale explicite (`VITE_ALLOW_LOCAL_DEMO=true`, ou développement sans Supabase) | Jeux d'exemple complets, comme avant |
| `live` | Session Supabase **et** rattachement actif à une organisation | **Rien** : les écrans démarrent vides |

Le code correspondant :

- `src/lib/workspaceScope.ts` — portée, préfixe de persistance, libellé ;
- `src/context/WorkspaceScopeContext.tsx` — transmission de la portée ;
- `src/components/auth/StaffAccessGate.tsx` — résout l'organisation et
  l'agence réelles, puis fournit la portée `live` au shell ERP ;
- `src/context/AppContext.tsx` — choisit les valeurs initiales et préfixe
  chaque clé de `localStorage`.

Le shell ERP n'est monté qu'une fois la portée résolue : il ne peut pas
démarrer en `demo` par défaut avant de basculer.

## Ce qui démarre vide sur un compte réel

Commandes, clients, caisse du jour, tournées de ramassage/livraison, employés,
pointages, produits, mouvements de stock, dépenses, et le compteur de tickets
(qui repart à `#TK-1`).

## Ce qui est conservé, et pourquoi

Ce sont des **paramétrages**, pas des dossiers :

- catégories de dépenses (nomenclature éditable dans Paramètres) ;
- plan de rangement (`INITIAL_STORAGE_LOCATIONS` : portants et capacités,
  ajustables pour correspondre au local réel) ;
- réglages de boutique (`DEFAULT_SHOP_SETTINGS`) ;
- catalogue de prestations du POS — la grille tarifaire de référence, que
  l'onboarding amorce aussi côté serveur (`p_seed_catalog`).

Aucun de ces éléments ne contient de nom de client, de commande ou de montant.

## Compteurs et identités de la barre latérale

Trois éléments de l'interface annonçaient des chiffres ou des personnes qui
n'existaient pas :

| Élément | Avant | Après |
|---|---|---|
| Badge « Réception (POS) » | `receivedCount \|\| 12` : **12** affiché dès qu'aucune commande n'était reçue | Compteur réel uniquement ; le badge disparaît à zéro |
| Encart « Objectif du mois » | 3 850 000 FCFA, 72 %, 2 772 000 FCFA codés en dur | Valeurs de `cashRegister` ; encart masqué tant que l'objectif n'est pas renseigné |
| Équipe atelier / opératrice | « Lavage : Moussa + Yann… », « Opératrice : Awa Koné » | Employés non désactivés regroupés par poste ; libellé neutre s'il n'y en a aucun |
| Carte « Formule Pro — Abonnement actif » | Fausse licence sur tous les comptes | Réservée à la démonstration, et renommée « Mode démonstration » |
| Profil (barre latérale et en-tête) | « Awa Koné — Gérante • Poste 01 » | Nom réel du compte connecté (profil, sinon métadonnées Auth, sinon partie locale de l'e-mail) et rôle réel du rattachement (« Propriétaire », « Responsable d'agence »…), repli neutre sinon |

Le badge bleu de la barre latérale signalait donc un **nombre de démonstration**
et non une notification : c'était un `12` littéral utilisé comme valeur de
repli (`|| 12`).

## Isolation de la persistance

En espace réel, les clés locales sont préfixées par l'organisation :

```
pressingpro_workspace_<organization_id>__pressingpro_orders
```

Conséquences :

- deux comptes réels ouverts dans le même navigateur ne partagent rien ;
- une donnée de démonstration déjà présente sur le poste ne peut pas
  « remonter » dans un espace réel ;
- la démonstration conserve ses clés historiques (`pressingpro_orders`, …),
  donc les données d'un poste de démonstration ne sont pas perdues.

Si l'organisation n'est pas connue, aucun préfixe n'est inventé : la portée
retombe sur les clés historiques plutôt que de créer un espace commun
ambigu.

## Interface

- Le tableau de bord affiche un encart « Votre espace démarre vide » et des
  indicateurs à zéro, sans ticket ni montant fictif.
- L'en-tête et le pied du POS affichent le nom **réel** de l'organisation et
  de l'agence ; à défaut, un libellé neutre (« Espace professionnel »), jamais
  une enseigne d'exemple.
- Le POS ne pré-sélectionne plus de client fictif : sans dossier client, la
  fiche active est vide et l'enregistrement d'une commande est refusé avec un
  message explicite.

## Vérifications effectuées

- `npx tsc --noEmit` : OK ;
- `npm run test:unit` : 95 tests réussis, dont 8 nouveaux sur
  `workspaceScope` (préfixes, isolation entre organisations, libellés) ;
- `npm run build` : OK, entrée 316,96 kB (94,72 kB gzip) ;
- rendu serveur comparé des deux portées : en `live`, le tableau de bord
  contient « Votre espace démarre vide », aucun nom de client fictif, aucun
  ticket et un seul montant rendu — `0 FCFA` ; en `demo`, les exemples
  historiques sont toujours présents. Les écrans Réception, Clients,
  Commandes et Atelier ont aussi été rendus en portée `live` sans erreur ni
  fuite de données d'exemple.

**Non vérifié ici** : la recette navigateur complète (aucun navigateur
disponible dans cet environnement) et le parcours réel inscription →
onboarding → tableau de bord vide sur le projet Supabase, à confirmer depuis
l'aperçu.
