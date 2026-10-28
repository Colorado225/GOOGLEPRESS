# Socle Supabase — Phase 0 Option B

Ce dossier contient la fondation PostgreSQL/Supabase v1 construite depuis
l’application actuelle.

## Avertissement

**Ne pas appliquer ces migrations à Pressing_Pro sans décision séparée.**
Pressing_Pro contient un héritage désynchronisé inventorié en lecture seule.
Le nouveau socle doit d’abord être rejoué dans un environnement Supabase
propre de validation.

Documentation complète :

- `docs/backend/phase-0/01-inventaire-et-porte-de-decision.md`
- `docs/backend/phase-0/02-socle-option-b-et-validation-locale.md`
- `docs/PLAN-BACKEND.md`

## Contenu

- `migrations/` : quatre migrations SQL versionnées, à appliquer dans l’ordre
  de leurs préfixes de date.
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
SQL. Il ne remplace pas une répétition dans un vrai projet Supabase avec Auth,
PostgREST, Realtime, Storage et les advisors.

## État

- Aucune migration de ce dossier n’a été appliquée à Pressing_Pro.
- Aucun secret et aucune donnée réelle ne doivent être ajoutés ici.
- Le front n’utilise pas encore ce socle.
