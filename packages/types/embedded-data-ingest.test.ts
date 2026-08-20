import { describe, expect, test } from "vitest";
import type { TEmbeddedDataType } from "./embedded-data";
import {
  MAX_INGESTED_VALUE_BYTES,
  applyIngestContract,
  mergeIngestFlags,
  normalizeIngestedValue,
} from "./embedded-data-ingest";
import { type TLinkedEmbeddedField, coerceToEmbeddedDataType } from "./embedded-data-resolver";

const ingestedField = ({
  storageKey,
  dataType = "string",
  locked = false,
}: {
  storageKey: string;
  dataType?: TEmbeddedDataType;
  locked?: boolean;
}): TLinkedEmbeddedField => ({
  field: { name: storageKey, source: "ingested", dataType, defaultValue: null, locked },
  link: { storageKey },
});

const computedField = (storageKey: string): TLinkedEmbeddedField => ({
  field: { name: storageKey, source: "computed", dataType: "string", defaultValue: null, locked: false },
  link: { storageKey },
});

const DATA_TYPES: TEmbeddedDataType[] = ["string", "number", "boolean", "date"];

/**
 * Everything anyone might reasonably send, per type, so the round-trip invariant below is checked
 * against the same inputs the normalization table is.
 */
const CANDIDATE_INPUTS: unknown[] = [
  "hello",
  "",
  "   ",
  "0",
  "1",
  "42",
  "-3.5",
  "1e3",
  " 7 ",
  "abc",
  "true",
  "FALSE",
  " True ",
  "yes",
  "no",
  "on",
  "off",
  "maybe",
  "2026-08-06",
  "2026-08-06T10:30:00Z",
  "2026-08-06T10:30:00.123Z",
  "2026-08-06T10:30:00+02:00",
  "2026-08-06T10:30:00+0200",
  "2026-08-06T10:30:00",
  "2026-08-06 10:30",
  "2026-02-30",
  "Aug 6, 2026",
  0,
  1,
  42,
  -3.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  true,
  false,
  new Date("2026-08-06T10:30:00Z"),
];

