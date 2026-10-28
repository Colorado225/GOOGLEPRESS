# Plan backend multi-tenant, espace client et messagerie — PressingPro CI

> **Statut : document de cadrage mis à jour le 28 octobre 2026.
> Aucun code backend n’a été écrit, aucune table n’a été créée et aucun
> paramètre Supabase n’a été modifié.**
>
> **Cible retenue : projet Supabase `Pressing_Pro`, Project ID
> `phjstsydxvggtduohfrl`, région `eu-west-1` (Irlande).**
> L’ancien projet envisagé (`waalxvtncxcpbyozhhhp`, `us-east-1`) est abandonné
> comme cible de ce plan ; aucune opération n’y a été effectuée.
>
> **Trajectoire recommandée : construire le socle en multi-tenant dès la
> phase 0, lancer d’abord le pressing pilote et l’espace client, puis ouvrir
> progressivement la commercialisation à d’autres pressings.**

---

## Réponse courte sur la messagerie intégrée

**Oui, les messages peuvent être envoyés directement dans l’application,
sous forme de conversation de type chat entre le client et son pressing.**

Le client pourra, dans son espace :

- recevoir un message automatique lorsqu’une commande est prête, qu’un
  enlèvement est confirmé, qu’un coursier part ou qu’une livraison est
  terminée ;
- répondre au pressing dans la même conversation ;
- communiquer une remarque ou une information : « sonnez à la grille »,
  « tache sur le col », « je préfère une livraison demain », « le gardien a le
  sac », etc. ;
- consulter l’historique des échanges et des statuts de ses commandes ;
- être alerté par une notification de l’application si elle est installée et
  si les notifications sont autorisées.

L’équipe du pressing disposera d’une **boîte de réception Messagerie** dans
l’application métier : conversations par client, contexte commande/enlèvement,
messages non lus, réponses rapides et modèles professionnels.

La messagerie intégrée devient le **centre de conversation**, mais elle ne
doit pas être le seul canal au lancement : si le client n’a pas installé
l’application ou refuse les notifications, il risque de ne pas voir l’alerte.
La stratégie recommandée est donc multicanale :

1. message toujours enregistré dans la conversation intégrée ;
2. notification push si un appareil du client est abonné ;
3. WhatsApp et/ou SMS pour les événements importants, l’invitation à ouvrir
   l’espace client et les clients non joignables par push ;
4. e-mail en canal secondaire si l’adresse est connue.

---

## 1. Objectifs et périmètre

### 1.1 Objectifs

Le backend doit permettre de passer de l’application actuelle,
mono-navigateur et sans compte, à une plateforme unique hébergée pouvant
accueillir plusieurs pressings indépendants.

La plateforme doit fournir :

- les postes comptoir, atelier, livraison et gérance synchronisés en temps
  réel ;
- des comptes et rôles pour le propriétaire et les employés ;
- un tenant isolé pour chaque entreprise de pressing cliente de la
  plateforme ;
- une ou plusieurs agences physiques par entreprise ;
- un espace client pour le suivi, les enlèvements et les échanges ;
- une messagerie intégrée client ↔ pressing ;
- des notifications professionnelles automatiques et traçables ;
- une migration contrôlée des données du pressing pilote ;
- des exports, sauvegardes et contrôles d’isolation entre tenants.

### 1.2 Principe produit

Il n’y aura pas une copie séparée du logiciel à installer chez chaque
pressing. La plateforme maintient **un seul produit**, avec des paramètres et
des données séparés par tenant et par agence.

Le premier lancement doit rester limité au pressing pilote, puis à quelques
pressings pilotes accompagnés. Le modèle de données, les autorisations et les
tests doivent toutefois supposer plusieurs tenants dès le début : corriger
l’isolation après coup serait plus coûteux et plus risqué.

### 1.3 Hors périmètre initial

Ne font pas partie du socle v1, sauf décision séparée :

- paiement en ligne Wave, Orange Money, MTN MoMo ou carte ;
- GPS temps réel du coursier ;
- scan/lecture automatique d’étiquettes de rangement ;
- envoi de pièces jointes dans le chat ;
- appels audio/vidéo ;
- application native séparée iOS/Android, l’espace client démarrant en web/PWA ;
- facturation automatique des abonnements ou redevances des pressings
  tenants — le modèle commercial devra être cadré séparément, mais la
  plateforme doit mesurer l’usage des messages dès le départ.

## 2. Point de départ réel de l’application

L’application actuelle est une SPA React/Vite/Tailwind installable en PWA.
Ses écrans métier passent par `src/context/AppContext.tsx`, ce qui permet de
remplacer progressivement l’implémentation localStorage par Supabase sans
reconstruire les écrans existants.

Modules déjà présents côté front :

