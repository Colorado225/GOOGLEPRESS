# Recommandations prioritaires — état et séquencement

Date de revue : 28 octobre 2026.

Ce document transforme les six recommandations de revue en chantiers
vérifiables. Il distingue ce qui est livré, ce qui est seulement préparé et ce
qui dépend d’une donnée ou d’un compte externe réel.

## Séquence retenue

La sauvegarde locale, les tests unitaires et la CI passent en premier dans
l’exécution : ils ne dépendent d’aucun fournisseur et réduisent le risque de la
migration Supabase. La bascule des écrans métier reste la priorité produit,
mais elle exige le premier tenant réel. Le verrouillage des paramètres doit
venir avec les rôles serveur ; un simple masquage d’écran ne serait pas une
sécurité. Pour les paiements, le rapprochement manuel fiable précède toute API
Wave/MTN/Orange.

| # | Chantier | État au 28/10/2026 | Prochain livrable vérifiable |
|---|---|---|---|
| 1 | Finaliser Supabase | Préparé, non basculé | Premier tenant + premier domaine lu/écrit à distance |
| 2 | Sauvegarde/export | Livré en local chiffré | Restauration testée sur un second navigateur/appareil |
| 3 | Sécuriser les paramètres | Non livré | Rôle propriétaire imposé côté serveur et interface |
| 4 | Paiements mobiles | Saisie manuelle seulement | Journal de paiements rapprochable avec références |
| 5 | Tests unitaires | Socle livré | Étendre aux rapports et à la caisse |
| 6 | CI/CD | CI livrée, protection GitHub à activer | Checks obligatoires avant merge |

## 1. Finaliser Supabase

### Déjà en place

- Schéma multi-tenant Pressing_Pro installé : organisations, agences, profils,
  clients, commandes, tournées, stock, dépenses, messagerie et outbox.
- RLS activée et forcée sur les 37 tables publiques, politiques d’isolation et
  suite PGlite Phase 0.
- Domaine de production Supabase Auth configuré.
- Client front progressif et onglet Paramètres → Backend Supabase pour session
  Auth et sonde PostgREST.

### Ce qui bloque la bascule métier

Aucun tenant ni utilisateur réel n’existe encore. Il faut fournir, sans mot de
passe dans le dépôt ou dans le chat :

- nom de l’organisation pilote et slug souhaité ;
- première agence : nom, adresse, téléphone, fuseau horaire ;
- propriétaire : nom complet, e-mail et téléphone ;
- canal d’invitation du propriétaire ;
- rôle Pressing_Pro chargé de l’amorçage du tenant ;
- liste initiale des employés à inviter et rôle de chacun : propriétaire,
  responsable/caissier, atelier, coursier.

### Ordre de migration recommandé

1. Amorcer le tenant et tester Auth/PostgREST avec de vrais jetons sur des
   comptes de validation distincts.
2. Introduire une couche d’accès par domaine, sans réécrire les écrans.
3. Migrer d’abord paramètres agence + emplacements + catalogue/stock, puis
   clients, puis commandes/tournées/caisse.
4. Vérifier à chaque domaine : RLS, erreurs réseau visibles, retour arrière,
   totaux avant/après et absence de double écriture.
5. Ajouter Realtime seulement après stabilisation des écritures.
6. Traiter séparément la file hors ligne du comptoir.

Critère d’acceptation : un domaine n’est dit « Supabase » que si ses lectures
et écritures métier passent par Supabase, si un utilisateur d’un autre tenant
ne peut ni lire ni modifier ses lignes, et si l’échec réseau ne simule pas un
succès.

## 2. Sauvegarde/export avant backend

Livré dans Paramètres → Sauvegarde :

- export JSON chiffré AES-GCM, clé dérivée par PBKDF2-SHA-256 ;
- clés locales allowlistées : commandes, clients, caisse, compteur de tickets,
  personnel, présences, stock, dépenses, tournées, emplacements, paramètres,
  couleurs personnalisées et thème ;
- analyse d’un fichier sans modification, résumé du contenu, confirmation
  explicite avant remplacement ;
- restauration avec tentative de retour arrière si une écriture échoue ;
- date de dernière exportation lancée sur l’appareil et alerte après 7 jours.