describe("normalizeIngestedValue", () => {
  test("drops what nothing can be stored for, whatever the type", () => {
    for (const dataType of DATA_TYPES) {
      expect(normalizeIngestedValue(null, dataType)).toBeUndefined();
      expect(normalizeIngestedValue(undefined, dataType)).toBeUndefined();
      expect(normalizeIngestedValue(["a", "b"], dataType)).toBeUndefined();
      expect(normalizeIngestedValue({ row: "column" }, dataType)).toBeUndefined();
      expect(normalizeIngestedValue(new Date("nonsense"), dataType)).toBeUndefined();
    }
  });

  describe("string", () => {
    test("keeps strings verbatim, including the empty one", () => {
      expect(normalizeIngestedValue("gold", "string")).toEqual({ value: "gold" });
      expect(normalizeIngestedValue("", "string")).toEqual({ value: "" });
      expect(normalizeIngestedValue("  padded  ", "string")).toEqual({ value: "  padded  " });
    });

    test("stringifies the other scalars losslessly and never fails", () => {
      expect(normalizeIngestedValue(42, "string")).toEqual({ value: "42" });
      expect(normalizeIngestedValue(true, "string")).toEqual({ value: "true" });
      expect(normalizeIngestedValue(new Date("2026-08-06T10:30:00Z"), "string")).toEqual({
        value: "2026-08-06T10:30:00.000Z",
      });
    });
  });

  describe("number", () => {
    test("accepts numbers and numeric strings", () => {
      expect(normalizeIngestedValue(42, "number")).toEqual({ value: 42 });
      expect(normalizeIngestedValue("42", "number")).toEqual({ value: 42 });
      expect(normalizeIngestedValue(" -3.5 ", "number")).toEqual({ value: -3.5 });
      expect(normalizeIngestedValue("0", "number")).toEqual({ value: 0 });
    });

    test("keeps a non-numeric value raw and flags it, so the response still saves", () => {
      expect(normalizeIngestedValue("abc", "number")).toEqual({ value: "abc", flag: "coercion_failed" });
      expect(normalizeIngestedValue(true, "number")).toEqual({ value: "true", flag: "coercion_failed" });
    });

    test("refuses a blank string rather than reading it as zero", () => {
      expect(normalizeIngestedValue("", "number")).toEqual({ value: "", flag: "coercion_failed" });
      expect(normalizeIngestedValue("   ", "number")).toEqual({ value: "   ", flag: "coercion_failed" });
    });

    test("refuses non-finite numbers, which JSON cannot carry", () => {
      expect(normalizeIngestedValue(Number.NaN, "number")).toEqual({
        value: "NaN",
        flag: "coercion_failed",
      });
      expect(normalizeIngestedValue(Number.POSITIVE_INFINITY, "number")).toEqual({
        value: "Infinity",
        flag: "coercion_failed",
      });
    });
  });

  describe("boolean", () => {
    test("normalizes every accepted spelling onto the two strings the read seam takes", () => {
      for (const truthy of [true, 1, "true", "TRUE", " True ", "1", "yes", "on"]) {
        expect(normalizeIngestedValue(truthy, "boolean")).toEqual({ value: "true" });
      }
      for (const falsy of [false, 0, "false", "FALSE", " False ", "0", "no", "off"]) {
        expect(normalizeIngestedValue(falsy, "boolean")).toEqual({ value: "false" });
      }
    });

    test("flags anything else", () => {
      expect(normalizeIngestedValue("maybe", "boolean")).toEqual({
        value: "maybe",
        flag: "coercion_failed",
      });
      expect(normalizeIngestedValue(2, "boolean")).toEqual({ value: "2", flag: "coercion_failed" });
    });
  });

  describe("date", () => {
    test("keeps a date-only value a date rather than promoting it to midnight UTC", () => {
      expect(normalizeIngestedValue("2026-08-06", "date")).toEqual({ value: "2026-08-06" });
      expect(normalizeIngestedValue(" 2026-08-06 ", "date")).toEqual({ value: "2026-08-06" });
    });

    test("passes a UTC datetime through and converts an explicit offset", () => {
      expect(normalizeIngestedValue("2026-08-06T10:30:00Z", "date")).toEqual({
        value: "2026-08-06T10:30:00Z",
      });
      expect(normalizeIngestedValue("2026-08-06T10:30:00+02:00", "date")).toEqual({
        value: "2026-08-06T08:30:00.000Z",
      });
      // `±HHMM` is not in the spec's Date Time String Format, so it is canonicalized before parsing
      // rather than handed to an engine that may or may not accept it.
      expect(normalizeIngestedValue("2026-08-06T10:30:00+0200", "date")).toEqual({
        value: "2026-08-06T08:30:00.000Z",
      });
    });

    test("reads a zone-less datetime as UTC, so the result never depends on where the contract ran", () => {
      // A local-time reading would ingest the same param as a different instant in every browser.
      expect(normalizeIngestedValue("2026-08-06T10:30:00", "date")).toEqual({
        value: "2026-08-06T10:30:00.000Z",
      });
      expect(normalizeIngestedValue("2026-08-06 10:30", "date")).toEqual({
        value: "2026-08-06T10:30:00.000Z",
      });
    });

    test("converts a Date instance", () => {
      expect(normalizeIngestedValue(new Date("2026-08-06T10:30:00Z"), "date")).toEqual({
        value: "2026-08-06T10:30:00.000Z",
      });
    });

    test("flags what Date would only guess at", () => {
      expect(normalizeIngestedValue("Aug 6, 2026", "date")).toEqual({
        value: "Aug 6, 2026",
        flag: "coercion_failed",
      });
      // A calendar date that does not exist is flagged rather than rolled forward to March 2nd.
      expect(normalizeIngestedValue("2026-02-30", "date")).toEqual({
        value: "2026-02-30",
        flag: "coercion_failed",
      });
      // Epoch numbers are ambiguous between seconds and milliseconds.
      expect(normalizeIngestedValue(1786012200000, "date")).toEqual({
        value: "1786012200000",
        flag: "coercion_failed",
      });
    });
  });

  /**
   * **The invariant that keeps the write and read seams from drifting.** Every value the normalizer
   * accepts without a flag has to survive `coerceToEmbeddedDataType`, or the field ingests
   * "successfully" and then resolves as unset — the failure mode that is invisible at the boundary
   * and only shows up as a missing value in an export weeks later.
   */
  test("everything accepted without a flag reads back as its declared type", () => {
    for (const dataType of DATA_TYPES) {
      for (const input of CANDIDATE_INPUTS) {
        const normalized = normalizeIngestedValue(input, dataType);
        if (!normalized || normalized.flag) continue;

        expect(
          coerceToEmbeddedDataType(normalized.value, dataType),
          `${dataType} accepted ${JSON.stringify(input)} as ${JSON.stringify(normalized.value)}, which the read seam refuses`
        ).not.toBeUndefined();
      }
    }
  });

  test("normalization is idempotent, so the server re-running it agrees with the client", () => {
    for (const dataType of DATA_TYPES) {
      for (const input of CANDIDATE_INPUTS) {
        const first = normalizeIngestedValue(input, dataType);
        if (!first) continue;

        const second = normalizeIngestedValue(first.value, dataType);
        expect(second?.value, `${dataType} re-normalized ${JSON.stringify(input)} differently`).toEqual(
          first.value
        );
      }
    }
  });
});

