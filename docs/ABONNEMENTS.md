# Formules d'abonnement et stratégie commerciale

> État : trois formules **Free / Pro / Business** définies et affichées dans
> l'application (Paramètres → Abonnement, et carte de la barre latérale).
> Aucun paiement n'est encaissé par l'application : le choix d'une formule est
> une **demande** enregistrée sur l'appareil, activée par l'équipe.

## 1. Les trois formules

| | **Free** | **Pro** ⭐ | **Business** |
| --- | --- | --- | --- |
| Prix mensuel | 0 FCFA | 12 000 FCFA | 29 000 FCFA |
| Prix annuel | 0 FCFA | 120 000 FCFA | 290 000 FCFA |
| Économie annuelle | — | 24 000 FCFA (2 mois) | 58 000 FCFA (2 mois) |
| Agences | 1 | 1 | 3 |
| Utilisateurs | 2 | 8 | Illimité |
| Commandes / mois | 100 | Illimité | Illimité |
| Casiers | 10 | Illimité | Illimité |
| Cible | Pressing qui teste ou travaille seul | Pressing établi avec équipe et livraisons | Enseigne multi-points de vente |

**Free** contient : caisse, tickets, encaissements, catalogue des prestations
et des vêtements, rangement et étiquettes de casier, rapports du jour,
sauvegarde manuelle.

**Pro** ajoute : comptes d'équipe, espace client avec suivi de commande,
tournées de livraison avec carte et heure d'arrivée, preuve de remise (photo,
signature, code), rapports détaillés et exports, sauvegarde automatique dans la
base.