- tableau de bord, POS, commandes et clients ;
- production atelier, remises et caisse ;
- ramassage et livraison à domicile ;
- rangement des commandes prêtes et règles définies par le propriétaire ;
- personnel, stocks, dépenses et rapports ;
- paramètres persistants de la boutique.

Données aujourd’hui conservées dans le navigateur :

- **13 clés métier** : `pressingpro_orders`, `pressingpro_customers`,
  `pressingpro_cash_register`, `pressingpro_employees`,
  `pressingpro_attendance`, `pressingpro_inventory_products`,
  `pressingpro_stock_movements`, `pressingpro_expenses`,
  `pressingpro_expense_categories`, `pressingpro_next_ticket_number`,
  `pressingpro_shop_settings`, `pressingpro_logistics_tasks` et
  `pressingpro_storage_locations` ;
- des préférences propres à l’appareil, comme le thème et les couleurs
  personnalisées, qui peuvent rester locales.

Limites à lever :

- les données ne sont visibles que dans un navigateur ;
- aucun compte propriétaire/employé/client ;
- aucune sauvegarde serveur ni synchronisation entre postes ;
- les règles dites « du propriétaire » ne sont pas protégées par un rôle ;
- les clients ne disposent d’aucun espace de suivi ni de canal intégré ;
- les données d’un futur deuxième pressing ne peuvent pas coexister de façon
  sûre dans le modèle local actuel.

## 3. Projet Supabase cible : Pressing_Pro

| Élément | Cible |
|---|---|
| Projet | `Pressing_Pro` |
| Project ID | `phjstsydxvggtduohfrl` |
| Région | `eu-west-1` — Irlande |
| Rôle dans ce plan | cible backend de production à vérifier en phase 0 |
| Ancien projet `waalxvtncxcpbyozhhhp` | abandonné comme cible ; aucune opération effectuée |

Avant toute écriture en phase 0, il faudra vérifier sur Pressing_Pro :

- le propriétaire du projet et l’organisation Supabase ;
- l’état du projet, son contenu actuel et sa version PostgreSQL ;
- les extensions disponibles et les paramètres Auth/Realtime/Storage ;
- la formule souscrite, les quotas et les sauvegardes ;
- la stratégie d’environnements : production, préproduction et développement
  ne doivent pas être confondus ;
- les personnes ayant accès au projet et la procédure de récupération du
  compte propriétaire.

Il est recommandé de ne pas développer directement dans un schéma de
production sans migrations versionnées et environnement de validation.

## 4. Architecture cible

```text
Application métier (comptoir / atelier / gérance)
                    ┐
Espace client PWA   ├─ HTTPS / WebSocket ─► Supabase Pressing_Pro (eu-west-1)
                    │                         ├─ PostgreSQL + Row Level Security
                    │                         ├─ Auth (employés et clients)
                    │                         ├─ Realtime (commandes, tournées, chat)
                    │                         ├─ Storage privé (pièces jointes futures)
                    │                         └─ Edge Functions / tâches serveur
                    │                                ├─ notifications push
                    │                                ├─ WhatsApp / SMS / e-mail
                    │                                ├─ webhooks fournisseurs
                    │                                └─ relances programmées
                    │
Hébergement front : Vercel (build Vite actuel)
Administration plateforme : espace super-admin séparé et restreint
```

Principes :

- le front utilise uniquement la clé publique Supabase et le jeton de
  l’utilisateur connecté ;
- aucune clé `service_role` ni aucun secret fournisseur ne doit être présent
  dans le navigateur ;
- les opérations sensibles passent par des fonctions PostgreSQL ou des Edge
  Functions contrôlées ;
- PostgreSQL et RLS constituent la frontière de sécurité, pas seulement
  l’interface ;
- le schéma et les politiques sont gérés par migrations SQL versionnées dans
  le dépôt.

## 5. Modèle multi-tenant

### 5.1 Définitions

- **Organisation / tenant** : l’entreprise cliente de la plateforme, par
  exemple un pressing indépendant ou un groupe possédant plusieurs agences.
- **Agence / boutique (`shop`)** : un point de vente physique de cette
  organisation, avec ses employés, son catalogue effectif, ses tournées et
  son plan de rangement.
- **Plateforme** : l’éditeur/exploitant du service, qui dispose d’outils
  d’administration séparés des rôles métier.

Au démarrage, le pressing pilote correspondra à une organisation et une
agence. Un autre pressing indépendant constituera une autre organisation,
même si un même client final fréquente les deux.

### 5.2 Règles d’isolation

- chaque donnée métier appartient à une agence et, directement ou par
  l’agence, à une organisation ;
- aucun employé d’un tenant ne peut rechercher, lire ou modifier les données
  d’un autre tenant ;