describe("applyIngestContract", () => {
  test("stores a declared value under its declared key", () => {
    const result = applyIngestContract({
      incoming: { plan: "gold", seats: "12" },
      ingestedFields: [
        ingestedField({ storageKey: "plan" }),
        ingestedField({ storageKey: "seats", dataType: "number" }),
      ],
      elementIds: [],
    });

    expect(result.data).toEqual({ plan: "gold", seats: 12 });
    expect(result.flags).toEqual([]);
    expect(result.dropped).toEqual([]);
  });

  test("drops a key no ingested field declares", () => {
    const result = applyIngestContract({
      incoming: { plan: "gold", rogue: "x" },
      ingestedFields: [ingestedField({ storageKey: "plan" })],
      elementIds: [],
    });

    expect(result.data).toEqual({ plan: "gold" });
    expect(result.dropped).toEqual([{ key: "rogue", reason: "unknown_key" }]);
  });

  test("only ingested fields are settable: computed keys are dropped", () => {
    const result = applyIngestContract({
      incoming: { score: "999" },
      ingestedFields: [computedField("score")],
      elementIds: [],
    });

    expect(result.data).toEqual({});
    expect(result.dropped).toEqual([{ key: "score", reason: "unknown_key" }]);
  });

  test("a locked field ignores external writes", () => {
    const result = applyIngestContract({
      incoming: { plan: "gold" },
      ingestedFields: [ingestedField({ storageKey: "plan", locked: true })],
      elementIds: [],
    });

    // Nothing stored, and no default written either — `resolveEmbeddedValue` owns that fallback.
    expect(result.data).toEqual({});
    expect(result.dropped).toEqual([{ key: "plan", reason: "locked_field" }]);
  });

  test("nothing is written for a field nothing arrived for", () => {
    const result = applyIngestContract({
      incoming: {},
      ingestedFields: [ingestedField({ storageKey: "plan" })],
      elementIds: [],
    });

    expect(result.data).toEqual({});
    expect(Object.keys(result.data)).toEqual([]);
  });

  test("stores a bad value raw, flags it, and keeps going", () => {
    const result = applyIngestContract({
      incoming: { seats: "many", plan: "gold" },
      ingestedFields: [
        ingestedField({ storageKey: "seats", dataType: "number" }),
        ingestedField({ storageKey: "plan" }),
      ],
      elementIds: [],
    });

    expect(result.data).toEqual({ seats: "many", plan: "gold" });
    expect(result.flags).toEqual([{ key: "seats", reason: "coercion_failed" }]);
    expect(result.dropped).toEqual([]);
  });

  test("drops a non-scalar under a declared key", () => {
    const result = applyIngestContract({
      incoming: { plan: ["gold", "silver"] },
      ingestedFields: [ingestedField({ storageKey: "plan" })],
      elementIds: [],
    });

    expect(result.data).toEqual({});
    expect(result.dropped).toEqual([{ key: "plan", reason: "unsupported_value" }]);
  });

  describe("case matching", () => {
    test("fills a declared field from a differently cased key, storing it under the declared spelling", () => {
      const result = applyIngestContract({
        incoming: { customerref: "abc" },
        ingestedFields: [ingestedField({ storageKey: "CustomerRef" })],
        elementIds: [],
      });

      expect(result.data).toEqual({ CustomerRef: "abc" });
      expect(result.dropped).toEqual([]);
    });

    test("an exact match beats a case-insensitive one whatever order the bag arrived in", () => {
      const fields = [ingestedField({ storageKey: "plan" })];

      expect(
        applyIngestContract({ incoming: { Plan: "a", plan: "b" }, ingestedFields: fields, elementIds: [] })
          .data
      ).toEqual({ plan: "b" });
      expect(
        applyIngestContract({ incoming: { plan: "b", Plan: "a" }, ingestedFields: fields, elementIds: [] })
          .data
      ).toEqual({ plan: "b" });
    });

    test("one key fills two fields that differ only by case, as the shipped URL reader does", () => {
      const result = applyIngestContract({
        incoming: { PLAN: "gold" },
        ingestedFields: [ingestedField({ storageKey: "plan" }), ingestedField({ storageKey: "Plan" })],
        elementIds: [],
      });

      expect(result.data).toEqual({ plan: "gold", Plan: "gold" });
      expect(result.dropped).toEqual([]);
    });
  });

  describe("element id collisions", () => {
    test("passes a question answer through untouched, without coercing or dropping it", () => {
      const result = applyIngestContract({
        incoming: { q1: "42", q2: ["a", "b"], q3: { row: "column" } },
        ingestedFields: [ingestedField({ storageKey: "plan", dataType: "number" })],
        elementIds: ["q1", "q2", "q3"],
      });

      expect(result.data).toEqual({ q1: "42", q2: ["a", "b"], q3: { row: "column" } });
      expect(result.dropped).toEqual([]);
    });

    test("reports a question answer whose shape cannot be stored, rather than swallowing it", () => {
      const result = applyIngestContract({
        incoming: { q1: "answer", q2: { nested: { deep: 1 } }, q3: new Date() },
        ingestedFields: [],
        elementIds: ["q1", "q2", "q3"],
      });

      expect(result.data).toEqual({ q1: "answer" });
      expect(result.dropped).toEqual([
        { key: "q2", reason: "unsupported_value" },
        { key: "q3", reason: "unsupported_value" },
      ]);
    });

    test("never rewrites the answer address, even when a field declares it", () => {
      const result = applyIngestContract({
        incoming: { q1: "answer" },
        ingestedFields: [ingestedField({ storageKey: "q1", dataType: "number" })],
        elementIds: ["q1"],
      });

      expect(result.data).toEqual({ q1: "answer" });
      expect(result.dropped).toEqual([{ key: "q1", reason: "element_id_collision" }]);
    });

    test("a question answer is never rerouted onto a field that matches it only by case", () => {
      const result = applyIngestContract({
        incoming: { plan: "answer" },
        ingestedFields: [ingestedField({ storageKey: "Plan" })],
        elementIds: ["plan"],
      });

      expect(result.data).toEqual({ plan: "answer" });
      expect(result.dropped).toEqual([]);
    });
  });

  describe("size limits", () => {
    test("truncates an oversize value and flags it", () => {
      const oversize = "a".repeat(MAX_INGESTED_VALUE_BYTES + 100);
      const result = applyIngestContract({
        incoming: { note: oversize },
        ingestedFields: [ingestedField({ storageKey: "note" })],
        elementIds: [],
      });

      expect(result.data.note).toHaveLength(MAX_INGESTED_VALUE_BYTES);
      expect(result.flags).toEqual([{ key: "note", reason: "truncated" }]);
    });

    test("measures UTF-8 bytes, not code units, and cuts on a code-point boundary", () => {
      // "😀" is 4 UTF-8 bytes and 2 UTF-16 units, so a byte budget of 4n+2 has to stop short of one.
      const emoji = "😀".repeat(MAX_INGESTED_VALUE_BYTES); // 4× the budget in bytes
      const result = applyIngestContract({
        incoming: { note: emoji },
        ingestedFields: [ingestedField({ storageKey: "note" })],
        elementIds: [],
      });

      const stored = result.data.note as string;
      expect(new TextEncoder().encode(stored).length).toBeLessThanOrEqual(MAX_INGESTED_VALUE_BYTES);
      expect(stored).toBe("😀".repeat(MAX_INGESTED_VALUE_BYTES / 4));
      // No lone surrogate survived the cut.
      expect(stored).toEqual([...stored].join(""));
      expect(result.flags).toEqual([{ key: "note", reason: "truncated" }]);
    });

    test("leaves a value that exactly fits alone", () => {
      const exact = "a".repeat(MAX_INGESTED_VALUE_BYTES);
      const result = applyIngestContract({
        incoming: { note: exact },
        ingestedFields: [ingestedField({ storageKey: "note" })],
        elementIds: [],
      });

      expect(result.data.note).toBe(exact);
      expect(result.flags).toEqual([]);
    });

    test("flags both reasons for an oversize value of the wrong type", () => {
      const oversize = "a".repeat(MAX_INGESTED_VALUE_BYTES + 1);
      const result = applyIngestContract({
        incoming: { seats: oversize },
        ingestedFields: [ingestedField({ storageKey: "seats", dataType: "number" })],
        elementIds: [],
      });

      expect(result.flags).toEqual([
        { key: "seats", reason: "coercion_failed" },
        { key: "seats", reason: "truncated" },
      ]);
    });
  });

  test("an empty allow-list drops everything, so a survey select that omits the join ingests nothing", () => {
    const result = applyIngestContract({
      incoming: { plan: "gold" },
      ingestedFields: [],
      elementIds: [],
    });

    expect(result.data).toEqual({});
    expect(result.dropped).toEqual([{ key: "plan", reason: "unknown_key" }]);
  });

  test("running the contract over its own output changes nothing", () => {
    const fields = [
      ingestedField({ storageKey: "plan" }),
      ingestedField({ storageKey: "seats", dataType: "number" }),
      ingestedField({ storageKey: "trial", dataType: "boolean" }),
      ingestedField({ storageKey: "signedUpAt", dataType: "date" }),
    ];
    const first = applyIngestContract({
      incoming: { plan: "gold", seats: "12", trial: "yes", signedUpAt: "2026-08-06T10:30:00+02:00", q1: "a" },
      ingestedFields: fields,
      elementIds: ["q1"],
    });

    const second = applyIngestContract({ incoming: first.data, ingestedFields: fields, elementIds: ["q1"] });

    expect(second.data).toEqual(first.data);
    expect(second.flags).toEqual([]);
    expect(second.dropped).toEqual([]);
  });
});

describe("mergeIngestFlags", () => {
  test("replaces the flags of every key the payload rewrote", () => {
    const merged = mergeIngestFlags([{ key: "seats", reason: "coercion_failed" }], {
      data: { seats: 12 },
      flags: [],
    });

    expect(merged).toEqual([]);
  });

  test("keeps the flags of keys the payload did not touch", () => {
    const merged = mergeIngestFlags([{ key: "seats", reason: "coercion_failed" }], {
      data: { plan: "gold" },
      flags: [{ key: "plan", reason: "truncated" }],
    });

    expect(merged).toEqual([
      { key: "seats", reason: "coercion_failed" },
      { key: "plan", reason: "truncated" },
    ]);
  });

  test("keeps a flag whose key was dropped this round, since its stored value is unchanged", () => {
    const merged = mergeIngestFlags([{ key: "plan", reason: "coercion_failed" }], {
      data: {},
      flags: [],
    });

    expect(merged).toEqual([{ key: "plan", reason: "coercion_failed" }]);
  });
});
