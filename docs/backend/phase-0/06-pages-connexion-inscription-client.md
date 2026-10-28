# Pages de connexion et d’inscription client — mise en œuvre

> **Design des pages d’accès :** depuis la reprise intégrale du 28 octobre 2026,
> les pages de connexion et d’inscription du personnel **et** de l’espace client
> partagent une composition unique (`AuthShell`). Les comportements décrits
> ci-dessous restent valables ; la direction visuelle, l’accessibilité et les
> vérifications de cette reprise sont documentées dans
> [`docs/PAGES-AUTH-DESIGN.md`](../../PAGES-AUTH-DESIGN.md).

> **État au 28 octobre 2026 : pages livrées et reliées au projet Supabase
> hébergé `Pressing_Pro` (`phjstsydxvggtduohfrl`).**
>
> Relevé réel des réglages Auth (et non plus l’état décrit lors de la
> conception) :
>
> - `disable_signup` = **false** : l’inscription autonome est ouverte ;
> - `mailer_autoconfirm` = **true, réglage temporaire de phase de test** :
>   aucun SMTP de production n’étant configuré, un e-mail de confirmation ne
>   serait pas délivré et l’inscription resterait une impasse. À repasser à
>   `false` dès qu’un expéditeur du domaine est en place, avant toute
>   ouverture commerciale ;
> - `password_min_length` = **6** côté serveur alors que l’interface exige 8 :
>   l’écart reste à corriger (réglage non exposé par l’API de gestion) ;
> - origines de redirection autorisées : domaine Vercel, `localhost:3000`,
>   `localhost:5173` et `https://*.e2b.app` (aperçu de développement) ;
> - modèle d’e-mail encore en anglais, à traduire avant l’ouverture.
>
> La base est par ailleurs **vide** : 0 compte, 0 profil, 0 organisation,
> 0 fiche cliente, 0 liaison vérifiée. Aucun compte fictif, tenant ou commande
> n’a été créé pour simuler une réussite. Les 10 migrations sont appliquées et
> les fonctions `create_my_organization`, `create_order` et
> `transition_order_status` sont présentes, `security definer`, exécutables par
> `authenticated` ; le déclencheur `on_auth_user_created` crée bien le profil.

## Pages livrées

| URL | Page | Comportement réel |
|---|---|---|
| `/client/connexion` | Connexion client | `supabase.auth.signInWithPassword`, affichage/masquage du mot de passe, mode « Mot de passe oublié » avec `resetPasswordForEmail` |
| `/client/inscription` | Créer un compte client | nom, téléphone utilisé pour les dépôts, e-mail, mot de passe et confirmation, attestation du numéro de dépôt, puis `supabase.auth.signUp` |
| `/client/nouveau-mot-de-passe` | Nouveau mot de passe | formulaire `updateUser` si la session de récupération est présente ; message explicite et lien de nouvelle demande si le lien est absent, expiré ou déjà utilisé |
| `/client` | Mon espace | session requise, profil editable, pressings vérifiés, commandes et historique distant visibles par la cliente, actualisation manuelle et Realtime |
| `/espace-client/...` | Alias | mêmes pages avec normalisation vers les URLs canoniques `/client/...` |

L’application reste une SPA sans dépendance de routage supplémentaire :
`src/App.tsx` détecte les chemins `/client` et `/espace-client` avant de monter
l’ERP. L’espace client est donc volontairement **hors de `AppProvider`** et ne
charge ni la navigation métier ni les données locales/de démonstration du
poste du pressing.

`vercel.json` ajoute les réécritures nécessaires pour que l’accès direct ou le
rafraîchissement de `/client`, `/client/connexion`, `/client/inscription` et de
leurs alias serve la coquille de l’application en production.

## Points d’entrée visibles

- Le menu latéral de l’application métier contient un vrai lien
  **Espace client** vers `/client/connexion`.
- **Paramètres → Backend** contient également le lien **Ouvrir l’espace
  client**.
