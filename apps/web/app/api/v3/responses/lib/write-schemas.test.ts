import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  MAX_RESPONSE_DATA_KEYS,
  MAX_RESPONSE_DATA_VALUES,
  ZV3CreateResponseBody,
  ZV3PatchResponseBody,
} from "./schemas";

vi.mock("server-only", () => ({}));

const SURVEY_ID = "clsv000000000000000000001";
const create = (over: Record<string, unknown> = {}) =>
  ZV3CreateResponseBody.safeParse({ surveyId: SURVEY_ID, finished: false, data: {}, ...over });

describe("ZV3CreateResponseBody", () => {
  test("the three required fields are enough", () => {
    expect(create().success).toBe(true);
  });

  test.each(["surveyId", "finished", "data"])("%s is required", (field) => {
    const body: Record<string, unknown> = { surveyId: SURVEY_ID, finished: false, data: {} };
    delete body[field];

    expect(ZV3CreateResponseBody.safeParse(body).success).toBe(false);
  });

  /** The contract's `uniqueItems`. Duplicates would make the applied set unreconcilable with what was sent. */
  test("duplicate tag ids are refused", () => {
    const dup = "cltg000000000000000000001";

    expect(create({ tags: [dup, dup] }).success).toBe(false);
    expect(create({ tags: [dup] }).success).toBe(true);
  });

  test.each([
    ["a string answer", "text"],
    ["a number answer", 7],
    ["a multi-select answer", ["a", "b"]],
    ["a matrix answer", { row: "agree" }],
  ])("data accepts %s", (_label, value) => {
    expect(create({ data: { q1: value } }).success).toBe(true);
  });

  // ENG-1652 cardinality caps. Nothing bounded these before: a single request inside the 2 MB body
  // limit could store an array of tens of thousands of entries, and every later reader pays per
  // entry — the serializer, export columns, and the "Other" filter's positional probe, whose window
  // is sized from the survey's choice count rather than from the stored array (ENG-3161).
  test("a multi-select answer is capped at 1000 entries", () => {
    const entries = (count: number) => Array.from({ length: count }, (_unused, i) => `c${i}`);

    expect(create({ data: { q1: entries(1_000) } }).success).toBe(true);
    expect(create({ data: { q1: entries(1_001) } }).success).toBe(false);
  });

  test("a matrix answer is capped at 1000 rows", () => {
    const rows = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_unused, i) => [`r${i}`, "agree"]));

    expect(create({ data: { q1: rows(1_000) } }).success).toBe(true);
    expect(create({ data: { q1: rows(1_001) } }).success).toBe(false);
  });

  test("a response is capped at 500 answered fields", () => {
    const fields = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_unused, i) => [`q${i}`, "text"]));

    expect(create({ data: fields(500) }).success).toBe(true);
    expect(create({ data: fields(501) }).success).toBe(false);
  });

  test("data refuses a shape no element can store", () => {
    expect(create({ data: { q1: { nested: { deep: 1 } } } }).success).toBe(false);
  });

  test.each([
    ["a string", "enterprise"],
    ["a number", 42],
    ["a boolean", true],
    ["null, which clears", null],
  ])("embeddedData accepts %s", (_label, value) => {
    expect(create({ embeddedData: { plan: value } }).success).toBe(true);
  });

  test("embeddedData refuses an array", () => {
    expect(create({ embeddedData: { plan: ["a"] } }).success).toBe(false);
  });

  /** Server-owned and never writable, whatever the caller intends by sending them. */
  test.each(["createdAt", "updatedAt", "userId", "contactAttributes", "variables"])(
    "%s is rejected rather than ignored",
    (field) => {
      expect(create({ [field]: "x" }).success).toBe(false);
    }
  );

  test.each(["country", "userAgent", "ipAddress", "utmSource", "pagePath"])(
    "meta.%s is rejected — the route derives it, so a supplied value would be fiction",
    (field) => {
      expect(create({ meta: { [field]: "x" } }).success).toBe(false);
    }
  );

  test("meta accepts the three the contract admits", () => {
    expect(
      create({ meta: { source: "zendesk", url: "https://x.test/t/1", action: "clicked" } }).success
    ).toBe(true);
  });

  /**
   * Bounded for two concrete reasons, both of which turn a caller mistake into a 500 otherwise: an
   * empty string skips the truthiness-gated uniqueness pre-check and is still written, and an
   * oversize one overflows the (surveyId, singleUseId) btree entry, raising a Postgres 54000 that is
   * not a P2002.
   */
  test("an empty singleUseId is refused rather than written", () => {
    expect(create({ singleUseId: "" }).success).toBe(false);
  });

  test("an oversize singleUseId is refused before it can reach the index", () => {
    expect(create({ singleUseId: "x".repeat(256) }).success).toBe(false);
    expect(create({ singleUseId: "x".repeat(255) }).success).toBe(true);
  });

  test("both shapes a real single-use link carries still fit", () => {
    // A plaintext cuid2, and an encrypted one at roughly a hundred characters.
    expect(create({ singleUseId: "clsu1234567890123456789012" }).success).toBe(true);
    expect(create({ singleUseId: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6:" + "f".repeat(64) }).success).toBe(true);
  });

  /** Clamped server-side rather than rejected, so only a non-number fails here. */
  test("ttc takes any number, including one past the clamp", () => {
    expect(create({ ttc: { q1: 999_999_999 } }).success).toBe(true);
    expect(create({ ttc: { q1: "fast" } }).success).toBe(false);
  });
});

describe("ZV3PatchResponseBody", () => {
  // The patch body reuses `createFields.data`, so the caps must come with it — a separate schema
  // here would be the obvious way to lose them.
  test("inherits the create body's data caps", () => {
    const wide = Object.fromEntries(Array.from({ length: 501 }, (_unused, i) => [`q${i}`, "text"]));

    expect(ZV3PatchResponseBody.safeParse({ data: wide }).success).toBe(false);
    expect(
      ZV3PatchResponseBody.safeParse({ data: { q1: Array.from({ length: 1_001 }, () => "c") } }).success
    ).toBe(false);
  });

  test("an empty body is refused — a caller sending nothing has a bug", () => {
    expect(ZV3PatchResponseBody.safeParse({}).success).toBe(false);
  });

  test.each(["finished", "endingId", "language", "data", "embeddedData", "tags"])(
    "%s alone is a valid patch",
    (field) => {
      const value = { finished: true, endingId: null, language: null, data: {}, embeddedData: {}, tags: [] }[
        field as "finished"
      ];

      expect(ZV3PatchResponseBody.safeParse({ [field]: value }).success).toBe(true);
    }
  );

  /** Timing and submission context describe the original event, so they are set once and not revised. */
  test.each(["meta", "ttc", "surveyId", "contactId", "displayId", "singleUseId", "createdAt"])(
    "%s is create-only and rejected on patch",
    (field) => {
      expect(ZV3PatchResponseBody.safeParse({ finished: true, [field]: "x" }).success).toBe(false);
    }
  );

  /** Unlike create: a patch applies tags as a set, so a repeat is redundant rather than ambiguous. */
  test("repeated tag ids are accepted on patch", () => {
    const dup = "cltg000000000000000000001";

    expect(ZV3PatchResponseBody.safeParse({ tags: [dup, dup] }).success).toBe(true);
  });
});

/**
 * The caps live twice: as Zod above, and as `maxProperties` / `maxItems` in the hand-authored
 * contract. `resources.spec-drift.test.ts` guards that seam for the *response* payload, but it
 * compares property names and requiredness — not numeric constraints — and it does not cover request
 * bodies at all. So nothing tied these two numbers together, and a change to one would have published
 * a bound the API does not enforce, or enforced one it never published.
 *
 * Read as text rather than parsed as YAML: the values under test are literals, so a regex is enough
 * and it avoids adding a parser to the unit suite. Same approach as `mcp-oauth-resource-seed.test.ts`.
 */
describe("ResponseDataMap contract bounds match the schema", () => {
  const schema = (name: string): string =>
    readFileSync(
      resolve(process.cwd(), `../../docs/api-v3-reference/src/components/schemas/${name}.yml`),
      "utf8"
    );

  const declared = (name: string, keyword: string): number[] =>
    [...schema(name).matchAll(new RegExp(`${keyword}:\\s*(\\d+)`, "g"))].map((match) => Number(match[1]));

  test("the key cap is published as maxProperties on the input map", () => {
    // The map's own cap is the first maxProperties in the file; the matrix value's cap is the second.
    expect(declared("ResponseDataMapInput", "maxProperties")[0]).toBe(MAX_RESPONSE_DATA_KEYS);
  });

  test("the value caps are published for both the array and the matrix shapes", () => {
    expect(declared("ResponseDataMapInput", "maxItems")).toEqual([MAX_RESPONSE_DATA_VALUES]);
    expect(declared("ResponseDataMapInput", "maxProperties").slice(1)).toEqual([MAX_RESPONSE_DATA_VALUES]);
  });

  /**
   * The bounds are enforced by the request schema only. `ResponseDataMap` is what the read returns,
   * and the v1 and v2 write paths store the same map uncapped — so a response can legitimately carry
   * more than these bounds allow, and publishing them on the read shape would make
   * `GET /api/v3/responses/{responseId}` describe payloads it actually returns as invalid. Putting
   * them there is the mistake this guards, because nothing else would fail: the Zod bounds are
   * request-side already, so the contract would simply lie until a big enough stored response met a
   * response-validating client.
   */
  test("the read map publishes no bounds — stored data may exceed what a v3 write accepts", () => {
    expect(declared("ResponseDataMap", "maxProperties")).toEqual([]);
    expect(declared("ResponseDataMap", "maxItems")).toEqual([]);
  });

  /**
   * The input composes the read map and adds bounds. It must not restate which value shapes are
   * allowed: a second copy of that `oneOf` would go stale the moment the read union gained a shape,
   * and the failure is silent in the worse direction — the write schema would start rejecting a value
   * the read schema hands out, while every bound still looked correct. Bounding by `if/then` on the
   * two shapes that have a cardinality keeps one source of truth for the union.
   */
  /**
   * `embeddedData` and `ttc` are the other two element-keyed maps on this body, and both are stored.
   * They carry the same key cap, so the contract has to publish it in the same place — these two are
   * request-only schemas (`ResponseResource` names `ResponseEmbeddedDataInput` in prose but does not
   * `$ref` it), so the bound sits on them directly rather than needing an input split.
   */
  test.each([
    ["ResponseEmbeddedDataInput", "embeddedData"],
    ["ResponseTtcMap", "ttc"],
  ])("%s publishes the same key cap the schema enforces on %s", (file) => {
    expect(declared(file, "maxProperties")).toEqual([MAX_RESPONSE_DATA_KEYS]);
  });

  test("the input map bounds the read map without re-declaring its value union", () => {
    const input = schema("ResponseDataMapInput");
    // Comments are stripped first: the prose above the bounds explains why the union is *not* restated
    // here, and naming `oneOf` to say so must not trip the check that no `oneOf` is declared.
    const declarations = input
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n");

    expect(input).toContain("$ref: ./ResponseDataMap.yml");
    expect(declarations).not.toContain("oneOf:");
  });
});

/**
 * `data` was capped first; these are the other two stored, element-keyed maps on the same body.
 * `embeddedData` matters most: an unmatched name is echoed back in both `name` and `reason` of its own
 * `invalid_params` entry, so uncapped it turns a large request into a larger rejection.
 */
describe("the other element-keyed maps carry the same key cap", () => {
  const body = (extra: Record<string, unknown>) => ({
    surveyId: "clct0000000000000000000001",
    finished: false,
    data: {},
    ...extra,
  });
  const keys = (n: number, value: unknown) =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, value]));

  test.each([
    ["embeddedData", "v"],
    ["ttc", 1],
  ])("%s accepts the cap and refuses one more", (field, value) => {
    const at = ZV3CreateResponseBody.safeParse(body({ [field]: keys(MAX_RESPONSE_DATA_KEYS, value) }));
    const over = ZV3CreateResponseBody.safeParse(body({ [field]: keys(MAX_RESPONSE_DATA_KEYS + 1, value) }));

    expect(at.success).toBe(true);
    expect(over.success).toBe(false);
    if (!over.success) {
      expect(over.error.issues[0].path).toEqual([field]);
    }
  });
});
