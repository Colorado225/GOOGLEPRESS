import { describe, expect, it } from 'vitest';
import {
  isUniqueViolation,
  rowLevelSecurityError,
  updateOrInsert,
} from '../../src/lib/supabaseWrite';

const queue = <T>(results: { data: T | null; error?: unknown }[]) => {
  const list = [...results];
  return () => {
    const next = list.shift() ?? { data: null, error: null };
    return Promise.resolve({ data: next.data, error: next.error ?? null });
  };
};

describe('updateOrInsert', () => {
  it('s’arrête à la mise à jour quand la ligne existe', async () => {
    let inserts = 0;
    const outcome = await updateOrInsert({
      update: queue([{ data: { id: 'row-1' } }]),
      insert: () => {
        inserts += 1;
        return Promise.resolve({ data: null, error: null });
      },
    });

    expect(outcome).toEqual({ ok: true, row: { id: 'row-1' } });
    expect(inserts).toBe(0);
  });

  it('crée la ligne quand aucune n’a été touchée', async () => {
    const outcome = await updateOrInsert<{ id: string }>({
      update: queue([{ data: null }]),
      insert: queue([{ data: { id: 'new-row' } }]),
    });

    expect(outcome).toEqual({ ok: true, row: { id: 'new-row' } });
  });

  it('retente la mise à jour quand la création bute sur une clé existante', async () => {
    const update = queue([{ data: null }, { data: { id: 'hidden-row' } }]);
    const outcome = await updateOrInsert<{ id: string }>({
      update,
      insert: queue([{ data: null, error: { code: '23505', message: 'duplicate key value' } }]),
    });

    expect(outcome).toEqual({ ok: true, row: { id: 'hidden-row' } });
  });

  it('signale un refus de rôle plutôt qu’un faux succès', async () => {
    const outcome = await updateOrInsert({
      update: queue([{ data: null }]),
      insert: queue([{ data: null, error: { code: '23505', message: 'duplicate key value' } }]),
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toEqual(rowLevelSecurityError());
  });

  it('remonte l’erreur de mise à jour sans tenter de création', async () => {
    let inserts = 0;
    const outcome = await updateOrInsert({
      update: queue([{ data: null, error: { code: '42501', message: 'permission denied' } }]),
      insert: () => {
        inserts += 1;
        return Promise.resolve({ data: null, error: null });
      },
    });

    expect(outcome.ok).toBe(false);
    expect(inserts).toBe(0);
  });
});

describe('isUniqueViolation', () => {
  it('reconnaît un conflit de clé et rien d’autre', () => {
    expect(isUniqueViolation({ code: '23505', message: 'duplicate key value' })).toBe(true);
    expect(isUniqueViolation({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isUniqueViolation(new Error('unique constraint violated'))).toBe(true);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
