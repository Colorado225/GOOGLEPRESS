# Administration plateforme — super-admin unique

## 1. Périmètre et accès

PressingPro CI est le produit vendu à des **pressings et blanchisseries clients**. Une organisation représente un compte client de la plateforme ; ses agences représentent ses points de vente. Les clients finaux du pressing restent dans son périmètre métier et ne sont pas des comptes de la plateforme.

La route **`/administration`** est séparée de l’ERP :

- elle ne monte pas `AppProvider` et ne charge ni panier, ni brouillon, ni données métier ;
- elle exige une session Supabase et une ligne active dans `public.platform_admins` ;
- un index unique partiel autorise **au maximum un super-admin actif** ;
- aucun écran ni RPC public ne permet de créer un administrateur ou de modifier `platform_admins` ;
- avec un facteur TOTP vérifié, la console exige le niveau Supabase **AAL2** avant de monter les modules ;
- le compte super-admin sans membership est dirigé directement vers l’administration, jamais vers la création d’un pressing ;
- une erreur de vérification des memberships affiche un écran de nouvelle tentative : elle n’est jamais interprétée comme « aucun pressing » ;
- la démonstration locale explicite utilise uniquement des organisations fictives et le signale dans l’en-tête.

Chaque pressing ou blanchisserie inscrit reste administrable depuis la console. Le verrouillage conserve les données mais ferme réellement les accès RLS du tenant. La console ne lit toujours **ni commandes, ni clients finaux, ni stock**.

## 2. Centre des opérations

Le centre est découpé en huit modules, avec rechargement uniquement sur action explicite.

### Pilotage commercial

- MRR calculé à partir des formules et tarifs personnalisés ;
- encaissements du mois, créances et soldes dus ;
- comptes actifs, en essai, en retard et verrouillés ;
- répartition Free / Pro / Business, inscriptions, résiliations et renouvellements à 30 jours ;
- alertes plateforme et files de messages externes.

Ces indicateurs utilisent uniquement les organisations, agences, abonnements et écritures commerciales de la plateforme.

### Finances

- factures numérotées, remise, code promotionnel et échéance ;
- paiements partiels ou complets, références Wave / MTN MoMo / Orange Money / espèces / virement ; une référence opérateur est obligatoire pour confirmer ou rembourser une transaction Mobile Money ;
- contre-écritures de remboursement et avoirs limités au solde réel restant, sans effacer le paiement initial ;
- recalcul du statut et du solde après chaque écriture ;
- reçus et factures imprimables, exports CSV compatibles Excel.

Une référence Mobile Money saisie manuellement **ne prouve pas une confirmation opérateur**. L’application enregistre une écriture administrative ; elle ne prétend pas avoir interrogé Wave, MTN ou Orange. Les statuts de remboursement ne déclenchent pas non plus un remboursement réel chez le provider.

### Offres et renouvellements

- prix mensuel, durée d’essai, quotas d’agences, utilisateurs, commandes mensuelles et casiers ;
- modules inclus et activation de chaque offre ; les modules de la formule effective pilotent les fonctions ERP concernées ;
- une offre inactive ne peut plus être demandée, mais ses abonnés existants conservent leurs quotas et modules ;
- tarif personnalisé par agence, renouvellement automatique, verrouillage automatique et délai de grâce ;
- fin d’essai personnalisée, changement de formule planifié et résiliation ;
- demandes de changement de formule, rappels et alertes de retard ;
- cycle d’automatisation pour les essais, changements planifiés, renouvellements, factures échues et verrouillages.

`get_shop_subscription_state` lit les mêmes offres et conditions personnalisées : la durée d’essai n’est plus une constante de 14 jours dans l’interface. Les quotas sont appliqués côté PostgreSQL, pas seulement masqués dans le navigateur.

### Support

- tickets avec numéro, priorité, statut, organisation et agence ;
- réponses visibles par le propriétaire et notes internes strictement réservées au super-admin ;
- historique chronologique, résolution et réouverture après une réponse du client ;
- pièces jointes PNG, JPEG, WebP ou PDF, 5 Mo maximum chacune ;
- bucket privé `platform-support`, URLs signées de 120 secondes ;
- onglet **Paramètres → Assistance éditeur** pour le propriétaire du pressing.

