import { describe, expect, test } from "vitest";
import { computeYAxis } from "./y-axis-scale";

const RATING_AVG = "FeedbackRecords.ratingAverage";
const CSAT_AVG = "FeedbackRecords.csatAverage";
const CES_AVG = "FeedbackRecords.cesAverage";
const NPS_AVG = "FeedbackRecords.npsAverage";
const COUNT = "FeedbackRecords.count";

describe("computeYAxis", () => {
  describe("fixed-scale measures pin the axis to the question scale (ENG-1796)", () => {
    test("rating average 3.33 on a 1-5 question renders a 0-5 axis, not a data-driven 0-4 one", () => {
      const scale = computeYAxis([{ [RATING_AVG]: 3.33 }], [RATING_AVG], true);
      expect(scale).toEqual({ domain: [0, 5], ticks: [0, 1, 2, 3, 4, 5] });
    });

    test("rating average above 7 pins to the 10 scale with even ticks", () => {
      const scale = computeYAxis([{ [RATING_AVG]: 8.2 }], [RATING_AVG], true);
      expect(scale).toEqual({ domain: [0, 10], ticks: [0, 2, 4, 6, 8, 10] });
    });

    test("rating average between 5 and 7 pins to the 7 scale (smallest standard scale containing the data)", () => {
      const scale = computeYAxis([{ [RATING_AVG]: 6.33 }], [RATING_AVG], true);
      expect(scale).toEqual({ domain: [0, 7], ticks: [0, 1, 2, 3, 4, 5, 6, 7] });
    });

    test("CSAT average always pins to its fixed 1-5 scale", () => {
      const scale = computeYAxis([{ [CSAT_AVG]: 2.4 }], [CSAT_AVG], true);
      expect(scale).toEqual({ domain: [0, 5], ticks: [0, 1, 2, 3, 4, 5] });
    });

    test("CES average pins to 5 or 7 depending on the data", () => {
      expect(computeYAxis([{ [CES_AVG]: 3 }], [CES_AVG], true)?.domain).toEqual([0, 5]);
      expect(computeYAxis([{ [CES_AVG]: 6.5 }], [CES_AVG], true)?.domain).toEqual([0, 7]);
    });

    test("NPS average pins to its fixed 0-10 scale", () => {
      const scale = computeYAxis([{ [NPS_AVG]: 6.33 }], [NPS_AVG], true);
      expect(scale).toEqual({ domain: [0, 10], ticks: [0, 2, 4, 6, 8, 10] });
    });

    test("pins across category rows using the series max", () => {
      const data = [{ [RATING_AVG]: 1.2 }, { [RATING_AVG]: 4.8 }, { [RATING_AVG]: 3.3 }];
      expect(computeYAxis(data, [RATING_AVG], true)?.domain).toEqual([0, 5]);
    });

    test("pins line/area charts (no zero baseline flag) to the full 0-based scale too", () => {
      const scale = computeYAxis([{ [RATING_AVG]: 3.33 }, { [RATING_AVG]: 4.1 }], [RATING_AVG], false);
      expect(scale?.domain).toEqual([0, 5]);
    });

    test("multi-measure charts of only fixed-scale measures pin to the largest needed scale", () => {
      const data = [{ [RATING_AVG]: 6.3, [CSAT_AVG]: 4 }];
      expect(computeYAxis(data, [RATING_AVG, CSAT_AVG], true)?.domain).toEqual([0, 7]);
    });

    test("a fixed-scale series with no values does not veto pinning by the other series", () => {
      const data = [{ [RATING_AVG]: 3.2, [CSAT_AVG]: null }];
      expect(computeYAxis(data, [RATING_AVG, CSAT_AVG], true)?.domain).toEqual([0, 5]);
    });
  });

  describe("falls back to data-driven nice scaling", () => {
    test("when the chart mixes fixed-scale and unbounded measures", () => {
      const data = [{ [RATING_AVG]: 3.33, [COUNT]: 77 }];
      const scale = computeYAxis(data, [RATING_AVG, COUNT], true);
      expect(scale).toEqual({ domain: [0, 80], ticks: [0, 20, 40, 60, 80] });
    });

    test("when data exceeds the largest known scale (defensive: never clip real data)", () => {
      const scale = computeYAxis([{ [RATING_AVG]: 12 }], [RATING_AVG], true);
      expect(scale?.domain[1]).toBeGreaterThanOrEqual(12);
    });

    test("when a fixed-scale series unexpectedly dips negative", () => {
      const scale = computeYAxis([{ [RATING_AVG]: -2 }, { [RATING_AVG]: 4 }], [RATING_AVG], false);
      expect(scale?.domain[0]).toBeLessThanOrEqual(-2);
    });

    test("for unbounded measures (unchanged behavior)", () => {
      const scale = computeYAxis([{ [COUNT]: 77 }], [COUNT], true);
      expect(scale).toEqual({ domain: [0, 80], ticks: [0, 20, 40, 60, 80] });
    });

    test("keeps decimal precision for small unbounded values", () => {
      const scale = computeYAxis([{ [COUNT]: 0.33 }], [COUNT], false);
      expect(scale?.ticks.every((tick) => Number.isFinite(tick))).toBe(true);
      expect(scale?.domain[1]).toBeGreaterThanOrEqual(0.33);
    });
  });

  describe("edge cases", () => {
    test("returns undefined for empty data or non-numeric values", () => {
      expect(computeYAxis([], [COUNT], true)).toBeUndefined();
      expect(computeYAxis([{ [COUNT]: null }, { [COUNT]: "" }], [COUNT], true)).toBeUndefined();
    });

    test("all-null fixed-scale data returns undefined instead of a pinned empty axis", () => {
      expect(computeYAxis([{ [RATING_AVG]: null }], [RATING_AVG], true)).toBeUndefined();
    });

    test("flat zero data still renders a usable axis", () => {
      const scale = computeYAxis([{ [COUNT]: 0 }], [COUNT], true);
      expect(scale?.domain[1]).toBeGreaterThan(0);
    });

    test("coerces numeric strings (Cube can return numbers as strings)", () => {
      const scale = computeYAxis([{ [RATING_AVG]: "3.33" }], [RATING_AVG], true);
      expect(scale?.domain).toEqual([0, 5]);
    });
  });
});