- une même personne peut être cliente de plusieurs pressings, mais ses
  fiches et historiques restent séparés par organisation ;
- les contraintes d’unicité sont limitées au bon périmètre : numéro de ticket
  par agence, code d’emplacement par agence, téléphone client par organisation ;
- les identifiants publics ne doivent pas permettre de deviner ou d’énumérer
  les données d’autres tenants ;
- l’accès de support par la plateforme doit être explicite, temporaire,
  journalisé et, hors incident critique, autorisé par le tenant.

### 5.3 Appartenances et rôles

Les comptes ne portent pas un rôle global unique. Une table d’appartenance
relie chaque utilisateur à une organisation et, si nécessaire, à une agence :

| Rôle | Périmètre recommandé |
|---|---|
| `platform_super_admin` | administration de la plateforme, hors données métier par défaut |
| `organization_owner` | toutes les agences de son organisation, paramètres et comptes |
| `shop_manager` | gestion d’une agence, rapports et paramètres autorisés |
| `cashier` | POS, commandes, clients et messagerie de son agence |
| `workshop` | production, rangement et informations nécessaires à l’atelier |
| `courier` | tournées qui lui sont affectées et échanges liés |
| `customer` | uniquement ses commandes, demandes et conversations liées |

Les rôles exacts et leurs permissions devront être validés avant la phase 2.
Le propriétaire du pressing pourra inviter ou désactiver ses employés sans
donner accès au projet Supabase.

## 6. Modèle de données PostgreSQL

Les noms ci-dessous décrivent le modèle logique ; le schéma SQL détaillé sera
produit et relu en phase 0. Les identifiants actuels du pressing pilote
pourront être conservés pendant la migration lorsque cela facilite la
traçabilité.

### 6.1 Tenancy, comptes et configuration

| Table | Rôle |
|---|---|
| `organizations` | tenant : entreprise abonnée, statut, dates, paramètres globaux |
| `shops` | agence physique, slug public, coordonnées, horaires et statut |
| `profiles` | informations d’affichage liées au compte Supabase Auth |
| `memberships` | rattachement utilisateur ↔ organisation/agence, rôle et statut |
| `invitations` | invitations employés expirantes et révocables |
| `shop_settings` | identité, frais, règles logistiques et règles de rangement par agence |
| `service_catalog_items` | articles/services et prix configurables par tenant/agence |
| `platform_subscriptions` (ultérieur) | formule, statut commercial et limites du tenant |
| `usage_counters` | volumes mesurés : messages, notifications, utilisateurs, stockage |

Le catalogue ne doit plus être figé dans le code pour un produit vendu à
plusieurs pressings. Les lignes déjà vendues continueront de porter un
instantané du nom et du prix, afin qu’un changement de tarif ne modifie pas
les tickets historiques.

### 6.2 Métier pressing

| Table | Points de conception |
|---|---|
| `customers` | fiche CRM propre à une organisation ; index nom/téléphone |
| `customer_account_links` | lien vérifié entre un compte client et ses fiches dans chaque organisation |
| `orders` | organisation, agence, client, statut, promesse, montants, rangement et restitution ; lignes en JSONB v1 avec instantané tarifaire |
| `order_events` | historique horodaté des transitions et événements visibles ou internes |
| `ticket_counters` | compteur atomique par agence, jamais deux fois le même numéro |
| `storage_locations` | plan physique et capacités de chaque agence |
| `logistics_tasks` | ramassages/livraisons, affectation coursier et statuts de tournée |
| `pickup_requests` | demande publique ou client à valider avant création d’une tournée confirmée |
| `cash_register_days`, `cash_closings` | état de caisse et historique des clôtures Z |
| `employees`, `attendance_records` | registre RH séparé du compte de connexion ; unicité employé/date |
| `products`, `stock_movements` | quantité modifiée uniquement par une fonction transactionnelle |
| `expense_categories`, `expenses` | dépenses et annulations, alignées sur les rapports |

Les fonctions serveur sensibles devront garantir au minimum :

- attribution atomique du numéro de ticket ;
- transition de statut de commande autorisée ;
- rangement obligatoire/strict selon les paramètres du tenant ;
- mouvement de stock sans passage sous zéro ;
- confirmation de livraison et encaissement du solde une seule fois ;
- écriture de l’événement métier et de la demande de notification dans la
  même transaction.

### 6.3 Conversations et messages intégrés

| Table | Rôle |
|---|---|
| `conversations` | fil entre une agence et un client ; type général, commande ou tournée ; statut ouvert/résolu/archivé ; employé affecté ; dernier message |
| `conversation_participants` | participants et curseur de lecture par utilisateur |
| `messages` | texte, expéditeur client/employé/système, type de message, liens éventuels commande/tournée, horodatage |
| `conversation_internal_notes` | notes strictement internes, séparées des messages visibles par le client |
| `message_templates` | modèles automatiques par événement, canal, langue et agence |
| `quick_replies` | réponses rapides réutilisables par l’équipe |
| `conversation_attachments` (ultérieur) | métadonnées des photos/fichiers stockés dans un bucket privé |