- Les pages publiques permettent de passer de Connexion à Inscription sans
  connaître l’URL.
- Un client déjà connecté qui ouvre Connexion ou Inscription est redirigé vers
  `/client` ; un visiteur non connecté qui ouvre `/client` est redirigé vers la
  connexion.

## Données transmises à l’inscription

Le formulaire envoie à Supabase Auth :

```json
{
  "full_name": "Nom saisi par la cliente",
  "phone_e164": "+2250700000301",
  "account_type": "customer"
}
```

Le numéro est normalisé dans `src/lib/customerAuth.ts`. Pour un numéro
ivoirien à dix chiffres, le zéro initial est conservé après l’indicatif :
`07 00 00 03 01` devient `+2250700000301`. Il s’agit du **téléphone utilisé
lors des dépôts**, car c’est ce repère qui permettra au pressing de retrouver
la bonne fiche cliente.

Le mot de passe demandé par l’interface comporte au moins huit caractères,
même si le réglage hébergé autorise encore six caractères. Le réglage serveur
devra être aligné avant l’ouverture commerciale.

### Profil serveur

Deux mécanismes cohérents alimentent `public.profiles` :

1. la migration `customer_registration_profile` fait lire `full_name`,
   `name`, `phone_e164` et `phone` par `private.handle_new_user()` ;
2. à la première session, le portail synchronise prudemment les métadonnées
   Auth vers le profil sans écraser une correction déjà faite dans Mon espace.

Le fichier local est
`supabase/migrations/20261028134000_customer_registration_profile.sql`.
La migration a été appliquée à Pressing_Pro sous la version distante
`20261028124739_customer_registration_profile`. Après application, les
contrôles donnent :

- fonction du déclencheur lisant bien `phone_e164` : vrai ;
- exécution par `anon` : refusée ;
- exécution directe par `authenticated` : refusée ;
- utilisateurs Auth : 0 ;
- profils : 0 ;
- liaisons client vérifiées : 0 ;
- commandes distantes : 0 ;
- Auth, base, REST et Realtime : `ACTIVE_HEALTHY`.

## Sécurité et accès aux commandes

L’inscription seule **ne donne aucun accès métier**. Elle crée uniquement un
compte Auth et un profil. Elle ne crée ni membership employé, ni organisation,
ni fiche cliente d’un pressing.

Les commandes ne deviennent visibles qu’après les deux conditions déjà
posées par le schéma Phase 0 :

1. le pressing contrôle le numéro déclaré auprès de la cliente ;
2. une ligne active `customer_account_links` relie le compte à la fiche
   `customers` du bon tenant, avec le numéro vérifié.

Le téléphone du profil est donc une coordonnée **déclarée**, jamais une
preuve. Mon espace explique honnêtement trois états :

- aucune liaison vérifiée : aucune commande n’est inventée et la cliente est
  invitée à présenter son téléphone au pressing ;
- compte relié mais aucune commande distante renvoyée par la RLS ;
- commandes visibles avec leurs étapes, montants distants, événements marqués
  `visibility='customer'` et état logistique séparé.

Les notes et événements internes ne sont pas demandés par le portail : la
requête filtre explicitement les événements destinés aux clients, en plus de
la RLS.

## Mon espace livré avec les pages d’accès

La connexion ne mène pas à une page vide. `/client` comprend :

- l’identité de session et la déconnexion Supabase ;
- la modification du nom et du téléphone de contact du profil ;
- l’e-mail confirmé ou « Non renseigné » ;
- les pressings effectivement reliés et vérifiés ;
- les commandes distantes autorisées par la RLS, triées par activité ;
- la progression Reçu → Lavage → Repassage → Prêt → Remis, ou l’annulation ;
- les articles et montants présents dans le snapshot distant ;
- l’historique des seuls événements visibles par les clients ;
- l’état séparé des ramassages/livraisons ;
- une actualisation manuelle et un abonnement Realtime aux commandes,
  événements et tournées.

Le portail ne contient ni bouton de fausse messagerie, ni demande
d’enlèvement simulée, ni paiement fictif. Ces parcours restent des chantiers
séparés.

