import type { CashRegisterData } from '../types';
import { todayISO } from './dates';
import { toNonNegativeNumber } from './numbers';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const amount = toNonNegativeNumber(value, Number.NaN);
  return Number.isFinite(amount) ? amount : null;
};

export const createEmptyCashRegister = (): CashRegisterData => ({
  date: todayISO(),
  cashAmount: 0,
  waveAmount: 0,
  momoAmount: 0,
  totalAmount: 0,
  floatAmount: 0,
  targetGoal: 0,
  monthAchieved: 0,
});

/**
 * Répare les caisses historiques incomplètes sans écraser les montants valides.
 * Si le total manque alors que des encaissements sont présents, il est recalculé.
 * Un objet distant vide conserve la dernière caisse locale valide.
 */
export const normalizeCashRegister = (
  value: unknown,
  fallback?: unknown
): CashRegisterData => {
  const source = isRecord(value) ? value : {};
  const base = isRecord(fallback) ? fallback : {};
  const empty = createEmptyCashRegister();

  const cashAmount = toNonNegativeNumber(
    source.cashAmount,
    toNonNegativeNumber(base.cashAmount, 0)
  );
  const waveAmount = toNonNegativeNumber(
    source.waveAmount,
    toNonNegativeNumber(base.waveAmount, 0)
  );
  const momoAmount = toNonNegativeNumber(
    source.momoAmount,
    toNonNegativeNumber(base.momoAmount, 0)
  );

  const sourceTotal = optionalAmount(source.totalAmount);
  const baseTotal = optionalAmount(base.totalAmount);
  const hasPaymentDetail =
    optionalAmount(source.cashAmount) !== null ||
    optionalAmount(source.waveAmount) !== null ||
    optionalAmount(source.momoAmount) !== null;
  const totalAmount =
    sourceTotal ??
    (hasPaymentDetail
      ? cashAmount + waveAmount + momoAmount
      : (baseTotal ?? cashAmount + waveAmount + momoAmount));

  return {
    date:
      typeof source.date === 'string' && source.date.trim()
        ? source.date
        : typeof base.date === 'string' && base.date.trim()
          ? base.date
          : empty.date,
    cashAmount,
    waveAmount,
    momoAmount,
    totalAmount,
    floatAmount: toNonNegativeNumber(
      source.floatAmount,
      toNonNegativeNumber(base.floatAmount, 0)
    ),
    targetGoal: toNonNegativeNumber(
      source.targetGoal,
      toNonNegativeNumber(base.targetGoal, 0)
    ),
    monthAchieved: toNonNegativeNumber(
      source.monthAchieved,
      toNonNegativeNumber(base.monthAchieved, 0)
    ),
  };
};

/** Crédite la caisse en réparant d'abord les anciennes valeurs invalides. */
export const creditCashRegister = (
  register: unknown,
  amount: number,
  method: string
): CashRegisterData => {
  const current = normalizeCashRegister(register);
  const payment = toNonNegativeNumber(amount, 0);
  return {
    ...current,
    cashAmount: current.cashAmount + (method === 'especes' ? payment : 0),
    waveAmount: current.waveAmount + (method === 'wave' ? payment : 0),
    momoAmount:
      current.momoAmount + (method === 'momo' || method === 'om' ? payment : 0),
    totalAmount: current.totalAmount + payment,
  };
};

/** Vrai si la caisse distante doit être réenregistrée sous sa forme complète. */
export const cashRegisterNeedsRepair = (value: unknown): boolean => {
  if (!isRecord(value) || typeof value.date !== 'string' || !value.date.trim()) return true;
  return [
    'cashAmount',
    'waveAmount',
    'momoAmount',
    'totalAmount',
    'floatAmount',
    'targetGoal',
    'monthAchieved',
  ].some((field) => {
    const amount = value[field];
    return typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0;
  });
};
