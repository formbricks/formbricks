import { describe, expect, test } from "vitest";
import { getDeletionCleanupRetryDelayMs } from "./constants";

const MINUTE = 60 * 1000;

describe("getDeletionCleanupRetryDelayMs", () => {
  test("waits a minute after the first failure and doubles after each one", () => {
    expect([1, 2, 3, 4].map(getDeletionCleanupRetryDelayMs)).toEqual([
      MINUTE,
      2 * MINUTE,
      4 * MINUTE,
      8 * MINUTE,
    ]);
  });

  test("caps the wait at a day, however many failures, and never overflows", () => {
    expect(getDeletionCleanupRetryDelayMs(11)).toBe(1024 * MINUTE);
    expect(getDeletionCleanupRetryDelayMs(12)).toBe(24 * 60 * MINUTE);
    expect(getDeletionCleanupRetryDelayMs(10_000)).toBe(24 * 60 * MINUTE);
  });
});
