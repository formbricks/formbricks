import { describe, expect, test, vi } from "vitest";
import {
  V3_CONTACTS_MAX_FILTER_PARAMS,
  V3_CONTACTS_MAX_IN_VALUES,
  computeV3ContactsFingerprint,
  decodeV3ContactsCursor,
  parseV3ContactsListQuery,
  resolveV3ContactAttributeFilters,
} from "./parse-v3-contacts-list-query";

// The cursor binding is a hash; the global `createHash` mock would make every fingerprint equal.
vi.mock("node:crypto", async (importOriginal) => await importOriginal<typeof import("node:crypto")>());
vi.mock("crypto", async (importOriginal) => await importOriginal<typeof import("crypto")>());

const workspaceId = "clws0000000000000000000001";

const params = (entries: [string, string][] = []): URLSearchParams =>
  new URLSearchParams([["workspaceId", workspaceId], ...entries]);

const keys = [
  { id: "clak0000000000000000000001", key: "plan", dataType: "string" as const },
  { id: "clak0000000000000000000002", key: "seats", dataType: "number" as const },
  { id: "clak0000000000000000000003", key: "renewal", dataType: "date" as const },
];

const parseOk = (entries: [string, string][] = []) => {
  const result = parseV3ContactsListQuery(params(entries));
  if (!result.ok) throw new Error(JSON.stringify(result.invalid_params));
  return result;
};

const resolve = (entries: [string, string][]) =>
  resolveV3ContactAttributeFilters(parseOk(entries).attributeFilters, keys);

