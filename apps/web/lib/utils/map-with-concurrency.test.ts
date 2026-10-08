import { describe, expect, test } from "vitest";
import { mapWithConcurrency } from "./map-with-concurrency";

describe("mapWithConcurrency", () => {
  test("keeps the input order and never runs more than the limit at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await mapWithConcurrency([30, 5, 20, 1, 10], 2, async (ms) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, ms));
      inFlight -= 1;
      return ms * 2;
    });

    expect(results).toEqual([60, 10, 40, 2, 20]);
    expect(peak).toBe(2);
  });

  test("returns an empty list for no items", async () => {
    await expect(mapWithConcurrency([], 4, async (item: number) => item)).resolves.toEqual([]);
  });
});
