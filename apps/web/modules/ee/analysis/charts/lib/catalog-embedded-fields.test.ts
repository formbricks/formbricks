import { describe, expect, test } from "vitest";
import { mergeEmbeddedFields, namesDatasetField, toEmbeddedFields } from "./catalog-embedded-fields";

const PLAN = "FeedbackRecords.ed_plan_64879f7d";
const TIER = "FeedbackRecords.ed_tier_0a1b2c3d";

describe("toEmbeddedFields", () => {
  test("has none for a catalog without embedded keys", () => {
    expect(toEmbeddedFields([])).toEqual([]);
    expect(toEmbeddedFields([{ name: "FeedbackRecords.sourceName", label: "Source" }])).toEqual([]);
  });

  test("names each key by the catalog's `key`, falling back to its label (C16)", () => {
    expect(
      toEmbeddedFields([
        { name: PLAN, label: "Plan (embedded)", key: "Plan" },
        { name: TIER, label: "Tier" },
      ])
    ).toEqual([
      { name: PLAN, key: "Plan" },
      { name: TIER, key: "Tier" },
    ]);
  });
});

describe("mergeEmbeddedFields", () => {
  test("has none for no datasets, or datasets without keys", () => {
    expect(mergeEmbeddedFields([])).toEqual([]);
    expect(mergeEmbeddedFields([[{ name: "FeedbackRecords.sourceName", label: "Source" }]])).toEqual([]);
  });

  test("keeps one field per key across datasets, in key order", () => {
    expect(
      mergeEmbeddedFields([
        [
          { name: TIER, label: "Tier" },
          { name: PLAN, label: "Plan" },
        ],
        [{ name: PLAN, label: "Plan" }],
      ])
    ).toEqual([
      { name: PLAN, key: "Plan" },
      { name: TIER, key: "Tier" },
    ]);
  });

  test("merges the 100 keys of each of many datasets into one sorted list without duplicates", () => {
    const dataset = (offset: number) =>
      Array.from({ length: 100 }, (_, index) => ({
        name: `FeedbackRecords.ed_k${index + offset}_00000000`,
        label: `k${String(index + offset).padStart(3, "0")}`,
      }));
    const merged = mergeEmbeddedFields([dataset(0), dataset(50), dataset(100)]);
    expect(merged).toHaveLength(200);
    expect(merged[0].key).toBe("k000");
    expect(merged.at(-1)?.key).toBe("k199");
  });
});

describe("namesDatasetField", () => {
  const row = (field: string) => ({ id: field, field, operator: "equals", values: ["x"] });

  test("is false for no rules and for rules on shared fields only", () => {
    expect(namesDatasetField([])).toBe(false);
    expect(namesDatasetField([row("FeedbackRecords.sourceName")])).toBe(false);
  });

  test("finds an embedded-data key or an answer rule, however deep in a group (U6)", () => {
    expect(namesDatasetField([row(PLAN)])).toBe(true);
    expect(
      namesDatasetField([
        row("FeedbackRecords.sourceName"),
        {
          id: "g",
          logic: "or",
          children: [{ id: "g2", logic: "and", children: [row("FeedbackRecords.answer:q1")] }],
        },
      ])
    ).toBe(true);
  });

  test("reads dimension names too", () => {
    expect(namesDatasetField(["FeedbackRecords.sourceName", TIER])).toBe(true);
  });
});
