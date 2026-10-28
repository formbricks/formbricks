import { describe, expect, test, vi } from "vitest";
import { fetchCreativeStats, formatClickRate, hasStats, readCreativeStats } from "./stats";

const totals = { impressions: 100, clicks: 5, clickRate: 0.05 };

describe("readCreativeStats", () => {
  test("reads the totals and the range", () => {
    expect(
      readCreativeStats({ structuredContent: { data: { from: "2026-09-29", to: "2026-10-28", totals } } })
    ).toEqual({ from: "2026-09-29", to: "2026-10-28", ...totals });
  });

  test("a creative without impressions has no click rate", () => {
    expect(
      readCreativeStats({
        structuredContent: {
          data: { from: "a", to: "b", totals: { impressions: 0, clicks: 0, clickRate: null } },
        },
      })?.clickRate
    ).toBeNull();
  });

  test.each([
    ["undefined", undefined],
    ["an error", { isError: true, structuredContent: { data: { from: "a", to: "b", totals } } }],
    ["no totals", { structuredContent: { data: { from: "a", to: "b" } } }],
    [
      "a negative count",
      { structuredContent: { data: { from: "a", to: "b", totals: { ...totals, clicks: -1 } } } },
    ],
    ["no range", { structuredContent: { data: { totals } } }],
  ])("is not stats: %s", (_name, result) => {
    expect(readCreativeStats(result)).toBeUndefined();
  });
});

describe("formatClickRate", () => {
  test("a percentage in the host's locale, or why there is none", () => {
    expect(formatClickRate(0.0305, { locale: "en-US" })).toBe("3.1%");
    expect(formatClickRate(0.0305, { locale: "de-DE" })).toContain("3,1");
    expect(formatClickRate(null)).toBe("No impressions");
  });
});

describe("hasStats", () => {
  test("only a creative that was published has any", () => {
    expect(hasStats({ displayStatus: "draft", status: "draft" })).toBe(false);
    expect(hasStats({ displayStatus: "active", status: "inProgress" })).toBe(true);
    expect(hasStats({ displayStatus: "archived", status: "draft" })).toBe(true);
  });
});

describe("fetchCreativeStats", () => {
  const range = { from: "2026-09-29", to: "2026-10-28" };

  test("asks get_creative_stats for the creative and reads the totals", async () => {
    const callTool = vi.fn().mockResolvedValue({ structuredContent: { data: { ...range, totals } } });

    await expect(fetchCreativeStats(callTool, "clc1")).resolves.toEqual({ ...range, ...totals });
    expect(callTool).toHaveBeenCalledWith("get_creative_stats", { creativeId: "clc1" });
  });

  test("a tool error is not stats", async () => {
    const callTool = vi.fn().mockResolvedValue({ isError: true, structuredContent: { error: {} } });
    await expect(fetchCreativeStats(callTool, "clc1")).resolves.toBeUndefined();
  });

  test("a thrown error is not stats, and does not escape", async () => {
    const callTool = vi.fn().mockRejectedValue(new Error("closed"));
    await expect(fetchCreativeStats(callTool, "clc1")).resolves.toBeUndefined();
  });
});
