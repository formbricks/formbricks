import { describe, expect, test, vi } from "vitest";
import { nextDashboardUpdatedAt } from "./dashboard-lock";

vi.mock("server-only", () => ({}));

describe("nextDashboardUpdatedAt", () => {
  const previous = new Date("2026-06-01T12:00:00.000Z");

  test("is now when the clock has moved on", () => {
    const now = new Date("2026-06-01T12:00:05.000Z");
    expect(nextDashboardUpdatedAt({ updatedAt: previous }, now)).toEqual(now);
  });

  test("is a millisecond past the previous write in the same millisecond", () => {
    expect(nextDashboardUpdatedAt({ updatedAt: previous }, previous).getTime()).toBe(previous.getTime() + 1);
  });

  test("is a millisecond past the previous write when this clock lags behind it", () => {
    const lagging = new Date("2026-06-01T11:59:59.000Z");
    expect(nextDashboardUpdatedAt({ updatedAt: previous }, lagging).getTime()).toBe(previous.getTime() + 1);
  });
});