### 6.4 Notifications et préférences

| Table | Rôle |
|---|---|
| `notification_outbox` | événement à diffuser, clé d’idempotence, échéance, tentatives et statut |
| `notification_deliveries` | résultat par canal : intégré, push, WhatsApp, SMS ou e-mail ; identifiant fournisseur et erreurs |
| `push_subscriptions` | abonnements Web Push par utilisateur/appareil, révocables |
| `communication_preferences` | consentements et canaux transactionnels/marketing par client |
| `messaging_channels` | numéro/expéditeur et fournisseur configurés par agence, sans secret en clair côté front |
| `provider_webhook_events` | accusés fournisseur reçus, dédupliqués et journalisés |

## 7. Comptes, rôles et sécurité

### 7.1 Employés et propriétaires

- un compte par personne est recommandé pour attribuer les écritures ;
- création par invitation du propriétaire de l’organisation ;
- désactivation immédiate possible sans supprimer l’historique ;
- sessions adaptées aux postes de travail, avec déconnexion/verrouillage ;
- accès aux Paramètres sensibles réservé aux rôles autorisés : règles de
  rangement, tarifs, modèles de messages, canaux WhatsApp/SMS et employés.

### 7.2 Clients finaux

L’identification client doit rester simple tout en empêchant l’accès aux
commandes d’une autre personne.

Trajectoire recommandée :

1. le pressing envoie au client un lien sécurisé de suivi lié à une commande
   ou une invitation à créer son espace ;
2. le client confirme son numéro par un code à usage unique envoyé par SMS ou
   WhatsApp ;
3. après vérification, le compte est relié à la fiche client du pressing via
   `customer_account_links` ;
4. le client peut ensuite retrouver ses commandes, adresses, demandes et
   conversations pour ce pressing ;
5. s’il fréquente un autre pressing de la plateforme, une liaison distincte
   est créée après vérification, sans fusionner les historiques des tenants.

Un numéro saisi seul ne doit jamais suffire à afficher des commandes. Les
liens de suivi doivent être signés, expirer ou être révocables, et ne donner
que le périmètre prévu.

### 7.3 Demandes publiques d’enlèvement

Chaque agence pourra disposer d’une page publique identifiable par son slug
ou son domaine. Une demande publique crée d’abord un `pickup_request` à
valider ou à confirmer par téléphone/OTP ; elle ne devient pas
automatiquement une tournée confirmée. Cette séparation limite les doublons,
les fausses demandes et les abus.

Des protections anti-spam et des limites de débit devront être prévues sur
tous les formulaires publics et sur l’envoi de codes OTP.

### 7.4 Protections techniques et données personnelles

- Row Level Security activée sur toutes les tables exposées ;
- politiques testées positivement et négativement entre deux tenants ;
- pièces jointes dans des buckets privés avec URL signées temporaires ;
- secrets fournisseurs uniquement dans les secrets serveur/Edge Functions ;
- journaux d’audit pour les accès de support et actions sensibles ;
- exports par tenant et par client, durées de conservation et suppression à
  définir ;
- hébergement en Union européenne (`eu-west-1`) : les implications de la loi
  ivoirienne n° 2013-450 et, selon les personnes concernées, du RGPD devront
  être examinées avant la mise en production commerciale ;
- information claire des clients sur l’utilisation de leur numéro pour le
  suivi et les messages, avec consentement distinct pour le marketing.

## 8. Espace client

L’espace client peut être servi par la même application web/PWA, avec des
routes et autorisations distinctes de l’application métier. Il affichera
l’identité du pressing choisi : nom, coordonnées, horaires, adresse et
consignes de retrait.

### 8.1 Fonctions prévues

- **Mes commandes** : commandes en cours et historique ;
- **Suivi** : dépôt, traitement, prête, en livraison, livrée/remise ;
- **Ticket** : référence, date promise, total, acompte et reste à payer ;
- **Enlèvement** : demande de ramassage avec adresse, repères, date et
  créneau, puis suivi de la confirmation et de la collecte ;
- **Livraison** : adresse et créneau connus, statut de départ et confirmation ;
- **Messages** : conversation avec le pressing et badge de messages non lus ;
- **Profil** : coordonnées, adresses favorites et préférences de notification ;
- **Fidélité** : informations déjà gérées par le pressing, sans solde inventé.

