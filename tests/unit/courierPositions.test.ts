import { describe, expect, it } from 'vitest';
import {
  normalizeCourierPositions,
  pruneCourierPositions,
  shouldRecordPosition,
  type CourierPosition,
} from '../../src/lib/courierPositions';

const position = (overrides: Partial<CourierPosition> = {}): CourierPosition => ({
  taskId: 'task-1',
  lat: 5.36,
  lng: -4.0083,
  accuracyM: 20,
  source: 'device',
  recordedAt: '2026-10-28T10:00:00.000Z',
  ...overrides,
});

describe('courierPositions — stockage local', () => {
  it('relit les positions valides et écarte le reste', () => {
    expect(normalizeCourierPositions(null)).toEqual({});
    expect(normalizeCourierPositions([])).toEqual({});
    expect(normalizeCourierPositions('invalide')).toEqual({});

    const positions = normalizeCourierPositions({
      'task-1': position(),
      'task-2': { ...position(), recordedAt: 'invalide' },
      'task-3': { ...position(), lat: 500 },
    });
    expect(Object.keys(positions)).toEqual(['task-1']);
    expect(positions['task-1']?.taskId).toBe('task-1');
  });

  it('purge les positions plus anciennes que la rétention', () => {
    const now = new Date('2026-10-28T10:00:00.000Z');
    const kept = pruneCourierPositions(
      {
        recent: position({ taskId: 'recent', recordedAt: '2026-10-27T09:00:00.000Z' }),
        old: position({ taskId: 'old', recordedAt: '2026-10-01T09:00:00.000Z' }),
        broken: position({ taskId: 'broken', recordedAt: 'hier' }),
      },
      now
    );
    expect(Object.keys(kept)).toEqual(['recent']);
  });
});

describe('courierPositions — fréquence d’enregistrement', () => {
  it('accepte la première position', () => {
    expect(shouldRecordPosition(undefined, position())).toBe(true);
  });

  it('ignore une mesure trop rapprochée dans le temps et dans l’espace', () => {
    const previous = position();
    expect(
      shouldRecordPosition(previous, { lat: 5.36001, lng: -4.0083, recordedAt: '2026-10-28T10:00:10.000Z' })
    ).toBe(false);
  });

  it('accepte après l’intervalle minimal même sans mouvement', () => {
    expect(
      shouldRecordPosition(position(), {
        lat: 5.36,
        lng: -4.0083,
        recordedAt: '2026-10-28T10:01:00.000Z',
      })
    ).toBe(true);
  });

  it('accepte un vrai déplacement avant l’intervalle', () => {
    // ~150 m vers le nord en 10 s.
    expect(
      shouldRecordPosition(position(), {
        lat: 5.3614,
        lng: -4.0083,
        recordedAt: '2026-10-28T10:00:10.000Z',
      })
    ).toBe(true);
  });
});
