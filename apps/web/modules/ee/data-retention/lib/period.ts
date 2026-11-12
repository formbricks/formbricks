/**
 * Retention periods are stored and sent over the API in whole days (ENG-3697). This is the one place a
 * number + unit converts to and from days, so the UI, the emails and the API agree on what "3 years"
 * means. A year is 365 days and a month 30: a deletion can land a day or two off a calendar anniversary,
 * which was accepted in exchange for one unit in storage.
 *
 * An amount may be a decimal (ENG-7038): "2.5 years" is stored as the nearest whole day, 913.
 */
export const RETENTION_DAYS_PER_UNIT = {
  days: 1,
  months: 30,
  years: 365,
} as const;

export type TRetentionPeriodUnit = keyof typeof RETENTION_DAYS_PER_UNIT;

export type TRetentionPeriod = {
  amount: number;
  unit: TRetentionPeriodUnit;
};

const assertPositiveInteger = (value: number, label: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive whole number, got ${value}`);
  }
};

/** The nearest whole day to `amount` units; 0 when the amount is under half a day. */
export const retentionPeriodToDays = ({ amount, unit }: TRetentionPeriod): number => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RangeError(`Retention period amount must be a positive number, got ${amount}`);
  }
  return Math.round(amount * RETENTION_DAYS_PER_UNIT[unit]);
};

/**
 * The largest unit that divides `days` exactly, so a period round-trips through storage: "3 years" →
 * 1095 → "3 years". Day counts that are a whole number of both years and months (every 2190 days)
 * come back in years: "73 months" is stored as 2190 days and shown as "6 years", the same period.
 *
 * A day count no unit divides reads in years to two decimals from a year up ("2.5 years" for 913 days),
 * and in days below that. Two decimals of a year is up to two days off, so the years are for reading
 * only: converting them back can give a different day count (403 days → "1.1 years" → 402 days).
 */
export const daysToRetentionPeriod = (days: number): TRetentionPeriod => {
  assertPositiveInteger(days, "Retention period in days");

  if (days % RETENTION_DAYS_PER_UNIT.years === 0) {
    return { amount: days / RETENTION_DAYS_PER_UNIT.years, unit: "years" };
  }
  if (days % RETENTION_DAYS_PER_UNIT.months === 0) {
    return { amount: days / RETENTION_DAYS_PER_UNIT.months, unit: "months" };
  }
  if (days > RETENTION_DAYS_PER_UNIT.years) {
    return { amount: Math.round((days / RETENTION_DAYS_PER_UNIT.years) * 100) / 100, unit: "years" };
  }
  return { amount: days, unit: "days" };
};
