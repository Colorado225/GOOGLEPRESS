# Socle Supabase — Phase 0 Option B

Ce dossier contient la fondation PostgreSQL/Supabase v1 construite depuis
l’application actuelle et installée dans Pressing_Pro le 28 octobre 2026.

## Avertissement

**Ces quatre migrations ont déjà été appliquées à Pressing_Pro après la
purge explicitement autorisée de son héritage.** Ne les réappliquez pas
manuellement et ne les modifiez pas après coup : tout changement doit passer
par une nouvelle migration versionnée.

Pressing_Pro contient désormais uniquement le socle Phase 0 vide. Le détail
des opérations, versions distantes et contrôles catalogue est dans le rapport
d’installation.

Documentation complète :

- `docs/backend/phase-0/01-inventaire-et-porte-de-decision.md`
- `docs/backend/phase-0/02-socle-option-b-et-validation-locale.md`
- `docs/backend/phase-0/03-purge-pressing-pro-et-installation.md`
- `docs/backend/phase-0/04-branchement-progressif-et-domaine.md`
- `docs/PLAN-BACKEND.md`

## Contenu

- `migrations/` : quatre migrations SQL versionnées, déjà appliquées dans
  l’ordre à Pressing_Pro.
- `operations/2026-10-28_pressingpro_legacy_cleanup.sql` : historique du SQL
  ponctuel de purge de Pressing_Pro. **Ne pas rejouer.**
- `tests/phase0/fixtures.sql` : deux organisations et trois agences
  entièrement fictives, réservées à un environnement jetable.
- `tests/phase0/run-isolation-pglite.mjs` : application locale des migrations
  et vérifications RLS/métier avec PostgreSQL en mémoire (PGlite).
- `../scripts/generate-supabase-types.mjs` : génération de
  `src/lib/database.types.ts` depuis le schéma local des migrations.
- `../scripts/test-supabase-rest.mjs` : test Auth/PostgREST réel avec des
  comptes de validation fournis par variables d’environnement.

## Validation locale

Depuis la racine du dépôt :

```bash
npm install
npm run test:phase0
npm run gen:supabase-types
```

Résultat attendu au 28 octobre 2026 : 19 vérifications PGlite réussies et
37 tables typées.

Un test hébergé avec `request.jwt.claims` a confirmé l’isolation dans une
transaction annulée. Le parcours HTTP complet se lance avec
`npm run test:supabase-rest` lorsque des comptes de validation réels sont
fournis par variables d’environnement. Les validations Realtime/Storage et
les optimisations d’index relevées restent à effectuer.

## État au 28 octobre 2026

- Pressing_Pro contient 37 tables vides, RLS activée et forcée, et 89
  politiques.
- Aucun utilisateur Auth, tenant, client ou commande n’a été créé.
- Les fixtures fictives n’ont pas été chargées dans Pressing_Pro.
- L’inscription publique est désactivée ; Auth accepte
  `https://laundrypressing.vercel.app` et `http://localhost:3000`.
- Les Edge Functions héritées sont physiquement supprimées ; la liste
  distante est vide.
- Le front contient un premier client Supabase optionnel et l’onglet
  Paramètres → Backend Supabase ; les données métier restent locales.
- Aucun secret et aucune donnée réelle ne doivent être ajoutés ici.
