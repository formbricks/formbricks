import { getMeasureAxisMaxCandidates } from "@/modules/ee/analysis/lib/schema-definition";
import type { TChartDataRow } from "@/modules/ee/analysis/types/analysis";

const TARGET_TICK_COUNT = 5;
// Pinned scales prefer the finest step that still keeps the axis readable; a 0-7 CES axis
// labels every integer (8 ticks) rather than overshooting the scale to hit a "nice" bound.
const MAX_PINNED_TICK_COUNT = 8;

export interface YAxisScale {
  domain: [number, number];
  ticks: number[];
}

// Round a value to a "nice" number (1/2/5/10 × 10ⁿ) — the family of steps people
// expect on an axis. `round` snaps to the nearest nice number; otherwise it rounds
// up so the value fully contains the range.
const niceNum = (value: number, round: boolean): number => {
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * 10 ** exponent;
};

const collectNumericValues = (data: TChartDataRow[], keys: string[]): number[] => {
  const values: number[] = [];
  for (const row of data) {
    for (const key of keys) {
      const raw = row[key];
      if (raw === null || raw === undefined || raw === "") continue;
      const num = Number(raw);
      if (Number.isFinite(num)) values.push(num);
    }
  }
  return values;
};

/**
 * Axis max for charts whose every series is a fixed-scale measure (rating/CSAT/CES/NPS
 * averages): the largest of each series' smallest scale candidate that contains its data,
 * so a 3.33 average on a 1-5 rating pins the axis to 5 instead of a data-driven 4 (ENG-1796).
 * Returns undefined — falling back to nice scaling — when any series is not scale-pinned,
 * dips negative, or exceeds its largest known scale.
 */
const computePinnedAxisMax = (data: TChartDataRow[], dataKeys: string[]): number | undefined => {
  let pinnedMax = 0;
  for (const key of dataKeys) {
    const candidates = getMeasureAxisMaxCandidates(key);
    if (!candidates || candidates.length === 0) return undefined;
    const values = collectNumericValues(data, [key]);
    if (values.length === 0) continue;
    if (Math.min(...values) < 0) return undefined;
    const keyMax = Math.max(...values);
    const candidate = candidates.find((c) => c >= keyMax);
    if (candidate === undefined) return undefined;
    pinnedMax = Math.max(pinnedMax, candidate);
  }
  return pinnedMax > 0 ? pinnedMax : undefined;
};

// Integer ticks for a pinned [0, max] scale: the smallest 1/2/5×10ⁿ step that divides the
// scale evenly without exceeding MAX_PINNED_TICK_COUNT ticks, so every gridline lands on a
// value of the scale and the top tick is exactly the scale max (never overshoots it).
const computePinnedTicks = (max: number): number[] => {
  for (let exponent = 0; 10 ** exponent <= max; exponent++) {
    for (const base of [1, 2, 5]) {
      const step = base * 10 ** exponent;
      if (max % step === 0 && max / step + 1 <= MAX_PINNED_TICK_COUNT) {
        const ticks: number[] = [];
        for (let tick = 0; tick <= max; tick += step) ticks.push(tick);
        return ticks;
      }
    }
  }
  return [0, max];
};

export const computeYAxis = (
  data: TChartDataRow[],
  dataKeys: string[],
  zeroBaseline: boolean
): YAxisScale | undefined => {
  const values = collectNumericValues(data, dataKeys);
  if (values.length === 0) return undefined;

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);

  // Fixed-scale measures (rating/CSAT/CES/NPS averages) render against the question's full
  // scale — 0 up to the pinned max — regardless of chart type, so bar heights and line
  // positions read as "3.33 out of 5" rather than being stretched to a data-driven bound.
  const pinnedMax = computePinnedAxisMax(data, dataKeys);
  if (pinnedMax !== undefined) {
    return { domain: [0, pinnedMax], ticks: computePinnedTicks(pinnedMax) };
  }

  // Baseline: bars and all-positive series sit on 0; only dip below zero when the
  // data genuinely does, so we never draw a phantom negative axis (e.g. a -4 floor
  // under a metric that bottoms out at 0).
  const baselineLow = zeroBaseline ? Math.min(0, dataMin) : dataMin;
  // Flat data has no range to scale, so give it a unit of headroom to render ticks.
  const spanHigh = dataMax === baselineLow ? baselineLow + 1 : dataMax;

  // Snap the axis to nice bounds and derive evenly spaced round ticks, so every
  // gridline lands on a labelled value. (Recharts' auto-ticks are computed from a
  // raw domain and can fall outside it, drawing extra gridlines with no label.)
  const step = niceNum(niceNum(spanHigh - baselineLow, false) / (TARGET_TICK_COUNT - 1), true);
  const niceMin = Math.floor(baselineLow / step) * step;
  const niceMax = Math.ceil(spanHigh / step) * step;

  // Clean up floating-point noise that decimal steps introduce (e.g. 0.30000000004).
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const round = (n: number) => Number(n.toFixed(decimals));

  const ticks: number[] = [];
  for (let tick = niceMin; tick <= niceMax + step / 2; tick += step) {
    ticks.push(round(tick));
  }

  return { domain: [round(niceMin), round(niceMax)], ticks };
};