## Configuration Auth relevée sur le projet hébergé

Relevé du 28 octobre 2026, après branchement de l’application sur
`phjstsydxvggtduohfrl` :

- e-mail/mot de passe activé ;
- téléphone/SMS désactivé ;
- **inscription publique ouverte** (`disable_signup=false`) ;
- **confirmation d’e-mail court-circuitée** (`mailer_autoconfirm=true`) —
  réglage **temporaire de test**, à refermer avant l’ouverture commerciale ;
- aucun SMTP personnalisé ;
- captcha désactivé ;
- longueur minimale serveur du mot de passe : 6 (l’interface exige 8) ;
- site : `https://laundrypressing.vercel.app` ;
- redirections autorisées : domaine de production, `localhost:3000`,
  `localhost:5173`, `https://*.e2b.app`.

Conséquence actuelle : **Créer un compte client** crée réellement le compte et
ouvre la session, puis mène à `/client`. Ce compte reste vide de toute commande
tant qu’une liaison `customer_account_links` n’a pas été vérifiée par un
pressing.

## Tests ajoutés

- `tests/unit/customerAuth.test.ts` : routes, titres, normalisation des
  numéros ivoiriens, validations des trois formulaires, métadonnées et
  traduction des erreurs Supabase.
- `supabase/tests/phase0/run-isolation-pglite.mjs` : insertion d’un nouvel
  utilisateur Auth fictif de test et contrôle que le déclencheur conserve le
  nom et le téléphone déclaré.
- `tests/e2e/smoke.spec.ts` : entrée « Espace client » depuis le menu,
  affichage de la connexion avec état non configuré honnête dans
  l’environnement E2E, navigation vers l’inscription et présence des champs.

Résultats locaux déjà obtenus :

- `npm run lint` : OK ;
- `npm run test:coverage` : 48 tests réussis ;
- `npm run test:phase0` : 29 vérifications réussies ;
- `npm run build` : OK ;
- `npx playwright test --list` : 7 tests compilés et listés.

Les assertions navigateur ne sont pas exécutées localement dans ce bac à
sable faute de Chromium ; elles doivent être confirmées par la CI GitHub
Actions avant de considérer le scénario navigateur comme passé.

## Ce qu’il reste avant ouverture publique

1. **Décision explicite d’ouverture** : passer `disable_signup` à `false`
   seulement lorsque le pilote est prêt.
2. **SMTP de production** : expéditeur du domaine, SPF/DKIM, modèles en
   français et délivrabilité testés ; le service d’e-mail intégré n’est pas
   adapté à un lancement commercial.
3. **Anti-abus** : activer un captcha compatible et vérifier les limites
   d’envoi/confirmations.
4. **Alignement mot de passe** : relever le minimum serveur à huit caractères
   ou plus et décider du contrôle des mots de passe compromis.
5. **Premier tenant réel** : organisation, agence, propriétaire et procédure
   de liaison vérifiée ; sans cela, un compte créé ne verra aucune commande.
6. **Recette Auth réelle** : inscription, e-mail de confirmation, connexion,
   mot de passe oublié, liaison par le pressing et suivi sur deux appareils.
7. **Notifications serveur** : e-mail/WhatsApp/SMS transactionnels via workers
   et outbox ; la page Mon espace ne remplace pas ces envois.

## Fichiers principaux

- `src/lib/customerAuth.ts`
- `src/lib/supabaseCustomer.ts`
- `src/components/customer/CustomerAuthLayout.tsx`
- `src/components/customer/CustomerLoginPage.tsx`
- `src/components/customer/CustomerRegisterPage.tsx`
- `src/components/customer/CustomerPasswordResetPage.tsx`
- `src/components/customer/CustomerAccountPage.tsx`
- `src/components/customer/CustomerPortalApp.tsx`
- `src/App.tsx`
- `supabase/migrations/20261028134000_customer_registration_profile.sql`
- `vercel.json`
