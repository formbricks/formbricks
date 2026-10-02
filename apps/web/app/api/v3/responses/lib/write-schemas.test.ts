import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import * as generated from "@formbricks/api-v3-schemas";
import {
  EXPECTED_UNENFORCED,
  collectOperationExamples,
  diffAgainstSpec,
  parametersAsObjectSchema,
  readBundle,
  unenforcedKey,
  validatorFor,
} from "@formbricks/api-v3-schemas/testing";
import {
  MAX_RESPONSE_DATA_KEYS,
  MAX_RESPONSE_DATA_VALUES,
  ZV3BatchDeleteResponsesBody,
  ZV3BatchDeleteResponsesQuery,
  ZV3CreateResponseBody,
  ZV3PatchResponseBody,
  ZV3ResponseIdParams,
  ZV3ResponseValidationRequestBody,
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
  // The patch body reuses the create body's capped `data` schema, so the caps must come with it — a
  // separate schema here would be the obvious way to lose them.
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
 * The caps live twice: as the constants above, and as `maxProperties` / `maxItems` in the contract.
 * The request shapes are generated from the contract, but these keywords are exactly the ones the
 * generator cannot carry, so the numbers are refinements here — and nothing but these tests ties a
 * constant to the bound the contract publishes.
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

/**
 * The generated request shapes cannot enforce `uniqueItems`, `minProperties`/`maxProperties` or the
 * `if/then` value caps, so the package pins each such constraint (`EXPECTED_UNENFORCED`) and names
 * this module as its enforcer. Every pin needs a counterexample here that the route schema rejects at
 * the right path; the set comparison makes a new pin fail until someone writes one.
 */
describe("every constraint the generator cannot express is enforced here", () => {
  const ID = "clrs1234567890123456789012";
  const keys = (n: number, value: unknown) =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, value]));
  const tooManyValues = Array.from({ length: MAX_RESPONSE_DATA_VALUES + 1 }, () => "v");
  const tooManyRows = keys(MAX_RESPONSE_DATA_VALUES + 1, "col");
  const createBody = (extra: Record<string, unknown>) => ({
    surveyId: ID,
    finished: false,
    data: {},
    ...extra,
  });

  type TCase = { schema: z.ZodType; input: unknown; path: (string | number)[] };
  const createData = (data: unknown): TCase => ({
    schema: ZV3CreateResponseBody,
    input: createBody({ data }),
    path: ["data"],
  });
  const CASES: Record<string, TCase[]> = {
    "BatchDeleteResponsesRequest $.ids uniqueItems": [
      { schema: ZV3BatchDeleteResponsesBody, input: { ids: [ID, ID] }, path: ["ids"] },
    ],
    "CreateResponseRequest $.data maxProperties": [createData(keys(MAX_RESPONSE_DATA_KEYS + 1, "a"))],
    "CreateResponseRequest $.data{} conditional": [
      { ...createData({ q: tooManyValues }), path: ["data", "q"] },
      { ...createData({ q: tooManyRows }), path: ["data", "q"] },
    ],
    "CreateResponseRequest $.embeddedData maxProperties": [
      {
        schema: ZV3CreateResponseBody,
        input: createBody({ embeddedData: keys(MAX_RESPONSE_DATA_KEYS + 1, "v") }),
        path: ["embeddedData"],
      },
    ],
    "CreateResponseRequest $.tags uniqueItems": [
      { schema: ZV3CreateResponseBody, input: createBody({ tags: [ID, ID] }), path: ["tags"] },
    ],
    "CreateResponseRequest $.ttc maxProperties": [
      {
        schema: ZV3CreateResponseBody,
        input: createBody({ ttc: keys(MAX_RESPONSE_DATA_KEYS + 1, 1) }),
        path: ["ttc"],
      },
    ],
    "PatchResponseRequest $ minProperties": [{ schema: ZV3PatchResponseBody, input: {}, path: [] }],
    "PatchResponseRequest $.data maxProperties": [
      {
        schema: ZV3PatchResponseBody,
        input: { data: keys(MAX_RESPONSE_DATA_KEYS + 1, "a") },
        path: ["data"],
      },
    ],
    "PatchResponseRequest $.data{} conditional": [
      { schema: ZV3PatchResponseBody, input: { data: { q: tooManyValues } }, path: ["data", "q"] },
      { schema: ZV3PatchResponseBody, input: { data: { q: tooManyRows } }, path: ["data", "q"] },
    ],
    "PatchResponseRequest $.embeddedData maxProperties": [
      {
        schema: ZV3PatchResponseBody,
        input: { embeddedData: keys(MAX_RESPONSE_DATA_KEYS + 1, "v") },
        path: ["embeddedData"],
      },
    ],
    // The input maps are only ever parsed inside a body, so their pins are proven through one.
    "ResponseDataMapInput $ maxProperties": [createData(keys(MAX_RESPONSE_DATA_KEYS + 1, "a"))],
    "ResponseDataMapInput ${} conditional": [{ ...createData({ q: tooManyValues }), path: ["data", "q"] }],
    "ResponseEmbeddedDataInput $ maxProperties": [
      {
        schema: ZV3CreateResponseBody,
        input: createBody({ embeddedData: keys(MAX_RESPONSE_DATA_KEYS + 1, "v") }),
        path: ["embeddedData"],
      },
    ],
    "ResponseTtcMap $ maxProperties": [
      {
        schema: ZV3CreateResponseBody,
        input: createBody({ ttc: keys(MAX_RESPONSE_DATA_KEYS + 1, 1) }),
        path: ["ttc"],
      },
    ],
    "ValidateResponseCreateRequest $ requiredAtRuntime": [
      { schema: ZV3ResponseValidationRequestBody, input: { operation: "create" }, path: ["data"] },
    ],
    "ValidateResponsePatchRequest $ requiredAtRuntime": [
      {
        schema: ZV3ResponseValidationRequestBody,
        input: { operation: "patch", responseId: ID },
        path: ["data"],
      },
    ],
  };

  const pins = EXPECTED_UNENFORCED.filter(
    (pin) => pin.enforcedBy === "apps/web/app/api/v3/responses/lib/schemas.ts"
  );

  test("every pin this module enforces has a counterexample, and no counterexample is stale", () => {
    expect(Object.keys(CASES).sort()).toEqual(pins.map(unenforcedKey).sort());
  });

  test.each(
    Object.entries(CASES).flatMap(([key, cases]) => cases.map((c, i) => [`${key} #${i + 1}`, c] as const))
  )("%s is rejected at its path", (_key, { schema, input, path }) => {
    const result = schema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toContainEqual(path);
  });
});

