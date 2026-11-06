import { describe, expect, test } from "vitest";
import type { TMatchableOption } from "./option-matcher";
import {
  UNMAPPED_DISTINCT_CAP,
  UNMAPPED_RESPONSE_IDS_CAP,
  createUnmappedCollector,
} from "./unmapped-collector";

const question = { id: "qid1", code: "q1", headline: "Colour?" };
const options: TMatchableOption[] = [
  { id: "c1", code: "1", label: { default: "Red", ar: "أحمر" } },
  { id: "c2", code: "2", label: { default: "Blue" } },
];

const base = { column: "q1", question, reason: "no_match" as const, options };

describe("createUnmappedCollector", () => {
  test("one row per (column, value) with count, languages, ids and the closest option", () => {
    const collector = createUnmappedCollector();
    collector.add({ ...base, value: "Redd", language: "en", responseId: "r1" });
    collector.add({ ...base, value: "Redd", language: "ar", responseId: "r2" });
    collector.add({ ...base, value: "Redd", language: "en", responseId: "r3" });
    collector.add({ ...base, value: "Teal", language: "en", responseId: "r4" });
    collector.add({ ...base, column: "q2", value: "Redd", language: "en", responseId: "r5" });

    const { unmapped, dropped } = collector.result();
    expect(dropped).toBe(0);
    expect(unmapped).toHaveLength(3);
    expect(unmapped[0]).toMatchObject({
      column: "q1",
      value: "Redd",
      responseCount: 3,
      languages: ["ar", "en"],
      responseIds: ["r1", "r2", "r3"],
      responseIdsTruncated: false,
      closest: { code: "1", label: "Red", similarity: 0.75 },
    });
  });

  test("a response holding the same unmapped text twice counts once", () => {
    const collector = createUnmappedCollector();
    collector.add({ ...base, value: "x", language: "en", responseId: "r1" });
    collector.add({ ...base, value: "x", language: "en", responseId: "r1" });
    expect(collector.result().unmapped[0].responseCount).toBe(1);
  });

  test("a value without options to compare has no closest option", () => {
    const collector = createUnmappedCollector();
    collector.add({
      ...base,
      reason: "not_a_number",
      options: [],
      value: "n/a",
      language: "en",
      responseId: "r1",
    });
    expect(collector.result().unmapped[0].closest).toBeNull();
  });

  test("caps the id list but keeps the exact count", () => {
    const collector = createUnmappedCollector();
    for (let i = 0; i < UNMAPPED_RESPONSE_IDS_CAP + 5; i++) {
      collector.add({ ...base, value: "x", language: "en", responseId: `r${i}` });
    }
    const [entry] = collector.result().unmapped;
    expect(entry.responseCount).toBe(UNMAPPED_RESPONSE_IDS_CAP + 5);
    expect(entry.responseIds).toHaveLength(UNMAPPED_RESPONSE_IDS_CAP);
    expect(entry.responseIdsTruncated).toBe(true);
  });

  test("caps distinct values and reports how many were dropped", () => {
    const collector = createUnmappedCollector();
    for (let i = 0; i < UNMAPPED_DISTINCT_CAP + 3; i++) {
      collector.add({ ...base, value: `v${i}`, language: "en", responseId: "r1" });
    }
    const { unmapped, dropped } = collector.result();
    expect(unmapped).toHaveLength(UNMAPPED_DISTINCT_CAP);
    expect(dropped).toBe(3);
  });
});
