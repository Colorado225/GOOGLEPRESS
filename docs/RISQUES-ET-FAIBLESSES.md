# Risques et faiblesses — registre vivant

Revue du 28 octobre 2026, après fusion de la PR #3 dans `main`
(commit `fbcdfbd`) et ajout de la couverture mesurée sur la branche de travail.

Ce registre corrige les constats devenus partiellement obsolètes, sans
minimiser les risques restants. Une mitigation n’est considérée comme une
clôture que lorsque son critère d’acceptation est démontré.

| ID | Risque | Gravité résiduelle | État |
|---|---|---:|---|
| R1 | Données uniquement locales | Élevée | Ouvert, atténué par sauvegarde manuelle |
| R2 | Absence d’authentification et de rôles applicatifs | Élevée | Ouvert |
| R3 | Aucun SMS/WhatsApp réellement envoyé | Moyenne | Ouvert, libellés rendus honnêtes |
| R4 | Pas de pilote direct d’imprimante thermique | Moyenne | Ouvert, impression navigateur réelle mais limitée |
| R5 | Pas de GPS ni d’optimisation géographique | Moyenne | Ouvert |
| R6 | `AppContext` centralisé | Moyenne | Ouvert, première extraction réalisée |
| R7 | Tests métier encore incomplets | Faible à moyenne | Partiellement traité et mesuré |
| R8 | CI récente, protection de branche non démontrée | Faible | Partiellement traité |

## R1 — Données uniquement locales

**Constat.** Les écrans métier lisent et écrivent encore dans le
`localStorage` du poste courant. Il n’y a ni synchronisation comptoir/atelier,
ni sauvegarde serveur, ni résolution de conflits. La fondation Supabase et la
sonde Auth/PostgREST existent, mais elles ne portent pas encore les données
métier.

**Atténuation actuelle.** Paramètres → Sauvegarde exporte un JSON chiffré
AES-GCM des clés locales et permet une restauration contrôlée. Cela protège
contre certains effacements si l’utilisateur exporte réellement le fichier et
conserve sa phrase secrète ; cela ne crée ni copie automatique ni partage.

**Clôture attendue.** Premier tenant réel, migration domaine par domaine,
tests HTTP avec jetons Auth, RLS vérifiée entre tenants, procédure de retour
arrière et restauration serveur testée.

## R2 — Absence d’authentification applicative

**Constat.** Aucun compte n’est requis pour ouvrir les écrans ou modifier les
données. L’onglet Backend peut établir une session Supabase de test, mais cette
session ne protège ni les Paramètres ni les données locales et aucun tenant ou
profil de rôle n’est encore créé.

**Clôture attendue.** Comptes Supabase Auth reliés à des profils d’agence :
propriétaire, caissier/responsable, atelier et coursier. Les autorisations
doivent être imposées par RLS/RPC côté serveur, puis reflétées dans
l’interface, avec audit des actions sensibles. Un PIN local ne doit pas être
présenté comme une frontière de sécurité.

## R3 — Notifications externes absentes

**Constat corrigé.** L’interface ne simule plus un envoi : elle parle de
notification marquée localement et peut copier un message à envoyer
manuellement. Aucun fournisseur SMS/WhatsApp, aucun worker d’outbox et aucun
accusé de livraison ne sont branchés. Le risque opérationnel demeure donc :
le client n’est informé que si l’opérateur envoie réellement le message par un
autre canal.

**Clôture attendue.** Fournisseur choisi, secrets côté serveur, outbox traitée
par worker, idempotence, statuts d’envoi/livraison/échec, consentements et
repli manuel visible.

## R4 — Impression thermique non pilotée directement

**Constat nuancé.** Le ticket n’est pas qu’une simulation : `window.print()`
peut imprimer sur une imprimante réellement installée dans le système et
sélectionnée dans la boîte de dialogue du navigateur. En revanche,
l’application ne parle pas directement ESC/POS ou équivalent, ne déclenche pas
d’impression silencieuse, ne pilote pas le tiroir-caisse et ne reçoit ni état
papier ni confirmation matérielle. Le réglage « imprimante thermique » est une
préférence locale, pas une intégration pilote.

