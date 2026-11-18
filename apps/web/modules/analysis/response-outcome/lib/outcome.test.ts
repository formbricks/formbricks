import { describe, expect, test } from "vitest";
import {
  OUTCOME_BATCH_SIZE,
  chunkIds,
  dropRowsOutsideStatuses,
  matchesResponseStatuses,
  patchOutcomes,
  responseStatus,
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

describe("matchesResponseStatuses", () => {
  test("no ticked status means every row matches", () => {
    expect(matchesResponseStatuses([], { finished: false, outcome: null })).toBe(true);
  });

  test("Complete follows finished, Partial follows not finished, Low quality follows the outcome", () => {
    expect(matchesResponseStatuses(["complete"], { finished: true, outcome: "lowQuality" })).toBe(true);
    expect(matchesResponseStatuses(["complete"], { finished: false, outcome: null })).toBe(false);
    expect(matchesResponseStatuses(["partial"], { finished: false, outcome: "lowQuality" })).toBe(true);
    expect(matchesResponseStatuses(["partial"], { finished: true, outcome: null })).toBe(false);
    expect(matchesResponseStatuses(["lowQuality"], { finished: true, outcome: "lowQuality" })).toBe(true);
    expect(matchesResponseStatuses(["lowQuality"], { finished: true, outcome: null })).toBe(false);
  });

  test("a restored row leaves the list unless its finished state keeps it in another ticked status (ENG-7078)", () => {
    expect(matchesResponseStatuses(["complete", "lowQuality"], { finished: false, outcome: null })).toBe(
      false
    );
    expect(matchesResponseStatuses(["complete", "lowQuality"], { finished: true, outcome: null })).toBe(true);
    expect(matchesResponseStatuses(["partial", "lowQuality"], { finished: true, outcome: null })).toBe(false);
    expect(matchesResponseStatuses(["partial", "lowQuality"], { finished: false, outcome: null })).toBe(true);
  });

  test("a row marked Low quality joins a list that ticks Low quality", () => {
    expect(
      matchesResponseStatuses(["complete", "lowQuality"], { finished: false, outcome: "lowQuality" })
    ).toBe(true);
  });
});

describe("dropRowsOutsideStatuses", () => {
  const list = [
    { id: "a", finished: true },
    { id: "b", finished: false },
    { id: "c", finished: false },
  ];
  const idsOf = (rowsLeft: typeof list) => rowsLeft.map((row) => row.id);

  test("drops a saved row that matches none of the ticked statuses, and keeps the rest", () => {
    expect(idsOf(dropRowsOutsideStatuses(list, ["b"], null, ["complete", "lowQuality"]))).toEqual(["a", "c"]);
    expect(idsOf(dropRowsOutsideStatuses(list, ["a"], null, ["partial", "lowQuality"]))).toEqual(["b", "c"]);
  });

  test("keeps a saved row that its finished state or new outcome still puts in a ticked status", () => {
    expect(idsOf(dropRowsOutsideStatuses(list, ["b"], null, ["partial", "lowQuality"]))).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(idsOf(dropRowsOutsideStatuses(list, ["b"], "lowQuality", ["complete", "lowQuality"]))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("returns the same array when nothing is dropped, so React skips the render", () => {
    expect(dropRowsOutsideStatuses(list, ["a"], null, ["complete"])).toBe(list);
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
