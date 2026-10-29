import { describe, expect, it } from 'vitest';
import {
  cashRegisterNeedsRepair,
  createEmptyCashRegister,
  creditCashRegister,
  normalizeCashRegister,
} from '../../src/lib/cashRegister';
import { toFiniteNumber } from '../../src/lib/numbers';

const validRegister = {
  date: '2026-10-29',
  cashAmount: 12000,
  waveAmount: 3000,
  momoAmount: 2000,
  totalAmount: 17000,
  floatAmount: 5000,
  targetGoal: 100000,
  monthAchieved: 45000,
};

describe('normalizeCashRegister', () => {
  it('crée une caisse réelle vide sans NaN', () => {
    const empty = createEmptyCashRegister();
    expect(empty.totalAmount).toBe(0);
    expect(empty.cashAmount).toBe(0);
    expect(Number.isFinite(empty.totalAmount)).toBe(true);
  });

  it('recalcule un total absent à partir des encaissements', () => {
    const result = normalizeCashRegister({
      date: '2026-10-29',
      cashAmount: 1000,
      waveAmount: 500,
      momoAmount: 250,
      totalAmount: null,
    });
    expect(result.totalAmount).toBe(1750);
    expect(result.cashAmount).toBe(1000);
  });

  it('conserve une caisse locale valide si la section distante est vide', () => {
    expect(normalizeCashRegister({}, validRegister)).toEqual(validRegister);
  });

  it('normalise les anciennes valeurs nulles ou textuelles', () => {
    const result = normalizeCashRegister({
      date: '2026-10-29',
      cashAmount: '12000',
      waveAmount: null,
      momoAmount: undefined,
      totalAmount: '12000',
      floatAmount: null,
      targetGoal: undefined,
      monthAchieved: '45000',
    });
    expect(result).toMatchObject({
      cashAmount: 12000,
      waveAmount: 0,
      momoAmount: 0,
      totalAmount: 12000,
      floatAmount: 0,
      targetGoal: 0,
      monthAchieved: 45000,
    });
  });

  it('ne modifie pas une caisse complète et valide', () => {
    expect(normalizeCashRegister(validRegister)).toEqual(validRegister);
    expect(cashRegisterNeedsRepair(validRegister)).toBe(false);
  });

  it('détecte une caisse distante à réenregistrer', () => {
    expect(cashRegisterNeedsRepair({})).toBe(true);
    expect(cashRegisterNeedsRepair({ ...validRegister, totalAmount: null })).toBe(true);
    expect(cashRegisterNeedsRepair({ ...validRegister, cashAmount: '12000' })).toBe(true);
  });

  it('crédite une ancienne caisse corrompue sans recréer NaN', () => {
    const result = creditCashRegister(
      { ...validRegister, cashAmount: Number.NaN, totalAmount: Number.NaN },
      2500,
      'wave'
    );
    expect(result.cashAmount).toBe(0);
    expect(result.waveAmount).toBe(5500);
    expect(result.momoAmount).toBe(2000);
    expect(result.totalAmount).toBe(7500);
    expect(Number.isFinite(result.totalAmount)).toBe(true);
  });
});

describe('toFiniteNumber', () => {
  it('protège les sommes contre NaN, null et les valeurs absentes', () => {
    expect(toFiniteNumber(Number.NaN)).toBe(0);
    expect(toFiniteNumber(null)).toBe(0);
    expect(toFiniteNumber(undefined)).toBe(0);
    expect(toFiniteNumber('2500')).toBe(2500);
    expect(toFiniteNumber(1.5)).toBe(1.5);
  });
});