Un propriétaire ne voit que les tickets de ses organisations. Les notes internes sont filtrées par la RPC serveur. En démonstration, aucun ticket réel ni envoi de pièce jointe n’est simulé.

### Communications

- campagnes ciblant tous les comptes, une formule ou une organisation ;
- annonces Information / Avertissement / Critique dans l’ERP ;
- planification, publication, archivage et campagnes de maintenance ;
- files e-mail et WhatsApp avec destinataire adapté au canal, état et erreur éventuelle ;
- annulation automatique des messages encore en file lorsqu’une campagne est archivée ou expire.

Une campagne de maintenance publiée et active bloque l’accès ERP des tenants ciblés tout en laissant la console super-admin accessible. Elle n’interrompt pas la déconnexion ni la route d’administration.

**Aucun worker de livraison externe n’est fourni sans connecteur réel.** Les lignes e-mail/WhatsApp restent `queued`. Elles ne doivent passer à `sent` qu’après une réponse confirmée d’un provider authentifié. Aucun identifiant ou secret de provider ne doit être ajouté au bundle Vite.

### Sécurité

- enrôlement et vérification TOTP via Supabase Auth ;
- contrôle AAL2 à l’entrée de la console ;
- sessions Auth connues, agent utilisateur, IP, AAL et expiration lorsque Supabase les expose ;
- historique des connexions et alertes sur nouvel appareil ou réseau ;
- déconnexion distante des **autres** sessions avec `signOut({ scope: 'others' })` ;
- procédure de récupération téléchargeable, sans mot de passe, secret TOTP ou clé de service.

### Audit et supervision

- recherche et export CSV du journal administratif ;
- acteur, action, organisation, date et valeurs avant/après en JSON ;
- contrôle de santé enregistré côté serveur, version PostgreSQL, dernière migration visible et horloge serveur ;
- historique des cycles d’automatisation, erreurs techniques et files externes ;
- état explicite des sauvegardes et providers.

Le contrôle de santé ne prétend pas tester un provider non connecté. L’état des sauvegardes managées doit être vérifié dans Supabase : l’application n’affiche jamais une sauvegarde fictive comme réussie. Les exports CSV commerciaux ne sont pas des sauvegardes de restauration.

## 3. Protections serveur

Migrations :

- `supabase/migrations/20261029170000_platform_admin.sql` — fondation du super-admin unique ;
- `supabase/migrations/20261029180000_platform_operations.sql` — opérations commerciales, support et supervision ;
- `supabase/migrations/20261029190000_platform_scheduler.sql` — activation conditionnelle de `pg_cron` et tâche quotidienne idempotente ;
- `supabase/migrations/20261029200000_platform_operations_hardening.sql` — quotas des offres inactives, modules ERP, avoirs, références Mobile Money, promotions concurrentes et files par canal.

RPC principales réservées au super-admin :

- `get_platform_admin_snapshot` ;
- `admin_set_shop_subscription`, `admin_set_organization_status` ;
- `admin_add_support_note`, `admin_update_platform_config` ;
- `get_platform_operations_snapshot` ;
- `admin_platform_command`.

RPC du propriétaire pour le support :

- `get_my_support_snapshot` ;
- `tenant_support_command`.

`run_platform_automations` est réservée à `service_role`. Les tables d’opérations n’ont pas d’accès direct `authenticated` : les lectures et mutations passent par des fonctions `security definer` qui vérifient `auth.uid()` et les droits du tenant ou de l’unique admin. Les entrées d’audit rédigées par la plateforme sont exclues des lectures tenant.

La fermeture des inscriptions est appliquée par un trigger sur `organizations`. Le verrouillage est appliqué par les helpers RLS. Les écritures financières sont additives : pas de bouton de suppression de facture, paiement, avoir, ticket, message ou audit.

## 4. Automatisation et connecteurs

Lorsque `pg_cron` est disponible, la migration planifie `pressingpro-platform-automations` chaque jour à **05:17 UTC**. Sur `Pressing_Pro`, `pg_cron` 1.6.4 et cette tâche active ont été vérifiés après déploiement. Sur un environnement sans ordonnanceur, la console signale le mode manuel. Un ordonnanceur externe peut également appeler la RPC avec une clé `service_role` conservée exclusivement côté serveur.

