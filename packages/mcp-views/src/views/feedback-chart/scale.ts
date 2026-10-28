/** Scales and tick values for the charts. Pure arithmetic: no DOM, no locale. */

export const linearScale = (
  [d0, d1]: readonly [number, number],
  [r0, r1]: readonly [number, number]
): ((value: number) => number) => {
  const span = d1 - d0;
  if (span === 0) return () => (r0 + r1) / 2;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
};

/** The 1, 2 or 5 times a power of ten nearest to `raw`: the step a reader counts in. */
export const niceStep = (raw: number): number => {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  let nice = 10;
  if (fraction < 1.5) nice = 1;
  else if (fraction < 3) nice = 2;
  else if (fraction < 7) nice = 5;
  return nice * magnitude;
};

const clean = (value: number): number => Number(value.toFixed(10));

export interface NiceTicks {
  ticks: number[];
  min: number;
  max: number;
  step: number;
}

/** Round bounds and evenly spaced ticks that contain [min, max]. About `target` ticks. */
export const niceTicks = (min: number, max: number, target = 5): NiceTicks => {
  let lo = min;
  let hi = max;
  if (lo === hi) {
    if (lo === 0) {
      hi = 1;
    } else {
      const pad = Math.abs(lo) * 0.1;
      lo -= pad;
      hi += pad;
    }
  }
  const step = niceStep((hi - lo) / Math.max(1, target - 1));
  const niceMin = clean(Math.floor(lo / step) * step);
  const niceMax = clean(Math.ceil(hi / step) * step);
  const ticks: number[] = [];
  for (let value = niceMin; value <= niceMax + step / 2; value += step) {
    ticks.push(clean(value));
  }
  return { ticks, min: niceMin, max: niceMax, step };
};

export interface YDomainInput {
  values: readonly number[];
  /** A bounded score's own range (NPS is -100 to 100); the axis stays on it instead of zooming in. */
  fixed?: readonly [number, number];
  target?: number;
}

/**
 * The y axis of a chart. Always includes zero: a bar's length and an area's height mean nothing from
 * another baseline, and a line that starts above zero exaggerates every change.
 */
export const resolveYAxis = ({ values, fixed, target = 5 }: YDomainInput): NiceTicks => {
  const finite = values.filter((value) => Number.isFinite(value));
  const dataMin = finite.length > 0 ? Math.min(...finite) : 0;
  const dataMax = finite.length > 0 ? Math.max(...finite) : 1;
  if (fixed && dataMin >= fixed[0] && dataMax <= fixed[1]) {
    // The axis is the score's own range, ticked from its lower bound: no rounding out past 100.
    const step = niceStep((fixed[1] - fixed[0]) / Math.max(1, target - 1));
    const ticks: number[] = [];
    for (let value = fixed[0]; value <= fixed[1] + step / 1000; value += step) ticks.push(clean(value));
    return { ticks, min: fixed[0], max: fixed[1], step };
  }
  const lo = fixed ? Math.min(fixed[0], dataMin) : Math.min(0, dataMin);
  const hi = fixed ? Math.max(fixed[1], dataMax) : Math.max(0, dataMax);
  return niceTicks(lo, hi, target);
};

/** Index of the position nearest to `x`; positions are ascending. */
export const nearestIndex = (positions: readonly number[], x: number): number => {
  if (positions.length === 0) return -1;
  let low = 0;
  let high = positions.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (positions[mid] < x) low = mid + 1;
    else high = mid;
  }
  if (low > 0 && Math.abs(positions[low - 1] - x) <= Math.abs(positions[low] - x)) return low - 1;
  return low;
};