Le code de casier de rangement est une information d’exploitation interne. Le
client verra par défaut « Prête à retirer au comptoir » plutôt que le code
physique exact, sauf si le propriétaire décide explicitement de l’afficher.

### 8.2 Suivi compréhensible

Les statuts internes actuels (`received`, `washing`, `ironing`, `ready`,
`delivered`) resteront la source métier. L’espace client les présentera en
étapes lisibles, enrichies par les événements de tournée (`scheduled`,
`en_route`, `completed`, `failed`) sans confondre production et livraison.

La table `order_events` fournira une chronologie fiable : reçue, lavage,
repassage/finition, prête, sortie en livraison, livrée. Aucune date ne doit
être inventée pour les anciennes commandes migrées.

## 9. Messagerie intégrée client ↔ pressing

### 9.1 Expérience client

La messagerie se présente comme un chat familier :

- fil chronologique avec le nom du pressing ;
- messages de l’équipe, messages automatiques identifiés comme tels et
  réponses du client ;
- cartes liées à une commande ou une tournée : numéro de ticket, statut,
  action attendue ;
- champ de saisie libre pour une remarque, une question ou une précision ;
- actions rapides lorsque c’est utile : « Confirmer l’adresse »,
  « Demander une livraison », « Signaler un retard », « Modifier le créneau » ;
- indicateurs d’envoi et de lecture dans l’application ;
- badge de non-lus sur l’entrée Messages.

Une action rapide ne doit pas se contenter d’envoyer du texte ambigu : elle
appellera une fonction serveur validée qui mettra à jour la demande ou créera
une tâche visible par l’équipe. Les remarques libres restent dans la
conversation ; un employé peut ensuite les transformer en instruction de
commande ou de tournée après confirmation.

### 9.2 Expérience équipe

L’application métier reçoit un module **Messagerie** distinct des Paramètres :

- liste des conversations par agence ;
- filtres : non lues, en attente de réponse, commandes prêtes, enlèvements,
  conversations affectées à un employé, résolues ;
- recherche par client, téléphone, ticket ou contenu ;
- panneau de contexte : client, commandes en cours, solde, date promise,
  emplacement interne, tournée et adresse ;
- réponse libre, réponse rapide ou modèle professionnel ;
- affectation à un employé, résolution/réouverture ;
- note interne invisible pour le client ;
- ouverture directe depuis une commande, un client ou une tournée.

Les employés répondent au nom du pressing. Le client peut voir le prénom ou
le rôle de l’employé si le tenant le souhaite, mais jamais les informations
d’autres clients.

### 9.3 Types de messages

- **Automatiques transactionnels** : commande reçue, prête, enlèvement
  confirmé, coursier en route, livraison terminée, incident, relance de
  retrait ;
- **Messages d’équipe** : réponse personnalisée, précision sur une tache, un
  délai, un article fragile ou un solde ;
- **Messages client** : question, remarque, changement d’adresse ou de
  créneau, instruction d’accès au domicile ;
- **Messages système** : invitation à l’espace client, changement de créneau,
  confirmation d’une action rapide ;
- **Messages marketing** : uniquement avec consentement, modèles adaptés et
  possibilité de se désinscrire ; à traiter séparément des messages de suivi.

### 9.4 Temps réel, lecture et fiabilité

- Supabase Realtime met à jour la conversation ouverte et les compteurs de
  non-lus ;
- le curseur de lecture est propre à chaque participant ;
- un message possède une clé d’idempotence pour éviter les doublons en cas de
  double appui ou de reconnexion ;
- l’échec d’envoi conserve le brouillon et propose une nouvelle tentative ;
- les indicateurs « lu » intégrés ne promettent pas la lecture WhatsApp/SMS :
  chaque canal conserve son propre accusé dans `notification_deliveries` ;
- les pièces jointes, la présence « en train d’écrire » et les réactions sont
  des améliorations ultérieures, non nécessaires au lancement.

### 9.5 Charges de support et règles de service

Ouvrir un chat crée une attente de réponse. Chaque tenant devra pouvoir
configurer :

- horaires de réponse affichés au client ;
- message automatique hors horaires ;
- employés autorisés à répondre ;
- délais cibles internes et alertes de conversations en attente ;
- réponses rapides validées pour garder un ton professionnel homogène.

La messagerie ne remplace pas un appel urgent : le numéro du pressing doit
rester visible dans la conversation.

## 10. Notifications professionnelles multicanales

### 10.1 Chaîne recommandée

1. Une action métier crée un événement (`order.ready`, `pickup.scheduled`,
   `delivery.en_route`, `message.received`, etc.).
2. L’événement et son entrée `notification_outbox` sont écrits dans la même
   transaction que le changement métier.
3. Un traitement serveur sélectionne le modèle de l’agence, vérifie les
   préférences et les canaux disponibles, puis évite les doublons grâce à une
   clé d’événement.