describe("parseV3ContactsListQuery", () => {
  test("applies the defaults", () => {
    expect(parseOk()).toEqual({
      ok: true,
      workspaceId,
      limit: 50,
      cursor: undefined,
      includeTotalCount: false,
      search: undefined,
      sortBy: "-createdAt",
      createdAtGte: undefined,
      createdAtLte: undefined,
      attributeFilters: [],
    });
  });

  test("parses search, sort, includeTotalCount and the createdAt range", () => {
    const result = parseOk([
      ["search", "  ada  "],
      ["sortBy", "createdAt"],
      ["includeTotalCount", "true"],
      ["limit", "250"],
      ["filter[createdAt][gte]", "2026-01-01T00:00:00+02:00"],
      ["filter[createdAt][lte]", "2026-02-01T00:00:00Z"],
    ]);
    expect(result).toMatchObject({
      search: "ada",
      sortBy: "createdAt",
      includeTotalCount: true,
      limit: 250,
      createdAtGte: new Date("2025-12-31T22:00:00.000Z"),
      createdAtLte: new Date("2026-02-01T00:00:00.000Z"),
    });
  });

  test.each([
    ["an unknown parameter", [["foo", "bar"]], "foo"],
    ["a limit above 250", [["limit", "251"]], "limit"],
    ["an unknown sort", [["sortBy", "name"]], "sortBy"],
    [
      "a date without an offset",
      [["filter[createdAt][gte]", "2026-01-01T00:00:00"]],
      "filter[createdAt][gte]",
    ],
    ["an unknown operator", [["filter[attribute.plan][like]", "x"]], "filter[attribute.plan][like]"],
    ["a malformed filter key", [["filter[plan][eq]", "x"]], "filter[plan][eq]"],
    [
      "a repeated single-value operator",
      [
        ["filter[attribute.plan][eq]", "a"],
        ["filter[attribute.plan][eq]", "b"],
      ],
      "filter[attribute.plan][eq]",
    ],
    [
      "a repeated fixed parameter",
      [
        ["sortBy", "createdAt"],
        ["sortBy", "-createdAt"],
      ],
      "sortBy",
    ],
    ["a NULL byte in search", [["search", "a\u0000b"]], "search"],
  ] as [string, [string, string][], string][])("rejects %s", (_label, entries, name) => {
    const result = parseV3ContactsListQuery(params(entries));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.invalid_params.map((p) => p.name)).toContain(name);
  });

  test("rejects an inverted createdAt range", () => {
    const result = parseV3ContactsListQuery(
      params([
        ["filter[createdAt][gte]", "2026-02-01T00:00:00Z"],
        ["filter[createdAt][lte]", "2026-01-01T00:00:00Z"],
      ])
    );
    expect(result.ok).toBe(false);
  });

  test("caps the number of distinct filter parameters", () => {
    const entries = Array.from(
      { length: V3_CONTACTS_MAX_FILTER_PARAMS + 1 },
      (_unused, index): [string, string] => [`filter[attribute.key${String(index)}][eq]`, "x"]
    );
    expect(parseV3ContactsListQuery(params(entries))).toEqual({
      ok: false,
      invalid_params: [{ name: "filter", reason: "At most 50 filter parameters are allowed." }],
    });
  });

  test("counts the repeated keys of one in filter once, and caps its values at 100", () => {
    const atCap = Array.from({ length: V3_CONTACTS_MAX_IN_VALUES }, (_unused, index): [string, string] => [
      "filter[attribute.plan][in]",
      `v${String(index)}`,
    ]);
    expect(parseV3ContactsListQuery(params(atCap)).ok).toBe(true);

    const overCap: [string, string][] = [...atCap, ["filter[attribute.plan][in]", "one-more"]];
    expect(parseV3ContactsListQuery(params(overCap))).toEqual({
      ok: false,
      invalid_params: [
        { name: "filter[attribute.plan][in]", reason: "At most 100 values are allowed per filter." },
      ],
    });
  });

  test("caps a comma-separated number in filter at 100 values", () => {
    const numbers = Array.from({ length: V3_CONTACTS_MAX_IN_VALUES + 1 }, (_u, i) => String(i)).join(",");
    expect(resolve([["filter[attribute.seats][in]", numbers]]).ok).toBe(false);
  });

  test("accepts a repeated AND-able text operator and keeps every distinct value", () => {
    expect(
      parseOk([
        ["filter[attribute.plan][notContains]", "trial"],
        ["filter[attribute.plan][notContains]", "legacy"],
        ["filter[attribute.plan][notContains]", "trial"],
      ]).attributeFilters
    ).toEqual([
      {
        param: "filter[attribute.plan][notContains]",
        key: "plan",
        operator: "notContains",
        values: ["trial", "legacy"],
      },
    ]);
  });

  test.each(["gt", "gte", "isSet"])("still rejects a repeated %s", (operator) => {
    const name = `filter[attribute.seats][${operator}]`;
    const result = parseV3ContactsListQuery(
      params([
        [name, "1"],
        [name, "2"],
      ])
    );
    expect(result.ok).toBe(false);
  });

  test("keeps every repeated in value verbatim, commas included", () => {
    const result = parseOk([
      ["filter[attribute.plan][in]", "Berlin, Germany"],
      ["filter[attribute.plan][in]", "Paris"],
    ]);
    expect(result.attributeFilters).toEqual([
      {
        param: "filter[attribute.plan][in]",
        key: "plan",
        operator: "in",
        values: ["Berlin, Germany", "Paris"],
      },
    ]);
  });
});

