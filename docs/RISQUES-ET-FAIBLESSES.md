# Risques et faiblesses — registre vivant

Revue du 28 octobre 2026, complétée pendant l’audit de sécurisation sur la
branche `arena/ac6f461c-googlepress` (base `8d77b75`, PR #4 incluse). Les
mesures locales décrites ci-dessous ne doivent pas être confondues avec une
application hébergée ou une recette de boutique.

Ce registre corrige les constats devenus partiellement obsolètes, sans
minimiser les risques restants. Une mitigation n’est considérée comme une
clôture que lorsque son critère d’acceptation est démontré.

| ID | Risque | Gravité résiduelle | État |
|---|---|---:|---|
| R1 | Données uniquement locales | Élevée | Ouvert ; création/paiements serveur implémentés et testés localement, mais migration non appliquée et POS non branché |
| R2 | Authentification et rôles applicatifs incomplets | Élevée | Ouvert ; garde production session+membership livrée, aucun tenant réel et restrictions d’écran par rôle encore incomplètes |
| R3 | Aucun SMS/WhatsApp réellement envoyé | Moyenne | Ouvert, libellés rendus honnêtes |
| R4 | Pas de pilote direct d’imprimante thermique | Moyenne | Ouvert, impression navigateur réelle mais limitée |
| R5 | Pas de GPS ni d’optimisation géographique | Moyenne | Ouvert |
| R6 | `AppContext` centralisé | Moyenne | Ouvert, première extraction réalisée |
| R7 | Tests métier encore incomplets | Faible à moyenne | Partiellement traité et mesuré |
| R8 | CI récente, protection de branche non démontrée | Faible | Partiellement traité |

## R1 — Données uniquement locales

**Constat.** Les écrans métier historiques lisent et écrivent encore dans le
`localStorage` du poste courant. Il n’y a donc toujours ni synchronisation
exploitable comptoir/atelier, ni sauvegarde serveur des données créées au POS.
Le premier lot distant est installé : RPC atomique de transition,
historique `order_events`, publication Realtime et onglet Atelier → Suivi
distant. Un second lot local ajoute `create_order`, le journal `payments`,
les remboursements par contre-écriture et les wrappers TypeScript, avec
50 vérifications PGlite. Pressing_Pro reste néanmoins vide, cette migration
n’y est pas appliquée et le POS ne l’appelle pas ; ce socle ne ferme donc pas
encore le risque.

**Atténuation actuelle.** Paramètres → Sauvegarde exporte un JSON chiffré
AES-GCM des clés locales et permet une restauration contrôlée. Cela protège
contre certains effacements si l’utilisateur exporte réellement le fichier et
conserve sa phrase secrète ; cela ne crée ni copie automatique ni partage. La
RPC distante protège en outre ses futures transitions par verrouillage de
ligne et statut attendu, mais uniquement pour des commandes déjà présentes
dans Supabase.

**Clôture attendue.** Sauvegarde puis application contrôlée de la migration
commandes/paiements, premier tenant réel, création distante des clientes et
commandes, bascule des écrans domaine par domaine, tests HTTP avec jetons
Auth, recette Realtime sur deux appareils, RLS vérifiée entre tenants,
procédure de retour arrière et restauration serveur testée.

## R2 — Authentification applicative incomplète

**Constat corrigé, non clos.** Un build de production avec Supabase configuré
ouvre maintenant l’ERP uniquement avec une session et un membership actif ;
un build de production non configuré affiche une erreur au lieu d’ouvrir la
démonstration. La démonstration reste explicitement possible en
développement ou avec `VITE_ALLOW_LOCAL_DEMO=true`, sans protection des
données locales. Aucun tenant ou compte réel ne permet encore la recette des
rôles, et la garde ne restreint pas encore chaque écran historique selon le
rôle du membership.

**Atténuation client livrée.** Les pages `/client/connexion`,
`/client/inscription`, `/client/nouveau-mot-de-passe` et `/client` sont
reliées à Supabase Auth, hors du shell ERP. Un compte client ne donne aucun
droit métier tant qu’une liaison téléphonique vérifiée n’a pas été créée par
le pressing. L’inscription publique reste néanmoins désactivée sur
Pressing_Pro et aucun SMTP de production n’est configuré ; la recette Auth
réelle reste donc à faire.

**Clôture attendue.** Comptes Supabase Auth reliés à des profils d’agence :
propriétaire, responsable, caisse/réception, atelier et coursier ; recette
avec vrais jetons des accès autorisés/refusés ; écrans et actions reflétant
ces rôles sans remplacer la RLS/RPC serveur ; audit des actions sensibles.
Un PIN local ne doit pas être présenté comme une frontière de sécurité.

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
moment de la revue, le fichier fait 2 261 lignes. Le risque principal
n’est pas seulement sa taille : ce sont les couplages implicites entre états,
effets de persistance et transitions métier lors de la migration Supabase.

**Extractions réalisées.** `src/lib/localPersistence.ts` isole
lecture/écriture JSON/texte locale, compteur de tickets et génération d’IDs
locaux. Les accès commandes/clients/caisse/tournées restants dans ce lot y
ont été regroupés ; `staffAccess.ts`, `supabasePayments.ts` et les wrappers
de `supabaseOrders.ts` fournissent des frontières typées pour la suite. Les
dix écrans ERP sont aussi chargés en chunks séparés. Ces extractions ne
clôturent pas le risque tant qu’`AppContext` orchestre les mutations locales.

**Trajectoire sans big-bang.** À chaque migration de domaine, extraire son
repository et ses actions derrière une API typée : session/agence, paramètres,
clients, panier/commandes, rangement, tournées, personnel, stocks et dépenses.
`AppContext` doit finir en composition de providers/hooks, avec les règles
pures dans `src/lib` et des tests de transition avant déplacement.

## R7 — Tests métier : socle présent, couverture à élargir

**Constat corrigé.** Les tests ne ciblent plus seulement Supabase :

- 57 tests unitaires Vitest sur `pricing`, `dates`, `logistics`, `storage`,
  `backup`, `localPersistence`, `orderTracking`, `customerAuth` et
  `staffAccess` ;
- couverture V8 mesurée sur ces cœurs : 77,62 % des instructions, 68,96 %
  des branches, 80,72 % des fonctions et 80,50 % des lignes au 28/10/2026 ;
  `pricing.ts` est à 100 % sur ces indicateurs ;
- seuils anti-régression configurés à 70/60/70/72 % ;
- 50 vérifications Supabase sous PGlite, dont isolation, RLS, transitions,
  création de commande tarifée côté serveur, paiements, remboursements et
  profil créé à l’inscription ;
- 7 smoke tests navigateur Playwright ; leur exécution locale de cette
  branche reste bloquée par l’absence de Chromium dans le bac à sable, mais
  le run CI `40702372372` de la PR #5 les a exécutés avec succès au commit
  `3effa2a`.

**Angles encore faibles.** Transitions complètes d’`AppContext`, rapports,
clôture de caisse, périodes, inventaire et parcours longs POS/atelier restent
peu couverts. Les seuils doivent monter progressivement au fil des extractions,
sans chercher un pourcentage décoratif.

## R8 — CI/CD

**Constat corrigé.** `.github/workflows/ci.yml` exécute installation, typage,
tests unitaires avec couverture des cœurs, tests Supabase Phase 0, build et
smoke tests navigateur. Les PR #3 et #5 ont démontré des runs complets verts ;
pour la PR #5, le run `40702372372` couvre le commit `3effa2a`.

**Reste à prouver.** La protection de `main` imposant ces checks avant merge
est un réglage d’administration GitHub non démontré dans le code. Le
déploiement Vercel et sa politique de promotion/rollback restent séparés de ce
workflow.

## Ordre de traitement recommandé

1. Sauvegarder, appliquer le Lot 2 à Pressing_Pro, créer le premier tenant et
   brancher un POS pilote (R1, R2, R6).
2. Recetter chaque rôle avec jetons réels, restreindre les écrans sensibles
   et auditer les actions correspondantes (R2).
3. Ajouter notifications transactionnelles et confirmation/rapprochement des
   paiements fournisseurs par webhooks signés (R3).
4. Choisir et tester la voie d’impression du poste réel (R4).
5. Ajouter coordonnées/itinéraires de tournée avant tout suivi GPS continu (R5).
6. Étendre tests et seuils à chaque extraction de domaine (R6, R7).
7. Rendre les checks CI obligatoires sur `main` (R8).
