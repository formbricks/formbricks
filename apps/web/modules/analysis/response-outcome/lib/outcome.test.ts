import { describe, expect, test } from "vitest";
import {
  OUTCOME_BATCH_SIZE,
  chunkIds,
  patchOutcomes,
  responseStatus,
  shouldDropAfterOutcome,
  snapshotOutcomes,
} from "./outcome";

const rows = [{ id: "a", outcome: null }, { id: "b", outcome: "lowQuality" as const }, { id: "c" }];

describe("chunkIds", () => {
  test("splits into batches of at most 100", () => {
    const ids = Array.from({ length: 250 }, (_, index) => `id${index}`);
    const chunks = chunkIds(ids);
    expect(OUTCOME_BATCH_SIZE).toBe(100);
    expect(chunks.map((chunk) => chunk.length)).toEqual([100, 100, 50]);
    expect(chunks.flat()).toEqual(ids);
  });

  test("an exact multiple leaves no empty tail, and nothing gives no batches", () => {
    expect(chunkIds(Array.from({ length: 100 }, (_, i) => String(i)))).toHaveLength(1);
    expect(chunkIds([])).toEqual([]);
  });

  test("repeated ids are sent once", () => {
    expect(chunkIds(["a", "b", "a"])).toEqual([["a", "b"]]);
  });
});

describe("snapshotOutcomes", () => {
  test("records the current outcome of the requested rows, null when unset", () => {
    expect(snapshotOutcomes(rows, ["a", "b", "c", "missing"])).toEqual({
      a: null,
      b: "lowQuality",
      c: null,
    });
  });
});

describe("patchOutcomes", () => {
  test("sets the outcome on the named rows only", () => {
    const next = patchOutcomes(rows, { a: "lowQuality", b: null });
    expect(next.map((row) => row.outcome ?? null)).toEqual(["lowQuality", null, null]);
    expect(next[2]).toBe(rows[2]);
  });

  test("returns the same array when nothing changes, so React skips the render", () => {
    expect(patchOutcomes(rows, { b: "lowQuality", missing: null })).toBe(rows);
  });
});

describe("shouldDropAfterOutcome", () => {
  test("a restored row leaves a Low quality filtered list; nothing else does", () => {
    expect(shouldDropAfterOutcome("lowQuality", null)).toBe(true);
    expect(shouldDropAfterOutcome("lowQuality", "lowQuality")).toBe(false);
    expect(shouldDropAfterOutcome("all", null)).toBe(false);
    expect(shouldDropAfterOutcome("complete", "lowQuality")).toBe(false);
  });
});

describe("responseStatus", () => {
  test("Low quality wins over finished or not, otherwise the response's own state", () => {
    expect(responseStatus("complete", "lowQuality")).toBe("lowQuality");
    expect(responseStatus("notCompleted", "lowQuality")).toBe("lowQuality");
    expect(responseStatus("complete", null)).toBe("complete");
    expect(responseStatus("notCompleted", undefined)).toBe("notCompleted");
  });
});
