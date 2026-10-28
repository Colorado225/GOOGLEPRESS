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

## Validation locale

Depuis la racine du dépôt :

```bash
npm install
npm run test:phase0
```

Résultat attendu au 28 octobre 2026 : 19 vérifications réussies.

Le harnais émule uniquement les rôles et `auth.uid()` nécessaires aux règles
SQL. Il ne remplace pas les tests Auth/PostgREST avec de vrais jetons, les
advisors Supabase ni les validations Realtime/Storage, qui restent à effectuer.

## État au 28 octobre 2026

- Pressing_Pro contient 37 tables vides, RLS activée et forcée, et 89
  politiques.
- Aucun utilisateur Auth, tenant, client ou commande n’a été créé.
- Les fixtures fictives n’ont pas été chargées dans Pressing_Pro.
- L’inscription publique est désactivée et Auth pointe temporairement vers
  `http://localhost:3000`.
- Le front n’utilise pas encore ce socle.
- Deux anciennes enveloppes Edge ont été neutralisées par HTTP 410, mais leur
  suppression physique reste à confirmer par une liste vide.
- Aucun secret et aucune donnée réelle ne doivent être ajoutés ici.
