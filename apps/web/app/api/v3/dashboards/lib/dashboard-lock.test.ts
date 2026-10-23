import { describe, expect, test, vi } from "vitest";
import { lockDashboard, nextDashboardUpdatedAt } from "./dashboard-lock";

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

describe("lockDashboard", () => {
  const txReturning = (rows: { updatedAt: Date }[]) => ({ $queryRaw: vi.fn(async () => rows) });

  test("locks the dashboard's row FOR UPDATE and returns the updatedAt it holds", async () => {
    const updatedAt = new Date("2026-06-01T12:00:00.000Z");
    const tx = txReturning([{ updatedAt }]);

    expect(await lockDashboard(tx as never, "cldb000000000000000000001")).toEqual({ updatedAt });

    const [strings, ...values] = tx.$queryRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(strings.join("?")).toMatch(/FROM "Dashboard" WHERE id = \? FOR UPDATE/);
    expect(values).toEqual(["cldb000000000000000000001"]);
  });

  test("is null when the dashboard no longer exists", async () => {
    expect(await lockDashboard(txReturning([]) as never, "cldb_gone")).toBeNull();
  });
});