**Business** ajoute : utilisateurs illimités, accès par agence, accompagnement
à la mise en place, formation sur site, support prioritaire et gestionnaire
dédié. Annoncés mais **pas encore livrés** (affichés « bientôt » dans l'écran) :
tableau de bord consolidé multi-agences, API et webhooks.

## 2. Pourquoi ces prix

Le raisonnement, à vérifier avec vos propres chiffres :

- **Le point d'ancrage est la commande perdue, pas le logiciel.** Un pressing
  qui perd une commande ou un client par mois perd bien plus que 12 000 FCFA.
  Le prix doit se comparer à ce manque à gagner, jamais au prix d'un cahier.
- **La grille se lit en pourcentage du chiffre d'affaires.** Si un pressing
  encaisse 1 500 000 FCFA par mois, Pro représente 0,8 % du CA. En dessous de
  1 %, la décision se prend sans réunion de famille ; au-dessus de 3 %, elle
  demande une preuve.
- **Free n'est pas une perte, c'est un canal d'acquisition.** Il occupe le
  terrain, crée l'habitude et fournit les témoignages qui vendent Pro.
- **Business vaut 2,4 × Pro** parce qu'il vend autre chose : le pilotage de
  plusieurs points de vente et l'accompagnement humain, pas des fonctionnalités
  en plus.

Ces montants sont une **proposition de départ**, pas une vérité : ils se
testent (§ 6).

## 3. Ce que l'application fait vraiment

- Les formules sont définies dans `src/lib/subscription.ts` — une seule source
  de vérité, utilisée par l'écran Paramètres et par la carte de la barre
  latérale.
- L'écran **Paramètres → Abonnement** compare les trois formules, bascule
  mensuel/annuel, marque la formule actuelle et permet de **copier une demande**
  à envoyer à l'équipe (WhatsApp, e-mail).
- Le choix est conservé **par espace** (`pressingpro_subscription`) : une
  démonstration n'écrase pas le choix d'un compte réel.
- Les anciennes valeurs enregistrées (`decouverte`, `standard`) restent
  lisibles et sont converties sans perte.
- **Les garde-fous sont appliqués** au moment de l'action (§ 3 bis). Choisir
  une formule la débloque immédiatement sur l'appareil ; c'est le point de
  bascule tant que la facturation n'existe pas côté serveur.

## 3 bis. Les garde-fous, règle par règle

Toutes les règles vivent dans `src/lib/planAccess.ts`, testées par
`tests/unit/planAccess.test.ts`. Elles s'appliquent **au moment de l'action**,
jamais en supprimant des données existantes.

| Règle | Free | Pro | Business | Appliqué dans |
| --- | --- | --- | --- | --- |
| Emplacements de rangement | **10 maximum** | illimité | illimité | création d'un casier et des séries |
| Comptes d'équipe | **2 maximum** | 8 maximum | illimité | ajout d'un employé (le formulaire reste ouvert, la saisie n'est pas perdue) |
| Commandes par mois | **100 maximum** | illimité | illimité | création d'une commande au comptoir |
| Espace client / suivi en ligne | verrouillé | inclus | inclus | panneau « Suivi distant » |
| Tournées et carte | verrouillé | inclus | inclus | bascule Liste / Carte, réglages GPS |
| Preuve de remise | verrouillé | inclus | inclus | réglages « Preuve de remise » |
| Rapports détaillés et exports | verrouillés | inclus | inclus | écran Rapports |
| Pilotage multi-agences | non | non | annoncé | pas encore livré : affiché « bientôt » |

### Comment un blocage se présente

- **Limite atteinte** : l'action est refusée avec un message qui donne le
  plafond, le nombre consommé et la formule à prendre. Rien n'est supprimé.
- **Fonction réservée** : un panneau « … — formule Pro » remplace la fonction,
  avec le prix et un bouton **Voir la formule Pro** qui ouvre l'onglet
  Abonnement. Jamais d'erreur technique, jamais de bouton inerte.
- Le compteur de commandes se remet à zéro au changement de mois.

### Ce qui n'est pas encore un garde-fou

- **Les invitations d'équipe côté Supabase** (rôles et accès serveur) ne
  consultent pas encore la formule : elles restent régies par la RLS.
- **Les exports ponctuels** hors écran Rapports (dépenses, sauvegarde JSON)
  restent ouverts : sauvegarder ses données n'est pas une fonction premium.
- **Le multi-agences** n'est pas facturable puisqu'il n'existe pas.

### Limite honnête : ces garde-fous sont côté client

Le choix de formule vit sur l'appareil (`pressingpro_subscription`). Un
utilisateur techniquement curieux peut donc le modifier dans le stockage du
navigateur. C'est acceptable pour une **phase commerciale sans encaissement**,
pas pour de la facturation réelle : la formule devra être stockée en base et
vérifiée par la RLS et les RPC, et les quotas calculés côté serveur. C'est le
lot suivant (§ 4).

## 4. Feuille de route facturation

1. **Demande + activation manuelle** (aujourd'hui) : zéro risque, zéro
   intégration. Suffisant jusqu'à ~30 comptes payants.
2. **Suivi des échéances** : date de fin de période, statut actif/suspendu,
   relance à J-7. Aucun encaissement automatique.
3. **Encaissement en ligne** : agrégateur local (CinetPay, PayDunya, Wave,
   Orange Money / MTN MoMo) plutôt qu'une intégration bancaire directe.
   À décider avec les frais réels par transaction.
4. **Garde-fous côté serveur** : formule en base, quotas et fonctions
   vérifiés par la RLS / les RPC, pour que le client ne puisse plus les
   contourner. À faire **avant** d'encaisser le premier abonnement.
5. **Multi-agences** : la formule Business ne tient sa promesse qu'une fois le
   rattachement de plusieurs agences livré.

## 5. Playbook marketing — ce qui rapporte vraiment

### 5.1 Le positionnement

> **« Le pressing qui ne perd plus de linge — et qui le prouve. »**

Trois preuves à montrer, pas à raconter : le ticket remis, la photo de remise
horodatée, le suivi client. C'est ce qui distingue l'outil d'un simple cahier
numérique.

### 5.2 Les idées classées par rentabilité

| # | Levier | Pourquoi ça rapporte | Effort |
| --- | --- | --- | --- |
| 1 | **Annuel prépayé, 2 mois offerts** | Trésorerie immédiate, churn divisé, CAC amorti sur 12 mois | faible |
| 2 | **Pilote « 30 pressings »** : 3 mois offerts contre témoignage et mesure du gain | Preuve sociale locale + bouche-à-oreille ; coût réel ≈ 0 | moyen |
| 3 | **Parrainage** : 1 mois offert par filleul qui paie, plafonné à 3 | Le canal le moins cher à Abidjan : la confiance circule par le métier | faible |
| 4 | **Vente terrain par quartier** (Cocody, Marcory, Treichville, Yopougon) | Démonstration en 15 min sur place, activation immédiate, objections traitées | élevé |
| 5 | **Commission apporteur d'affaires** (1 mois d'abonnement) pour livreurs, techniciens machines, comptables | Force de vente gratuite, payée au résultat | faible |
| 6 | **Partenariats fournisseurs** (détergents, machines, emballage) : bundle « matériel + 6 mois Pro » | Ils ont déjà la confiance et le passage ; vous payez en licence, pas en cash | moyen |
| 7 | **Dépassement de quota facturé à l'unité** au lieu du blocage | Un pressing en haute saison ne se retrouve jamais bloqué ; il paie ou monte en gamme | moyen |
| 8 | **Add-ons** : pack SMS, étiquettes pré-imprimées, formation d'équipe, reprise de données | Marge élevée, prix libre, aucune infrastructure lourde | moyen |
| 9 | **Page publique « pressing certifié »** (fiche + note + lien de suivi) | Le pressing gagne des clients, donc l'abonnement se justifie tout seul | moyen |
| 10 | **Garantie 30 jours « remboursé si vous ne gagnez pas 2 h par semaine »** | Lève la peur du changement ; très peu de demandes si l'activation est bien faite | faible |
| 11 | **Contrats multi-sites** signés avec le siège (Business) | Panier ×3 à ×10, cycle de vente unique | moyen |
| 12 | **Offre de reprise** : l'équipe saisit 200 fiches clients + catalogue gratuitement | Le vrai coût du changement disparaît ; l'engagement suit | moyen |

### 5.3 Les leviers de prix (dans l'ordre)

1. **Ne jamais remiser le mensuel.** Remiser l'annuel, jamais le mensuel : la
   remise doit acheter de la durée, pas du volume.
2. **Prix de lancement daté** : « Pro à 9 000 FCFA/mois pour les 50 premiers
   pressings, ensuite 12 000 » — crée l'urgence sans casser la grille.
3. **Décoy :** Business à 29 000 rend Pro à 12 000 raisonnable. C'est
   volontaire.
4. **Pas de plan gratuit illimité.** Free plafonne les commandes : au-delà, la
   question se pose naturellement.
5. **Test de prix** : 3 vagues de 15 prospects, 9 000 / 12 000 / 15 000. On
   garde le prix qui maximise `conversion × panier`, pas celui qui plaît.

### 5.4 Le tunnel qui marche ici

```
WhatsApp / terrain → démonstration 15 min (sur SES données) → Free activé le jour même
        → J+1 : première commande encaissée (activation) → J+7 : rapport de gain
        → J+14 : proposition Pro (ou annuel) → parrainage demandé après 1er mois payé
```

L'activation se mesure à **une** chose : la première commande réelle encaissée
dans l'outil dans les 48 h. Sans cela, le compte est mort.

### 5.5 Rétention (là où se trouve la marge)

- **Relance J+3 / J+7 / J+21** avec un chiffre utile, pas un « alors ? ».
- **Rapport mensuel** : commandes traitées, temps gagné, linge retrouvé.
- **Alerte de sommeil** : 7 jours sans commande → appel, pas e-mail.
- **Sauvegarde gratuite de leurs données** : la peur de perdre son historique
  est le premier motif de retour au cahier.

### 5.6 Les métriques à suivre dès le premier client

| Métrique | Cible de départ |
| --- | --- |
| Activation J+2 | > 60 % |
| Free → Pro à 60 jours | 15 – 25 % |
| Churn mensuel Pro | < 3 % |
| ARPA (revenu moyen par compte) | > 11 000 FCFA |
| CAC payback | < 4 mois |
| Part de l'annuel dans les ventes | > 40 % |

## 6. Ce qu'il ne faut pas faire

- **Promettre le multi-agences** avant qu'il ne soit livré : c'est la première
  déception qui tue la confiance.
- **Vendre « la géolocalisation permanente »** : une application web ne suit
  pas un coursier écran verrouillé (voir `docs/SUIVI-GPS-SUITE.md`).
- **Bloquer un pressing en pleine saison** pour un quota : la perte de client
  coûte dix abonnements.
- **Multiplier les formules** au-delà de trois : chaque palier supplémentaire
  ralentit la décision.
- **Remiser pour sauver une vente** : cela fixe le prix réel à la baisse pour
  tous les suivants.

## 7. Plan de lancement 30 / 60 / 90 jours

- **J+0 à J+30** : 10 pressings du pilote, activation assistée, mesures de
  gain, deux témoignages vidéo.
- **J+31 à J+60** : ouverture commerciale, tarif de lancement, 3 apporteurs
  d'affaires, page « pressing certifié » sur 5 comptes.
- **J+61 à J+90** : bascule annuelle, première facturation mensuelle réelle,
  revue des prix avec les chiffres du § 5.6.

## 8. Décisions à trancher

1. Les prix ci-dessus (12 000 / 29 000) sont-ils ceux du lancement, ou
   souhaitez-vous un tarif pilote plus bas et daté ?
2. Free plafonne à 100 commandes/mois : bon seuil, ou 50 pour accélérer la
   conversion ?
3. Encaissement : Wave / Orange Money / MTN MoMo / agrégateur — lequel ouvrir
   en premier ?
4. Le multi-agences est-il vendu en Business **avant** livraison (avec date
   engageante) ou seulement une fois disponible ?