4. Le message est ajouté à la conversation intégrée.
5. Une notification push est tentée sur les appareils abonnés.
6. Selon l’importance et la configuration, WhatsApp/SMS/e-mail est envoyé en
   canal principal ou de repli.
7. Les webhooks fournisseur mettent à jour les statuts envoyé/livré/échoué ;
   les échecs temporaires sont retentés avec délai progressif.

### 10.2 Rôle de chaque canal

| Canal | Rôle | Limite à connaître |
|---|---|---|
| Conversation intégrée | historique complet, réponses du client, cartes commande/tournée | nécessite l’ouverture de l’espace client |
| Web Push PWA | alerte immédiate et gratuite à l’usage | installation/autorisation nécessaires ; comportement variable selon téléphone/navigateur, notamment sur iPhone |
| WhatsApp | canal riche et familier en Côte d’Ivoire, lien de suivi et réponses | numéro Business, modèles et règles du fournisseur/Meta, coûts par conversation, consentement |
| SMS | repli large, OTP et alertes critiques | coût par message, expéditeur et qualité variables selon fournisseur |
| E-mail | reçus et communications secondaires | consultation moins immédiate |

### 10.3 Modèles professionnels

Exemples de modèles à valider avec le propriétaire, avec variables contrôlées :

- **Commande prête** : « Bonjour {prenom}, votre commande {ticket} est prête.
  Reste à payer : {montant}. Retrait au comptoir ou demande de livraison :
  {lien_suivi}. {nom_pressing} »
- **Enlèvement confirmé** : « Bonjour {prenom}, votre enlèvement est confirmé
  le {date} entre {creneau}. Préparez votre sac ; le comptage et le tarif
  seront confirmés à l’arrivée au pressing. »
- **Coursier en route** : « Notre coursier est en route pour {adresse_courte}.
  Merci de rester joignable au {telephone}. »
- **Remarque à traiter** : accusé automatique indiquant les horaires de
  réponse, sans promettre une action que l’équipe n’a pas encore validée.

Les modèles intégrés peuvent être personnalisés rapidement. Les modèles
WhatsApp externes suivent en revanche le processus de validation du
fournisseur ; chaque variante publiée doit être versionnée.

### 10.4 Identité d’envoi par tenant

Pour une image professionnelle, l’objectif est que chaque pressing envoie
depuis son propre numéro WhatsApp Business et/ou son expéditeur SMS lorsque
le fournisseur le permet. La configuration et les délais de validation font
partie de l’onboarding du tenant.

Un numéro partagé de plateforme peut servir de secours pendant les pilotes,
mais il doit être présenté honnêtement au client et ne doit pas mélanger les
conversations de plusieurs pressings.

## 11. Temps réel, cohérence et hors ligne

### 11.1 Temps réel

Realtime sera abonné, selon le rôle, aux commandes, tournées, rangement,
stocks et conversations de son périmètre. Un client ne s’abonne qu’à ses
propres commandes et messages.

RLS reste obligatoire même pour Realtime : l’appartenance au canal ou le
filtrage dans le navigateur ne constitue pas une protection.

### 11.2 Conflits et idempotence

- tickets et stocks : fonctions atomiques PostgreSQL ;
- transitions de commande et de tournée : fonctions contrôlées ;
- messages et demandes d’enlèvement : clé d’idempotence côté client ;
- webhooks : identifiant fournisseur unique et traitement rejouable ;
- fiches simples : `updated_at`, avec détection de conflit à ajouter si un
  usage simultané intense est constaté.

### 11.3 Hors ligne

V1 recommandée :

- application métier : écritures en ligne pour préserver l’unicité des
  tickets et la cohérence multi-postes ;
- espace client : consultation possible de la coquille PWA, mais envoi de
  message et demande d’enlèvement en ligne ; brouillon conservé localement en
  cas d’échec ;
- file d’écritures hors ligne du comptoir : option séparée et chiffrée après
  observation des coupures réelles.

Un indicateur clair « connecté / reconnexion / hors ligne » devra être visible
côté équipe, et les actions impossibles hors ligne ne doivent pas simuler un
succès.

## 12. Migration du pressing pilote

1. Créer l’organisation et l’agence du pressing pilote dans l’environnement
   validé.
2. Ajouter au front un export JSON des 13 clés métier actuelles.
3. Importer avec des scripts serveur contrôlés en conservant les
   identifiants utiles et les instantanés de commandes.
4. Initialiser le compteur de tickets à `max(ticket) + 1` pour l’agence.
5. Reprendre tarifs, paramètres, frais, règles de rangement et emplacements.
6. Inviter le propriétaire et les employés, puis lier les profils aux fiches
   employés sans confondre compte de connexion et dossier RH.