La préparation des campagnes ne consomme aucun provider. Pour livrer réellement les messages, il faut ajouter ultérieurement un worker serveur qui :

1. verrouille une ligne `queued` ;
2. appelle le provider avec ses secrets serveur ;
3. enregistre `provider`, `provider_reference` et la réponse ;
4. passe à `sent` uniquement après confirmation, sinon à `failed` avec l’erreur ;
5. applique une politique de nouvelle tentative sans doublon.

Aucun envoi SMS n’est présenté comme réussi. Les canaux actuellement préparés sont l’annonce interne, l’e-mail et WhatsApp.

## 5. Activation et récupération du compte unique

L’activation doit être exécutée par le propriétaire de la base dans le SQL Editor Supabase, jamais avec la clé publique du navigateur. Le compte Auth doit déjà exister.

```sql
do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('VOTRE-EMAIL@EXAMPLE.COM')
  limit 1;

  if v_user_id is null then
    raise exception 'Créez d''abord ce compte dans Supabase Auth';
  end if;

  update public.platform_admins set is_active = false where is_active;

  insert into public.platform_admins (user_id, is_active, note)
  values (v_user_id, true, 'Super-admin unique PressingPro CI')
  on conflict (user_id) do update
    set is_active = true,
        note = excluded.note;
end;
$$;
```

Ensuite, ouvrez `/connexion` avec ce compte. La vérification de `platform_admins` précède celle des memberships et la destination est `/administration`. Un propriétaire ou employé sans ligne active est refusé, même s’il connaît l’URL.

### Perte de l’appareil TOTP ou du mot de passe

1. Conserver l’accès du propriétaire au projet Supabase et à l’adresse e-mail du compte.
2. Vérifier l’identité de la personne hors bande avant toute récupération.
3. Depuis Supabase Auth Admin, retirer uniquement le facteur TOTP perdu. **Ne pas désactiver la ligne `platform_admins`** pendant cette opération.
4. Utiliser le flux de réinitialisation de mot de passe Supabase si nécessaire ; ne jamais lire ou stocker le mot de passe dans le SQL Editor.
5. Ouvrir une nouvelle session, déconnecter les autres sessions et enrôler immédiatement un nouveau TOTP.
6. Vérifier qu’il existe exactement une ligne active dans `platform_admins` et zéro second administrateur actif.
7. Consigner l’incident, sa cause, l’heure et les actions dans le suivi d’exploitation.

Ne jamais créer un second super-admin « temporaire », contourner AAL2 dans le code, ni partager la clé `service_role`.

## 6. Déploiement et vérifications

Au **29 octobre 2026**, les quatre migrations d’administration sont appliquées au projet `Pressing_Pro` : la fondation `platform_admin`, les opérations `platform_operations` (version hébergée `20261029131000`), l’ordonnanceur `platform_scheduler` (version hébergée `20261029131223`) et le durcissement `platform_operations_hardening` (version hébergée `20261029132540`). La RLS forcée des 14 tables d’opérations, les trois offres, les cinq RPC, le bucket privé, les cinq triggers de durcissement et la tâche `pg_cron` active ont été contrôlés après exécution. Ne pas rejouer les migrations précédentes.

Après application de la migration d’opérations :

- régénérer les types si le schéma évolue ;
- vérifier la connexion avec l’unique compte et l’absence de membership requis ;
- activer le TOTP et contrôler AAL2 ;
- créer une facture de recette, un paiement partiel puis un avoir, sans utiliser de vraie référence opérateur ;
- créer un ticket côté pressing et vérifier qu’une note interne reste invisible ;
- publier une campagne de test ciblée sur une organisation de recette ;
- vérifier que les messages externes restent `queued` sans worker ;
- contrôler le cycle d’automatisation et l’état réel des sauvegardes dans Supabase.

Commandes locales :

```bash
npm run lint
npm run test:unit
npm run test:phase0
npm run test:e2e
npm run build
```

Les tests PGlite couvrent notamment l’unique admin, les refus croisés entre tenants, l’absence de lecture métier, la RLS de verrouillage, les paiements partiels/remboursements/avoirs, les notes internes, les campagnes de maintenance, les files externes et l’automatisation. Playwright couvre la console, le centre des opérations, les parcours ERP existants et l’affichage mobile.