Limites : export manuel choisi par l’utilisateur, aucune copie cloud
automatique, phrase secrète irrécupérable si elle est perdue. Le navigateur ne
peut pas garantir qu’un téléchargement lancé a bien été conservé par
l’utilisateur.

Critère d’acceptation restant : tester un aller-retour complet sur un second
navigateur ou appareil avec des données de démonstration, puis documenter la
procédure d’exploitation.

## 3. Sécuriser les paramètres

Non livré. Aujourd’hui, toute personne ayant accès au navigateur peut modifier
les règles dites « du propriétaire », et l’interface le signale déjà.

Le verrouillage correct exige :

- un compte Supabase Auth ;
- un profil relié à l’organisation/agence avec rôle propriétaire ou
  administrateur ;
- une vérification d’autorisation côté RLS/RPC, pas seulement dans React ;
- des écrans en lecture seule ou masqués pour caissier, atelier et coursier ;
- un journal d’audit des changements sensibles (tarifs logistiques, règles de
  rangement, identité de l’agence, paramètres d’intégration).

Un PIN local pourrait réduire les erreurs sur un poste partagé, mais il ne
doit pas être présenté comme un compte administrateur ni comme une frontière
de sécurité : les données resteront accessibles à quiconque contrôle le
navigateur tant que le backend n’est pas l’autorité.

## 4. Paiements mobiles réels et rapprochement

État actuel : Wave, MTN MoMo et Orange Money sont des moyens d’encaissement
déclarés manuellement. Aucune demande de paiement, aucun webhook et aucune
vérification fournisseur ne sont branchés. Le registre de caisse regroupe encore
MTN/Orange dans un même montant dans plusieurs vues.

### Étape A — rapprochement manuel fiable

Créer un journal de paiements local puis distant, une ligne par encaissement :

- commande et ticket ;
- acompte ou solde ;
- montant, moyen et fournisseur séparés (Wave, MTN MoMo, Orange Money) ;
- référence de transaction saisie/contrôlée, téléphone payeur si pertinent ;
- date/heure, employé ou coursier, agence ;
- statut : déclaré, vérifié, écarts à traiter, annulé/remboursé ;
- contrôle d’unicité d’une référence par fournisseur ;
- totaux de clôture par fournisseur et export CSV de rapprochement.

### Étape B — API fournisseur

Elle demande un choix commercial et des comptes marchands/KYC, des secrets
conservés uniquement côté serveur, des webhooks signés et idempotents, la
gestion des frais, délais, remboursements et litiges. Aucune clé fournisseur ne
doit être exposée dans une variable `VITE_*`.

Critère d’acceptation de l’étape A : chaque franc mobile money de la clôture
peut être relié à une commande et à une référence unique, et tout écart reste
visible jusqu’à traitement.

## 5. Industrialiser les tests

Socle livré avec Vitest (`npm run test:unit`) :

- `pricing.ts` : arrondis, express, remise hors transport, frais et acompte ;
- `dates.ts` : format historique, délais promis, ISO et libellés relatifs ;
- `logistics.ts` : valeurs par défaut, frais, actionnabilité, tri et coursiers ;
- `storage.ts` : codes, séries tout-ou-rien, occupation et suggestions ;
- `backup.ts` : allowlist, chiffrement/déchiffrement, restauration et rollback.

À étendre ensuite : rapports financiers, clôture de caisse, périodes,
inventaire, transitions d’état des commandes et règles de capacité strictes.
Les smoke tests Playwright existent ; leur exécution est déléguée à la CI où
Chromium peut être téléchargé.

## 6. CI/CD

Workflow GitHub Actions livré : installation `npm ci`, `npm run lint`,
`npm run test:unit`, `npm run test:phase0`, `npm run build`, puis job navigateur
Playwright séparé avec publication des traces en cas d’échec.

Reste une action d’administration GitHub : protéger `main` pour exiger les
checks « Lint, tests et build » et « Smoke tests navigateur » avant merge. Le
déploiement Vercel existant n’est pas modifié par ce chantier.

## Décision suivante recommandée

Fournir les données réelles du premier tenant, puis exécuter dans l’ordre :

1. amorçage tenant + comptes de validation + test HTTP Auth/PostgREST ;
2. couche d’accès et migration d’un premier domaine ;
3. rôles et verrouillage serveur des Paramètres ;
4. journal de paiements et rapprochement manuel ;
5. migration des domaines restants, Realtime et durcissement.