7. Ne créer aucun compte client automatiquement : les fiches CRM sont migrées,
   puis chaque client lie son compte après vérification de son numéro.
8. Ne générer aucun faux historique de conversation et n’envoyer aucune
   notification rétroactive pour les anciennes commandes.
9. Contrôler avant bascule : nombres de lignes, totaux commandes et dépenses,
   caisse, stock, tournées ouvertes et occupation des emplacements.
10. Basculer un jour de fermeture, avec retour arrière documenté tant qu’une
    divergence distante n’a pas été acceptée.

Les données de démonstration doivent vivre dans un tenant de démonstration
séparé, jamais dans le tenant de production d’un pressing réel.

## 13. Déploiement, environnements et coûts

- **Front** : Vercel, build Vite actuel, variables publiques Supabase par
  environnement, aperçus de branche pour les validations.
- **Base cible** : Supabase Pressing_Pro (`phjstsydxvggtduohfrl`, `eu-west-1`).
- **Environnements** : définir production et préproduction/développement
  avant la phase 1 ; appliquer les mêmes migrations versionnées.
- **Domaines** : domaine de l’application métier et adresse publique client à
  choisir ; slug par agence en v1, domaine personnalisé par tenant en option
  ultérieure.
- **Sauvegardes** : vérifier la rétention incluse, tester une restauration
  avant l’ouverture commerciale et conserver des exports planifiés par tenant.
- **Supervision** : erreurs front/Edge Functions, files de notifications en
  échec, quotas Auth/Realtime/Storage et coûts fournisseurs.

Les formules gratuites peuvent suffire à un prototype, mais une exploitation
commerciale multi-tenant devra prévoir les limites de Supabase/Vercel, les
sauvegardes, le volume Realtime, le stockage des pièces jointes futures et le
coût variable des SMS/WhatsApp. Les tarifs et quotas officiels seront
revalidés au moment de la phase 0 ; aucun prix fournisseur n’est figé dans ce
plan.

## 14. Trajectoire de réalisation

Chaque phase nécessite un feu vert distinct. Les efforts sont des ordres de
grandeur en sessions de travail, hors délais externes de validation des
numéros/modèles WhatsApp, choix juridiques et temps de recette du propriétaire.

| Phase | Contenu | Jalon de sortie | Effort estimé |
|---|---|---|---|
| 0 | Vérification Pressing_Pro, environnements, modèle tenant, schéma v1, RLS et menaces | schéma et règles relus ; projet prêt, sans donnée réelle | 1–2 sessions |
| 1 | Socle données du pressing pilote : Supabase, AppContext adapté, catalogue/paramètres, ticket atomique, stock, logistique et rangement | application métier actuelle fonctionnelle sur données distantes | 3–5 sessions |
| 2 | Auth, organisations/agences, invitations, rôles et onboarding interne | deux tenants fictifs prouvent l’isolation ; rôles effectifs | 2–3 sessions |
| 3 | Realtime équipe, migration pilote et recette | comptoir/atelier synchronisés ; totaux migrés validés | 2–3 sessions |
| 4 | Identité client, espace client, suivi et demandes d’enlèvement | un client vérifié suit sa commande et demande un enlèvement | 3–5 sessions |
| 5 | Messagerie intégrée et push : inbox équipe, chat client, statuts automatiques, non-lus | conversation bidirectionnelle testée sur téléphone et poste atelier | 3–4 sessions |
| 6 | Notifications externes : WhatsApp/SMS/e-mail, modèles, webhooks, replis et relances | envois pilotes tracés sans doublon, quotas mesurés | 2–4 sessions + délais fournisseur |
| 7 | Commercialisation multi-tenant : création de tenant accompagnée, page publique par agence, branding, super-admin, exports et limites d’usage | un deuxième pressing réel peut être mis en service sans accès au code | 3–5 sessions |
| 8 | Durcissement : restauration testée, supervision, anti-spam, accessibilité, guides et formation | exploitation documentée et pilote commercial contrôlé | selon périmètre |

La phase 6 peut démarrer en parallèle administratif de la phase 5, car le
numéro WhatsApp et les modèles peuvent demander un délai externe. En
revanche, aucun envoi réel ne doit être promis avant validation du fournisseur
et des consentements.

## 15. Tests et critères de recette

Aucune phase ne sera considérée terminée sur la seule base d’un écran visible.

Contrôles minimums :

- build TypeScript et tests métier existants toujours verts ;
- jeux de test avec **deux organisations, trois agences et un même numéro
  client présent dans deux tenants** ;
- tentatives d’accès croisé par API et Realtime refusées par RLS ;
- deux postes créant des commandes en même temps sans doublon de ticket ;
- stock incapable de passer sous zéro malgré des appels concurrents ;
- propriétaire, caisse, atelier et coursier limités à leurs permissions ;
- client incapable d’ouvrir une commande, une conversation ou une pièce
  jointe d’un autre client ;