describe("resolveV3ContactAttributeFilters", () => {
  test.each(["in", "eq", "ne", "contains", "notContains", "startsWith", "endsWith", "isSet", "isNotSet"])(
    "accepts the string operator %s",
    (operator) => {
      const resolved = resolve([[`filter[attribute.plan][${operator}]`, "pro"]]);
      expect(resolved.ok).toBe(true);
      if (resolved.ok) {
        expect(resolved.filters[0]).toMatchObject({
          attributeKeyId: "clak0000000000000000000001",
          dataType: "string",
          operator,
          values: operator === "isSet" || operator === "isNotSet" ? [] : ["pro"],
        });
      }
    }
  );

  test.each(["in", "eq", "ne", "gt", "gte", "lt", "lte"])(
    "accepts the number operator %s and types its value",
    (operator) => {
      const resolved = resolve([[`filter[attribute.seats][${operator}]`, "12.5"]]);
      expect(resolved).toEqual({
        ok: true,
        filters: [
          {
            key: "seats",
            attributeKeyId: "clak0000000000000000000002",
            dataType: "number",
            operator,
            values: [12.5],
          },
        ],
      });
    }
  );

  test("number in accepts repeated and comma-separated values", () => {
    const resolved = resolve([
      ["filter[attribute.seats][in]", "1,2"],
      ["filter[attribute.seats][in]", "3"],
    ]);
    expect(resolved.ok && resolved.filters[0].values).toEqual([1, 2, 3]);
  });

  test.each(["gte", "lte"])("accepts the date operator %s", (operator) => {
    const resolved = resolve([[`filter[attribute.renewal][${operator}]`, "2026-05-01T00:00:00+00:00"]]);
    expect(resolved.ok && resolved.filters[0].values).toEqual([new Date("2026-05-01T00:00:00.000Z")]);
  });

  test("ignores the value of isSet / isNotSet", () => {
    const resolved = resolve([
      ["filter[attribute.seats][isSet]", "true"],
      ["filter[attribute.renewal][isNotSet]", "anything"],
    ]);
    expect(resolved.ok && resolved.filters.map((f) => f.values)).toEqual([[], []]);
  });

  test.each([
    ["contains on a number key", "filter[attribute.seats][contains]", "1"],
    ["greaterThan on a string key", "filter[attribute.plan][gt]", "1"],
    ["equals on a date key", "filter[attribute.renewal][eq]", "2026-01-01T00:00:00Z"],
    ["gte on a string key", "filter[attribute.plan][gte]", "a"],
  ])("rejects %s", (_label, param, value) => {
    const resolved = resolve([[param, value]]);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.invalid_params[0].name).toBe(param);
  });

  test.each([
    ["a non-numeric number", "filter[attribute.seats][eq]", "ten"],
    ["an infinite number", "filter[attribute.seats][eq]", "Infinity"],
    ["a date without an offset", "filter[attribute.renewal][gte]", "2026-01-01"],
    ["an empty string value", "filter[attribute.plan][eq]", ""],
  ])("rejects %s", (_label, param, value) => {
    expect(resolve([[param, value]]).ok).toBe(false);
  });

  test("rejects an unknown attribute key", () => {
    expect(resolve([["filter[attribute.nope][eq]", "x"]])).toEqual({
      ok: false,
      invalid_params: [{ name: "filter[attribute.nope][eq]", reason: 'Unknown attribute key "nope".' }],
    });
  });
});

describe("contacts cursor binding", () => {
  const base = { workspaceId, search: undefined, createdAtGte: undefined, createdAtLte: undefined };

  test("the fingerprint changes with any filter", () => {
    const plain = computeV3ContactsFingerprint(base, []);
    const resolved = resolve([["filter[attribute.plan][eq]", "pro"]]);
    if (!resolved.ok) throw new Error("expected ok");

    expect(computeV3ContactsFingerprint(base, resolved.filters)).not.toBe(plain);
    expect(computeV3ContactsFingerprint({ ...base, search: "a" }, [])).not.toBe(plain);
    expect(computeV3ContactsFingerprint({ ...base, workspaceId: "clws0000000000000000000002" }, [])).not.toBe(
      plain
    );
  });

  test("valueless operators still bind the cursor", () => {
    const isSet = resolve([["filter[attribute.plan][isSet]", "true"]]);
    if (!isSet.ok) throw new Error("expected ok");
    expect(computeV3ContactsFingerprint(base, isSet.filters)).not.toBe(
      computeV3ContactsFingerprint(base, [])
    );
  });

  test("a malformed cursor is a 400 naming cursor", () => {
    expect(decodeV3ContactsCursor("%%%", "-createdAt", "fp")).toEqual({
      ok: false,
      invalid_params: [{ name: "cursor", reason: "The cursor is invalid." }],
    });
    expect(decodeV3ContactsCursor(undefined, "-createdAt", "fp")).toEqual({ ok: true, cursor: null });
  });
});
