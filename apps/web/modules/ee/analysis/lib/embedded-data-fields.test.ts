import { createRequire } from "node:module";
import { describe, expect, test, vi } from "vitest";
import {
  MAX_EMBEDDED_KEYS,
  MAX_EMBEDDED_KEYS_BYTES,
  MAX_TOKEN_EMBEDDED_KEYS,
  MAX_TOKEN_EMBEDDED_KEYS_BYTES,
  collectEmbeddedMemberNames,
  fromEmbeddedNumberMember,
  isEmbeddedMemberName,
  isEmbeddedNumberMemberName,
  selectEmbeddedKeys,
  toEmbeddedNumberMember,
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

describe("embedded member names", () => {
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

  test("have a numeric twin edn_ named as the Cube model compiles it, told apart from the key's member", () => {
    for (const key of AWKWARD_KEYS) {
      const twin = toEmbeddedNumberMember(getEmbeddedMemberName(key));
      expect(twin).toBe(`FeedbackRecords.edn_${cubeConfig.getEmbeddedMemberSuffix(key)}`);
      expect(isEmbeddedNumberMemberName(twin)).toBe(true);
      expect(isEmbeddedMemberName(twin)).toBe(false);
      expect(fromEmbeddedNumberMember(twin)).toBe(getEmbeddedMemberName(key));
    }
    expect(isEmbeddedNumberMemberName("FeedbackRecords.ed_plan_64879f7d")).toBe(false);
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

  const tokenBytes = (keys: readonly string[]) =>
    keys.reduce((sum, key) => sum + Buffer.byteLength(JSON.stringify(key), "utf8"), 0);

  test("stays within the token's byte budget as JSON writes the keys, skipping a key that would overflow it", () => {
    // A quote or backslash takes two bytes in the token, which is JSON.
    const quoted = Array.from(
      { length: 100 },
      (_, index) => `${String(index).padStart(3, "0")}${'"'.repeat(60)}`
    );
    const selected = selectEmbeddedKeys(quoted);
    expect(tokenBytes(selected)).toBeLessThanOrEqual(MAX_EMBEDDED_KEYS_BYTES);
    expect(selected.length).toBeLessThan(100);
    expect(selected).toEqual(quoted.slice(0, selected.length));

    // 100 realistic ASCII keys of 60 characters fit.
    const realistic = Array.from(
      { length: 100 },
      (_, index) => `${String(index).padStart(3, "0")}${"a".repeat(57)}`
    );
    expect(selectEmbeddedKeys(realistic)).toHaveLength(100);
  });

  test("counts CJK and accented keys in UTF-8 bytes, which is what the token header carries", () => {
    // 40 CJK characters are 40 JSON characters but 120 bytes: a character count would let 100 through.
    const cjk = Array.from(
      { length: 100 },
      (_, index) => `${String(index).padStart(3, "0")}${"区".repeat(40)}`
    );
    const selected = selectEmbeddedKeys(cjk);
    expect(cjk.reduce((sum, key) => sum + JSON.stringify(key).length, 0)).toBeLessThanOrEqual(
      MAX_EMBEDDED_KEYS_BYTES
    );
    expect(tokenBytes(selected)).toBeLessThanOrEqual(MAX_EMBEDDED_KEYS_BYTES);
    expect(selected).toHaveLength(Math.floor(MAX_EMBEDDED_KEYS_BYTES / tokenBytes([cjk[0]])));
  });

  test("the Cube model refuses keys past the token's byte budget too", () => {
    const cjk = Array.from(
      { length: MAX_TOKEN_EMBEDDED_KEYS },
      (_, index) => `${String(index).padStart(3, "0")}${"区".repeat(40)}`
    );
    const compiled = cubeConfig.getEmbeddedKeys({ edKeys: cjk });
    expect(tokenBytes(compiled)).toBeLessThanOrEqual(MAX_TOKEN_EMBEDDED_KEYS_BYTES);
    expect(compiled).toEqual(cjk.slice(0, Math.floor(MAX_TOKEN_EMBEDDED_KEYS_BYTES / tokenBytes([cjk[0]]))));
  });

  test("drops keys holding C0 or C1 control characters, as the Cube model does", () => {
    const controls = [
      "tab\tkey",
      "line\nbreak",
      "nul\u0000",
      "esc\u001b[31m",
      "del\u007f",
      "c1\u0085",
      "c1\u009f",
    ];
    expect(selectEmbeddedKeys([...controls, "plan"])).toEqual(["plan"]);
    expect(cubeConfig.getEmbeddedKeys({ edKeys: [...controls, "plan"] })).toEqual(["plan"]);
  });

  test("the Cube model accepts the top keys plus a rare-key bucket, and no more", () => {
    const many = Array.from(
      { length: MAX_TOKEN_EMBEDDED_KEYS + 5 },
      (_, index) => `k${String(index).padStart(3, "0")}`
    );
    expect(cubeConfig.getEmbeddedKeys({ edKeys: many })).toEqual(many.slice(0, MAX_TOKEN_EMBEDDED_KEYS));
  });

  test("selects the same keys the Cube model compiles", () => {
    const ranked = [...AWKWARD_KEYS, "", "   ", "z".repeat(129)];
    expect([...selectEmbeddedKeys(ranked)].sort()).toEqual(cubeConfig.getEmbeddedKeys({ edKeys: ranked }));
  });
});

describe("collectEmbeddedMemberNames", () => {
  const plan = "FeedbackRecords.ed_plan_64879f7d";
  const tier = "FeedbackRecords.ed_tier_0a1b2c3d";
  const region = "FeedbackRecords.ed_region_99887766";

  test("names none for an empty or non-object query", () => {
    expect(collectEmbeddedMemberNames({})).toEqual([]);
    expect(collectEmbeddedMemberNames(null)).toEqual([]);
    expect(collectEmbeddedMemberNames("FeedbackRecords.ed_plan_64879f7d")).toEqual([]);
  });

  test("counts a numeric twin as the member it reads, so its key reaches the token", () => {
    expect(
      collectEmbeddedMemberNames({
        dimensions: [plan],
        filters: [
          { member: "FeedbackRecords.edn_plan_64879f7d", operator: "gt", values: ["1"] },
          { member: "FeedbackRecords.edn_tier_0a1b2c3d", operator: "lt", values: ["9"] },
        ],
      }).sort()
    ).toEqual([plan, tier].sort());
  });

  test("collects every place a query names a member, nested filters included, once each", () => {
    expect(
      collectEmbeddedMemberNames({
        measures: ["FeedbackRecords.count"],
        dimensions: [plan, "FeedbackRecords.sourceName"],
        timeDimensions: [{ dimension: "FeedbackRecords.collectedAt" }],
        filters: [
          { member: tier, operator: "equals", values: [region] },
          { or: [{ and: [{ member: region, operator: "set" }] }, { member: plan, operator: "set" }] },
        ],
        order: [[plan, "asc"]],
      }).sort()
    ).toEqual([plan, region, tier].sort());
  });

  test("never reads a filter value as a member", () => {
    expect(
      collectEmbeddedMemberNames({ filters: [{ member: "FeedbackRecords.sourceName", values: [plan] }] })
    ).toEqual([]);
  });

  test("reads an order given as an object", () => {
    expect(collectEmbeddedMemberNames({ order: { [tier]: "desc" } })).toEqual([tier]);
  });
});