- message envoyé deux fois par double appui sans doublon ;
- événement « commande prête » produisant une seule notification logique ;
- webhook fournisseur rejoué sans second encaissement ni second message ;
- push testé sur les navigateurs/téléphones cibles, avec repli documenté ;
- migration répétée sur copie, écarts comptables à zéro ou expliqués ;
- restauration de sauvegarde réellement exécutée dans un environnement de
  test ;
- parcours responsive et accessible sur mobile pour l’espace client et le
  chat.

## 16. Risques et alternatives

### Risques principaux

- erreur RLS entraînant une fuite entre tenants : schéma simple, revues et
  tests négatifs systématiques ;
- usurpation par numéro recyclé ou code OTP intercepté : codes courts
  expirants, limites d’essais, révocation des sessions et procédure de
  récupération contrôlée par le pressing ;
- faible adoption de l’espace client : invitation par WhatsApp/SMS, lien de
  suivi sans installation obligatoire et bénéfice visible dès la première
  commande ;
- notifications push non autorisées ou peu fiables : conversation intégrée
  comme historique, WhatsApp/SMS comme canaux d’alerte ;
- charge de réponses au chat : horaires, affectation, réponses rapides et
  indicateurs de conversations en attente ;
- coûts WhatsApp/SMS dépassant la redevance tenant : mesure d’usage, quotas,
  alertes et règles de repli avant commercialisation ;
- demandes publiques frauduleuses : validation OTP/personnel et anti-spam ;
- dépendance fournisseur : PostgreSQL portable, migrations et exports
  versionnés, adaptateurs de messagerie isolés.

### Alternatives comparées

- **WhatsApp seul, sans chat intégré** : lancement plus direct, mais historique
  et contexte dispersés, forte dépendance au fournisseur et difficulté à relier
  proprement chaque échange à une commande/tenant. Écarté comme solution
  principale.
- **Chat intégré seul, sans WhatsApp/SMS** : maîtrise complète de l’échange,
  mais alerte incertaine si le client n’installe pas la PWA ou refuse le push.
  Écarté comme unique canal au lancement.
- **Une installation par pressing** : maintenance, sauvegardes, mises à jour et
  sécurité ingérables à plusieurs clients. Écarté.
- **Plateforme hybride recommandée** : chat intégré comme source de
  conversation, push comme alerte applicative, WhatsApp/SMS comme canaux de
  portée et de secours.

## 17. Décisions à valider avant la phase 0

1. Confirmer que Pressing_Pro (`phjstsydxvggtduohfrl`, `eu-west-1`) est la
   cible de production et choisir l’environnement de préproduction.
2. Valider le modèle **organisation → agences**, avec le pressing pilote comme
   premier tenant.
3. Valider un compte par employé et la liste initiale des rôles.
4. Choisir le parcours client v1 : lien sécurisé de suivi puis création de
   compte par OTP, comme recommandé.
5. Choisir si une demande publique d’enlèvement exige l’OTP avant confirmation
   ou une validation manuelle par le pressing.
6. Décider l’ordre des canaux externes : WhatsApp d’abord, SMS en repli, comme
   recommandé, et le fournisseur à évaluer.
7. Décider si chaque pressing pilote utilise dès le départ son propre numéro
   WhatsApp Business ou un numéro de plateforme temporaire clairement annoncé.
8. Valider les messages automatiques de lancement et les horaires de réponse
   affichés dans le chat.
9. Définir la conservation des conversations, les exports à la sortie d’un
   tenant et la procédure de suppression.
10. Valider la mesure d’usage des messages, même si la grille commerciale
    (installation, redevance, packs) est arrêtée dans un document séparé.
11. Choisir le pressing pilote, la fenêtre de migration et la personne qui
    signe la recette.

## 18. Prochaine étape

La prochaine étape n’est pas encore du code : relire et valider ce plan,
trancher les décisions du §17, puis seulement donner un feu vert séparé pour
la **phase 0** sur Pressing_Pro.

À la phase 0, les livrables attendus seront :

- inventaire vérifié du projet Pressing_Pro ;
- schéma SQL v1 et politiques RLS proposés, sans données réelles ;
- matrice des rôles et menaces d’accès croisé ;
- choix d’environnement de validation ;
- prototype technique minimal prouvant l’isolation de deux tenants fictifs.

---

*Plan mis à jour le 28 octobre 2026 à partir de l’application livrée sur la
branche `arena/e0c13218-googlepress`, incluant logistique, rangement et
configuration propriétaire. Aucun élément backend n’existe encore dans le
dépôt.*
