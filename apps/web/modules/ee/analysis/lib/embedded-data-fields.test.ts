import { createRequire } from "node:module";
import { describe, expect, test, vi } from "vitest";
import {
  MAX_EMBEDDED_KEYS,
  MAX_EMBEDDED_KEYS_BYTES,
  isEmbeddedMemberName,
  selectEmbeddedKeys,
} from "./embedded-data-fields";
import { getEmbeddedMemberName } from "./embedded-member-name";

// vitestSetup.ts fakes `crypto` for the license checks; a member name is a real hash.
vi.unmock("crypto");
vi.unmock("node:crypto");

const require = createRequire(import.meta.url);
process.env.CUBEJS_API_SECRET = process.env.CUBEJS_API_SECRET || "cube-secret";
const cubeConfig = require("../../../../../../docker/cube/cube.js") as {
  getEmbeddedMemberSuffix: (key: string) => string;
  getEmbeddedKeys: (securityContext: { edKeys: unknown }) => string[];
};

const AWKWARD_KEYS = [
  "plan",
  "Plan",
  "plan ",
  "area_manager",
  "Area Manager",
  "área manager",
  "O'Brien's",
  "$1$ price",
  "a?b",
  "${CUBE}",
  "back\\slash",
  "区域",
  "emoji 🎉",
  "x".repeat(128),
  "___",
  "Ünïcödé-Ñame with a very long tail that is cut",
];

describe("embedded member names (ENG-6893)", () => {
  test("match the names the Cube model compiles, for awkward keys too", () => {
    for (const key of AWKWARD_KEYS) {
      expect(getEmbeddedMemberName(key)).toBe(
        `FeedbackRecords.ed_${cubeConfig.getEmbeddedMemberSuffix(key)}`
      );
    }
  });

  test("are valid Cube member names, unique per key and stable", () => {
    const names = AWKWARD_KEYS.map(getEmbeddedMemberName);
    expect(names.every(isEmbeddedMemberName)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
    expect(getEmbeddedMemberName("plan")).toBe("FeedbackRecords.ed_plan_64879f7d");
    expect(getEmbeddedMemberName("区域")).toMatch(/^FeedbackRecords\.ed_[0-9a-f]{8}$/);
  });

  test("are told apart from every other member", () => {
    expect(isEmbeddedMemberName("FeedbackRecords.ed_plan_64879f7d")).toBe(true);
    expect(isEmbeddedMemberName("FeedbackRecords.edc_plan_64879f7d")).toBe(false);
    expect(isEmbeddedMemberName("FeedbackRecords.sourceName")).toBe(false);
  });
});

describe("selectEmbeddedKeys", () => {
  test("keeps no key for a dataset without any", () => {
    expect(selectEmbeddedKeys([])).toEqual([]);
  });

  test("drops blank, over-long, non-string and duplicate keys, keeping frequency order", () => {
    expect(
      selectEmbeddedKeys(["plan", "", "   ", "x".repeat(129), 7, null, "plan", "Plan", "y".repeat(128)])
    ).toEqual(["plan", "Plan", "y".repeat(128)]);
  });

  test("keeps the 100 most frequent keys", () => {
    const ranked = Array.from({ length: 150 }, (_, index) => `key_${index}`);
    expect(selectEmbeddedKeys(ranked)).toEqual(ranked.slice(0, MAX_EMBEDDED_KEYS));
  });

  test("stays within the token's byte budget, skipping a key that would overflow it", () => {
    const long = Array.from(
      { length: 100 },
      (_, index) => `${String(index).padStart(3, "0")}${"é".repeat(60)}`
    );
    const selected = selectEmbeddedKeys(long);
    const bytes = selected.reduce((sum, key) => sum + new TextEncoder().encode(key).length, 0);
    expect(bytes).toBeLessThanOrEqual(MAX_EMBEDDED_KEYS_BYTES);
    expect(selected.length).toBeLessThan(100);
    expect(selected).toEqual(long.slice(0, selected.length));
  });

  test("selects the same keys the Cube model compiles", () => {
    const ranked = [...AWKWARD_KEYS, "", "   ", "z".repeat(129)];
    expect([...selectEmbeddedKeys(ranked)].sort()).toEqual(cubeConfig.getEmbeddedKeys({ edKeys: ranked }));
  });
});
