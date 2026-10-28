import { describe, expect, it } from 'vitest';
import {
  addDaysToISO,
  formatDateTime,
  formatISODateFr,
  formatPromised,
  getPromisedDate,
  isValidISODate,
  parseISODate,
  parseStoredDateTime,
  toISODate,
} from '../../src/lib/dates';

describe('dates', () => {
  it('formate et relit le format historique JJ/MM/AAAA HH:mm', () => {
    const date = new Date(2026, 9, 28, 9, 5);
    expect(formatDateTime(date)).toBe('28/10/2026 09:05');

    const parsed = parseStoredDateTime('28/10/2026 09:05');
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(9);
    expect(parsed?.getDate()).toBe(28);
    expect(parsed?.getHours()).toBe(9);
    expect(parsed?.getMinutes()).toBe(5);
    expect(parseStoredDateTime('')).toBeNull();
    expect(parseStoredDateTime('date illisible')).toBeNull();
  });

  it('applique les délais promis express, standard et différé', () => {
    const wednesday = new Date(2026, 9, 28, 15, 30);

    expect(toISODate(getPromisedDate('express', wednesday))).toBe('2026-10-29');
    expect(getPromisedDate('express', wednesday).getHours()).toBe(12);
    expect(toISODate(getPromisedDate('standard', wednesday))).toBe('2026-10-30');
    expect(getPromisedDate('standard', wednesday).getHours()).toBe(17);
    expect(toISODate(getPromisedDate('delayed', wednesday))).toBe('2026-10-31');
    expect(getPromisedDate('delayed', wednesday).getHours()).toBe(10);

    const saturday = new Date(2026, 9, 31, 8, 0);
    expect(toISODate(getPromisedDate('delayed', saturday))).toBe('2026-11-07');
  });

  it('gère les dates ISO sans décalage de fuseau', () => {
    expect(addDaysToISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToISO('2026-03-01', -1)).toBe('2026-02-28');
    expect(parseISODate('2026-10-28')?.getHours()).toBe(12);
    expect(isValidISODate('2026-10-28')).toBe(true);
    expect(isValidISODate('28/10/2026')).toBe(false);
    expect(formatISODateFr('inconnu')).toBe('Non renseigné');
  });

  it('libelle aujourd’hui et demain par rapport à une référence explicite', () => {
    const from = new Date(2026, 9, 28, 8, 0);
    expect(formatPromised(new Date(2026, 9, 28, 17, 0), from)).toBe('Aujourd’hui • 17h');
    expect(formatPromised(new Date(2026, 9, 29, 12, 0), from)).toBe('Demain • 12h');
  });
});
