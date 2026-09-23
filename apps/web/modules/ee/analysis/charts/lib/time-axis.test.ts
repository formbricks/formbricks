import { describe, expect, test, vi } from "vitest";
import {
  formatTimeBucket,
  getTimeAxisTickLabels,
  getTimeAxisTickLayout,
  getTimeGranularityFromKey,
} from "./time-axis";

// ICU puts a narrow no-break space before AM/PM; compare on plain spaces.
const plain = (value: string | null) => value?.replaceAll(/\s/g, " ") ?? null;

const hourly = (day: string, hours: number[]) =>
  hours.map((hour) => `${day}T${String(hour).padStart(2, "0")}:00:00.000`);

describe("getTimeGranularityFromKey", () => {
  test("reads the granularity suffix of a Cube time column", () => {
    expect(getTimeGranularityFromKey("FeedbackRecords.collectedAt.hour")).toBe("hour");
    expect(getTimeGranularityFromKey("FeedbackRecords.collectedAt.week")).toBe("week");
  });

  test("returns undefined for a column that is not bucketed", () => {
    expect(getTimeGranularityFromKey("FeedbackRecords.collectedAt")).toBeUndefined();
    expect(getTimeGranularityFromKey("FeedbackRecords.sentiment")).toBeUndefined();
  });
});

describe("formatTimeBucket", () => {
  test("keeps the time of an hourly bucket", () => {
    expect(plain(formatTimeBucket("2026-09-14T13:00:00.000", "hour", "en-US"))).toBe("Sep 14, 2026, 1:00 PM");
  });

  test("keeps the wall clock Cube returned instead of shifting it to another zone", () => {
    expect(plain(formatTimeBucket("2026-09-14T23:00:00.000", "hour", "en-US"))).toBe(
      "Sep 14, 2026, 11:00 PM"
    );
  });

  test("keeps an hour that falls in the viewer's daylight-saving gap", () => {
    // 2:00 AM does not exist in New York on Mar 8, 2026; local parsing would print 3:00 AM.
    vi.stubEnv("TZ", "America/New_York");
    try {
      expect(plain(formatTimeBucket("2026-03-08T02:00:00.000", "hour", "en-US"))).toBe(
        "Mar 8, 2026, 2:00 AM"
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("formats coarser buckets without a time", () => {
    expect(formatTimeBucket("2026-09-14T00:00:00.000", "day", "en-US")).toBe("Sep 14, 2026");
    expect(formatTimeBucket("2026-09-01T00:00:00.000", "month", "en-US")).toBe("Sep 2026");
    expect(formatTimeBucket("2026-01-01T00:00:00.000", "year", "en-US")).toBe("2026");
  });

  test("follows the locale it is given", () => {
    expect(formatTimeBucket("2026-09-14T13:00:00.000", "hour", "de-DE")).toContain("13:00");
  });

  test("passes a value that is not a time bucket through", () => {
    expect(formatTimeBucket("not a date", "hour", "en-US")).toBe("not a date");
    expect(formatTimeBucket(null, "hour", "en-US")).toBe("");
  });
});

describe("getTimeAxisTickLayout", () => {
  test("labels every bucket when each has enough room", () => {
    expect(getTimeAxisTickLayout(6, 600, true)).toEqual({ step: 1, first: 0, last: 5, slotWidth: 100 });
  });

  test("thins a dense hourly axis so each label gets the minimum width", () => {
    // 72 hourly buckets across 700px: ~9.9px each, so a label every 8 buckets (~79px).
    const layout = getTimeAxisTickLayout(72, 700, true);
    expect(layout.step).toBe(8);
    expect(layout.slotWidth).toBeGreaterThanOrEqual(72);
  });

  test("keeps the first and last label's half-slot inside the plot", () => {
    for (const pointScale of [true, false]) {
      const count = 72;
      const width = 700;
      const layout = getTimeAxisTickLayout(count, width, pointScale);
      const bucket = pointScale ? width / (count - 1) : width / count;
      const inset = pointScale ? 0 : bucket / 2;
      expect(layout.first * bucket + inset).toBeGreaterThanOrEqual(layout.slotWidth / 2);
      expect((count - 1 - layout.last) * bucket + inset).toBeGreaterThanOrEqual(layout.slotWidth / 2);
      expect((layout.last - layout.first) % layout.step).toBe(0);
    }
  });

  test("keeps the only label inside the plot when no bucket has a full slot", () => {
    // Two band buckets across 100px: each is 50px, too narrow for either to hold a 72px slot.
    expect(getTimeAxisTickLayout(2, 100, false)).toEqual({ step: 2, first: 0, last: 0, slotWidth: 50 });
  });

  test("labels every bucket when there is at most one or no width to measure", () => {
    expect(getTimeAxisTickLayout(1, 500, true).step).toBe(1);
    expect(getTimeAxisTickLayout(24, 0, true).step).toBe(1);
  });
});

describe("getTimeAxisTickLabels", () => {
  const everyBucket = (count: number) => ({ step: 1, first: 0, last: count - 1, slotWidth: 100 });

  test("hourly labels show the time and carry the date only where the day turns over", () => {
    const values = [...hourly("2026-09-14", [22, 23]), ...hourly("2026-09-15", [0, 1])];
    expect(getTimeAxisTickLabels(values, "hour", "en-US", everyBucket(4)).map(plain)).toEqual([
      "Sep 14, 10:00 PM",
      "11:00 PM",
      "Sep 15, 12:00 AM",
      "1:00 AM",
    ]);
  });

  test("no two hourly ticks of a thinned axis read the same", () => {
    const values = [
      ...hourly("2026-09-14", [...Array(24).keys()]),
      ...hourly("2026-09-15", [...Array(24).keys()]),
    ];
    const layout = getTimeAxisTickLayout(values.length, 500, true);
    const shown = getTimeAxisTickLabels(values, "hour", "en-US", layout).filter((label) => label !== null);
    expect(layout.step).toBeGreaterThan(1);
    expect(new Set(shown).size).toBe(shown.length);
  });

  test("leaves the buckets the layout skips unlabelled", () => {
    const values = hourly("2026-09-14", [0, 1, 2, 3, 4, 5, 6]);
    const labels = getTimeAxisTickLabels(values, "hour", "en-US", {
      step: 3,
      first: 1,
      last: 4,
      slotWidth: 90,
    });
    expect(labels.map((label) => label !== null)).toEqual([false, true, false, false, true, false, false]);
  });

  test("daily labels drop the year until it changes", () => {
    const values = ["2025-12-31T00:00:00.000", "2026-01-01T00:00:00.000", "2026-01-02T00:00:00.000"];
    expect(getTimeAxisTickLabels(values, "day", "en-US", everyBucket(3))).toEqual([
      "Dec 31, 2025",
      "Jan 1, 2026",
      "Jan 2",
    ]);
  });
});
