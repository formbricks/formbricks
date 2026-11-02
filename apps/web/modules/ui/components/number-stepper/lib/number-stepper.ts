// Pure helpers behind NumberStepper: bounds, decimal-safe stepping and typed-input parsing.

export interface TStepperBounds {
  min?: number;
  max?: number;
  step?: number;
}

const decimalsOf = (n: number): number => {
  const text = String(n);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
};

/** Rounds to the step's precision so 0.1 + 0.2 lands on 0.3, not 0.30000000000000004. */
const roundToPrecision = (value: number, step: number): number => {
  const factor = 10 ** decimalsOf(step);
  return Math.round(value * factor) / factor;
};

export const clamp = (value: number, { min, max }: TStepperBounds): number => {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
};

/** Moves `value` by `direction` steps (negative to decrease), clamped to the bounds. */
export const stepValue = (value: number, direction: number, bounds: TStepperBounds): number => {
  const step = bounds.step ?? 1;
  return clamp(roundToPrecision(value + direction * step, step), bounds);
};

const NUMERIC_CHARACTER = /[\d.+-]/;

/**
 * `text` without the unit it ends with: the trailing run of characters that can't be part of a number
 * (`/[^\d.+-]+$/`, walked from the end so it can't backtrack).
 */
const stripTrailingUnit = (text: string): string => {
  let end = text.length;
  while (end > 0 && !NUMERIC_CHARACTER.test(text[end - 1])) end -= 1;
  return text.slice(0, end);
};

/**
 * Parses what the user typed. Tolerates a trailing unit ("12px", "60 %") and a comma decimal
 * separator; returns null when nothing numeric is left, so the caller can revert.
 */
export const parseStepperInput = (raw: string): number | null => {
  const cleaned = stripTrailingUnit(raw.trim().replace(",", ".")).trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "+") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

/** Parses and clamps typed input, falling back to the current value when it isn't a number. */
export const commitStepperInput = (raw: string, current: number, bounds: TStepperBounds): number => {
  const parsed = parseStepperInput(raw);
  return parsed === null ? current : clamp(roundToPrecision(parsed, bounds.step ?? 1), bounds);
};

export const isAtMin = (value: number, { min }: TStepperBounds): boolean => min !== undefined && value <= min;
export const isAtMax = (value: number, { max }: TStepperBounds): boolean => max !== undefined && value >= max;