**Clôture attendue.** Choix d’une voie supportée — service local d’impression,
WebUSB/WebSerial lorsque c’est pertinent, ou passerelle réseau — avec file,
réessais, état du périphérique et test sur le modèle réellement déployé.

## R5 — Pas de GPS

**Constat.** Les tournées utilisent adresse saisie, repère libre, téléphone,
date/créneau, coursier affecté et statuts manuels. Il n’y a ni coordonnées,
ni géocodage, ni optimisation d’itinéraire, ni position du coursier.

**Clôture attendue.** Après le backend multi-poste : coordonnées optionnelles
des adresses, lien d’itinéraire, ordre de tournée explicable et, seulement si
le besoin est confirmé, localisation du coursier avec consentement, finalité,
durée de conservation et accès limité. Le GPS ne doit pas être ajouté comme
surveillance permanente par défaut.

## R6 — État global centralisé dans `AppContext`

**Constat.** `src/context/AppContext.tsx` reste le point de composition de la
navigation, du POS, des commandes, du rangement, des tournées, du personnel,
des stocks, des dépenses, des paramètres et de plusieurs états d’interface. Au
moment de la revue, le fichier fait environ 2 300 lignes. Le risque principal
n’est pas seulement sa taille : ce sont les couplages implicites entre états,
effets de persistance et transitions métier lors de la migration Supabase.

**Première extraction réalisée.** `src/lib/localPersistence.ts` isole
lecture/écriture JSON locale, compteur de tickets et génération d’IDs locaux,
avec tests dédiés. Cette extraction ne clôt pas le risque.

**Trajectoire sans big-bang.** À chaque migration de domaine, extraire son
repository et ses actions derrière une API typée : session/agence, paramètres,
clients, panier/commandes, rangement, tournées, personnel, stocks et dépenses.
`AppContext` doit finir en composition de providers/hooks, avec les règles
pures dans `src/lib` et des tests de transition avant déplacement.

## R7 — Tests métier : socle présent, couverture à élargir

**Constat corrigé.** Les tests ne ciblent plus seulement Supabase :

- 32 tests unitaires Vitest sur `pricing`, `dates`, `logistics`, `storage`,
  `backup` et `localPersistence` ;
- couverture V8 mesurée sur ces cœurs : 75,5 % des instructions, 65,4 % des
  branches, 76,6 % des fonctions et 78,4 % des lignes au 28/10/2026 ;
- seuils anti-régression configurés à 70/60/70/72 % ;
- 19 vérifications d’isolation Supabase Phase 0 sous PGlite ;
- 5 smoke tests navigateur Playwright.

**Angles encore faibles.** Transitions complètes d’`AppContext`, rapports,
clôture de caisse, périodes, inventaire et parcours longs POS/atelier restent
peu couverts. Les seuils doivent monter progressivement au fil des extractions,
sans chercher un pourcentage décoratif.

## R8 — CI/CD

**Constat corrigé.** `.github/workflows/ci.yml` exécute installation, typage,
tests unitaires avec couverture des cœurs, tests Supabase Phase 0, build et
smoke tests navigateur. La PR #3 a démontré un run complet vert.

**Reste à prouver.** La protection de `main` imposant ces checks avant merge
est un réglage d’administration GitHub non démontré dans le code. Le
déploiement Vercel et sa politique de promotion/rollback restent séparés de ce
workflow.

## Ordre de traitement recommandé

1. Créer le premier tenant et migrer un premier domaine Supabase (R1, R2, R6).
2. Verrouiller les Paramètres par rôle serveur et auditer les actions sensibles (R2).
3. Ajouter notifications transactionnelles et journal de paiements rapprochable (R3).
4. Choisir et tester la voie d’impression du poste réel (R4).
5. Ajouter coordonnées/itinéraires de tournée avant tout suivi GPS continu (R5).
6. Étendre tests et seuils à chaque extraction de domaine (R6, R7).
7. Rendre les checks CI obligatoires sur `main` (R8).