describe("the route schemas match the contract", () => {
  const bundle = readBundle();
  // A runtime-checked pin disappears once the refinement enforces it; only the structural ones remain,
  // because JSON Schema cannot show a refinement.
  const pinned = (schema: string) =>
    EXPECTED_UNENFORCED.filter((pin) => pin.schema === schema && pin.keyword !== "requiredAtRuntime")
      .map((pin) => `${pin.path} ${pin.keyword}`)
      .sort();

  /**
   * The refinement layer may only add what the contract states and the generator dropped. Diffing the
   * wrapped schema against the contract — not only the generated one — catches an override that
   * weakens a field, e.g. a refined `tags` that lost its `max(100)`.
   */
  test.each([
    ["CreateResponseRequest", ZV3CreateResponseBody],
    ["PatchResponseRequest", ZV3PatchResponseBody],
    ["BatchDeleteResponsesRequest", ZV3BatchDeleteResponsesBody],
    ["ValidateResponseRequest", ZV3ResponseValidationRequestBody],
    // The envelope is a union, which the runtime required-key check does not enter; each arm is
    // compared on its own so the `data` presence rule is proven per variant.
    ["ValidateResponseCreateRequest", ZV3ResponseValidationRequestBody.options[0]],
    ["ValidateResponsePatchRequest", ZV3ResponseValidationRequestBody.options[1]],
  ])("%s differs only by its pinned constraints", (name, schema) => {
    const diffs = diffAgainstSpec(bundle, { $ref: `#/components/schemas/${name}` }, schema);
    expect(diffs.map((diff) => `${diff.path} ${diff.attr}`).sort()).toEqual(pinned(name));
  });

  /**
   * OpenAPI cannot close a parameter list, so the generated parameter objects strip unknown keys. The
   * routes refuse them instead — the only difference from the contract, and a deliberate one.
   */
  test.each([
    ["getResponseV3", "path", ZV3ResponseIdParams],
    ["batchDeleteResponsesV3", "query", ZV3BatchDeleteResponsesQuery],
  ] as const)("%s %s parameters match the contract, closed", (operationId, location, schema) => {
    const spec = parametersAsObjectSchema(bundle, operationId, location);
    expect(spec).toBeDefined();
    if (spec)
      expect(diffAgainstSpec(bundle, spec, schema)).toEqual([
        { path: "$", attr: "closed", spec: false, zod: true },
      ]);
  });

  const components = new Map<string, z.ZodType>([
    ...Object.entries(generated as Record<string, unknown>).flatMap(([name, value]) =>
      value instanceof z.ZodType && name.startsWith("z") ? [[name.slice(1), value] as const] : []
    ),
    ["CreateResponseRequest", ZV3CreateResponseBody],
    ["PatchResponseRequest", ZV3PatchResponseBody],
    ["BatchDeleteResponsesRequest", ZV3BatchDeleteResponsesBody],
    ["ValidateResponseRequest", ZV3ResponseValidationRequestBody],
  ]);
  const requestExamples = collectOperationExamples(
    bundle,
    new Set(["createResponseV3", "updateResponseV3", "batchDeleteResponsesV3", "validateResponseV3"])
  ).filter((example) => example.label.includes(" request "));

  test.each(requestExamples.map((example) => [example.label, example] as const))(
    "the contract example %s parses through the route schema",
    (_label, example) => {
      const result = validatorFor(example.schema, components).safeParse(example.value);
      expect(result.error?.issues ?? []).toEqual([]);
    }
  );
});
