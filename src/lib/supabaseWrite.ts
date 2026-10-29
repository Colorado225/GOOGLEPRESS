/**
 * Écriture « mise à jour, sinon création » compatible avec les droits par
 * colonne de Supabase.
 *
 * PostgREST traduit `upsert(...)` en `insert … on conflict do update set` sur
 * **toutes** les colonnes envoyées. Les tables de ce projet n'accordent que des
 * droits de mise à jour par colonne, volontairement sans les colonnes
 * d'identité (`shop_id`, `user_id`, `organization_id`). Un upsert échoue donc
 * avec « permission denied » même quand l'utilisateur a parfaitement le droit
 * d'enregistrer ses données — constaté en production sur `shop_settings` et
 * `profiles`.
 *
 * Ce module fait la même chose sans conflit : mise à jour ciblée, création
 * seulement si aucune ligne n'a été touchée, nouvelle tentative si la création
 * bute sur une clé déjà présente (ligne existante mais invisible pour la RLS).
 */

export interface WriteQueryResult<T> {
  data: T | null;
  error: unknown;
}

export interface WriteSteps<T> {
  /** Mise à jour de la ligne existante (sans colonnes d'identité). */
  update: () => PromiseLike<WriteQueryResult<T>>;
  /** Création, avec les colonnes d'identité. */
  insert: () => PromiseLike<WriteQueryResult<T>>;
}

export type WriteOutcome<T> = { ok: true; row: T } | { ok: false; error: unknown };

const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';

const errorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return '';
};

export const isUniqueViolation = (error: unknown): boolean =>
  errorCode(error) === '23505' || /duplicate key|unique constraint/i.test(errorMessage(error));

/** La ligne existe mais reste invisible : refus de rôle, pas absence. */
export const rowLevelSecurityError = () => ({
  code: '42501',
  message: 'row-level security : aucune ligne modifiable pour ce compte',
});

export const updateOrInsert = async <T>(steps: WriteSteps<T>): Promise<WriteOutcome<T>> => {
  const first = await steps.update();
  if (first.error) return { ok: false, error: first.error };
  if (first.data) return { ok: true, row: first.data };

  const inserted = await steps.insert();
  if (!inserted.error) {
    return inserted.data ? { ok: true, row: inserted.data } : { ok: false, error: rowLevelSecurityError() };
  }
  if (!isUniqueViolation(inserted.error)) return { ok: false, error: inserted.error };

  const retried = await steps.update();
  if (retried.error) return { ok: false, error: retried.error };
  return retried.data ? { ok: true, row: retried.data } : { ok: false, error: rowLevelSecurityError() };
};
