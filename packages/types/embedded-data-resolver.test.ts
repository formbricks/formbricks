import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { ZEmbeddedData, ZLinkedEmbeddedField } from "./embedded-data";
import {
  RESERVED_FIELD_CATALOG,
  type TClientEmbeddedValueResponse,
  type TEmbeddedValueRef,
  type TEmbeddedValueResponse,
  type TLinkedEmbeddedField,
  type TReservedFieldCatalogEntry,
  coerceToEmbeddedDataType,
  deriveLegacyEmbeddedData,
  findComputedEmbeddedField,
  getComputedEmbeddedFields,
  getComputedFieldDataType,
  getDeclaredComputedFields,
  getDeclaredEmbeddedFields,
  getDeclaredIngestedStorageKeys,
  getIngestedEmbeddedFields,
  getIngestedStorageKeys,
  getLogicVariableValue,
  getSurveyEmbeddedFields,
  listReadableFields,
  projectClientReservedValues,
  projectReservedValues,
  resolveEmbeddedValue,
} from "./embedded-data-resolver";
import type { TI18nString } from "./i18n";
import { RESERVED_FIELD_NAMES } from "./reserved-field-names";
import type { TResponseData, TResponseVariables } from "./responses";
import type { TSurveyBlocks } from "./surveys/blocks";
import { TSurveyElementTypeEnum } from "./surveys/elements";

const SCORE_VARIABLE_ID = "clx0000000000000000000v1";
const DUAL_KEY = "clx0000000000000000000v2";

/** A response with every location the read seam can point at populated. */
const response: TEmbeddedValueResponse = {
  id: "clx0000000000000000000r1",
  surveyId: "clx0000000000000000000s1",
  createdAt: new Date("2026-08-01T09:00:00.000Z"),
  updatedAt: new Date("2026-08-01T09:05:00.000Z"),
  finished: true,
  language: "de",
  data: {
    plan: "premium",
    seats: "25",
    rating: 4,
    zero: "0",
    empty: "",
    opted_in: "TRUE",
    signup_date: "2026-08-06",
    bad_date: "banana",
    bad_number: "abc",
    multi: ["a", "b"],
    matrix: { row1: "col1" },
    [DUAL_KEY]: "from-data",
  },
  variables: {
    [SCORE_VARIABLE_ID]: 42,
    [DUAL_KEY]: "from-variables",
  },
  ttc: { q1: 10_000, _total: 30_000 },
  meta: {
    source: "web",
    url: "https://example.com?plan=premium",
    userAgent: { browser: "Chrome", os: "macOS" },
    country: "DE",
  },
};

/** A response where everything optional is absent — the "nothing was captured" case. */
const sparseResponse: TEmbeddedValueResponse = {
  id: "clx0000000000000000000r2",
  surveyId: "clx0000000000000000000s1",
  createdAt: new Date("2026-08-02T12:00:00.000Z"),
  updatedAt: new Date("2026-08-02T12:00:00.000Z"),
  finished: false,
  language: null,
  data: {},
  variables: {},
  meta: {},
};

const makeField = (
  overrides: Partial<TLinkedEmbeddedField["field"]> = {}
): TLinkedEmbeddedField["field"] => ({
  name: "Field",
  source: "ingested",
  dataType: "string",
  defaultValue: null,
  locked: false,
  ...overrides,
});

const resolve = (
  field: TLinkedEmbeddedField["field"],
  storageKey: string,
  onResponse: TEmbeddedValueResponse = response
) => resolveEmbeddedValue({ field, link: { storageKey } }, onResponse);

/**
 * Sample catalog entries — synthetic names on purpose, so the mechanism tests keep exercising the
 * seam rather than accidentally re-asserting the production catalog's contents (which have their own
 * describe block below).
 */
const countryEntry: TReservedFieldCatalogEntry = {
  name: "country",
  dataType: "string",
  availability: "server",
  privacy: "drop",
  read: (r) => r.meta.country,
};
const browserEntry: TReservedFieldCatalogEntry = {
  name: "browser",
  dataType: "string",
  availability: "server",
  privacy: "drop",
  read: (r) => r.meta.userAgent?.browser,
};
const totalTimeEntry: TReservedFieldCatalogEntry = {
  name: "total_time",
  dataType: "number",
  availability: "server",
  privacy: "keep",
  read: (r) => r.ttc?._total,
};
const languageEntry: TReservedFieldCatalogEntry = {
  name: "response_language",
  dataType: "string",
  availability: "both",
  privacy: "keep",
  read: (r) => r.language,
};
const completedEntry: TReservedFieldCatalogEntry = {
  name: "completed",
  dataType: "boolean",
  availability: "server",
  privacy: "keep",
  read: (r) => r.finished,
};
const startedAtEntry: TReservedFieldCatalogEntry = {
  name: "started_at",
  dataType: "date",
  availability: "server",
  privacy: "keep",
  read: (r) => r.createdAt,
};
const actionEntry: TReservedFieldCatalogEntry = {
  name: "action",
  dataType: "string",
  availability: "client",
  privacy: "keep",
  read: (r) => r.meta.action,
};

describe("resolveEmbeddedValue", () => {
  describe("computed fields read response.variables", () => {
    test("returns the value stored under the link's storageKey", () => {
      const field = makeField({ source: "computed", dataType: "number", defaultValue: 0 });
      expect(resolve(field, SCORE_VARIABLE_ID)).toBe(42);
    });

    test("reads variables, never data, when the same key exists in both", () => {
      const field = makeField({ source: "computed" });
      expect(resolve(field, DUAL_KEY)).toBe("from-variables");
    });

    test("coerces a string stored in variables to the field's number dataType", () => {
      const field = makeField({ source: "computed", dataType: "number" });
      const withStringScore: TEmbeddedValueResponse = {
        ...response,
        variables: { [SCORE_VARIABLE_ID]: "42" },
      };
      expect(resolve(field, SCORE_VARIABLE_ID, withStringScore)).toBe(42);
    });
  });

  describe("ingested fields read response.data", () => {
    test("returns the value stored under the link's storageKey", () => {
      expect(resolve(makeField(), "plan")).toBe("premium");
    });

    test("reads data, never variables, when the same key exists in both", () => {
      expect(resolve(makeField(), DUAL_KEY)).toBe("from-data");
    });

    test("coerces a string answer to the field's number dataType", () => {
      const field = makeField({ dataType: "number" });
      expect(resolve(field, "seats")).toBe(25);
    });

    test('treats "0" as a present number value, not as missing', () => {
      const field = makeField({ dataType: "number", defaultValue: 9 });
      expect(resolve(field, "zero")).toBe(0);
    });

    test("treats an empty string as a present string value, not as missing", () => {
      const field = makeField({ defaultValue: "fallback" });
      expect(resolve(field, "empty")).toBe("");
    });
  });

  describe("reserved catalog entries read through their typed accessor", () => {
    test("resolves a meta field", () => {
      expect(resolveEmbeddedValue({ entry: countryEntry }, response)).toBe("DE");
    });

    test("resolves a nested meta.userAgent field", () => {
      expect(resolveEmbeddedValue({ entry: browserEntry }, response)).toBe("Chrome");
    });

    test("resolves ttc._total", () => {
      expect(resolveEmbeddedValue({ entry: totalTimeEntry }, response)).toBe(30_000);
    });

    test("resolves a top-level field", () => {
      expect(resolveEmbeddedValue({ entry: languageEntry }, response)).toBe("de");
    });

    test("resolves a boolean field, where false is a value and not a gap", () => {
      expect(resolveEmbeddedValue({ entry: completedEntry }, response)).toBe(true);
      expect(resolveEmbeddedValue({ entry: completedEntry }, sparseResponse)).toBe(false);
    });

    test("resolves a Date-backed date field to its ISO string", () => {
      expect(resolveEmbeddedValue({ entry: startedAtEntry }, response)).toBe("2026-08-01T09:00:00.000Z");
    });

    test("returns undefined when the accessor finds nothing (no default tier for reserved)", () => {
      expect(resolveEmbeddedValue({ entry: countryEntry }, sparseResponse)).toBeUndefined();
      expect(resolveEmbeddedValue({ entry: totalTimeEntry }, sparseResponse)).toBeUndefined();
      expect(resolveEmbeddedValue({ entry: languageEntry }, sparseResponse)).toBeUndefined();
    });

    test("returns undefined for a stored row that claims source reserved", () => {
      // ZEmbeddedData rejects such rows; this arm only defends against data that skipped the schema.
      const field = makeField({ source: "reserved", defaultValue: "should-not-surface" });
      expect(resolve(field, "plan")).toBeUndefined();
    });

    test("a throwing accessor reads as missing instead of crashing the resolve", () => {
      const hostnameEntry: TReservedFieldCatalogEntry = {
        name: "hostname",
        dataType: "string",
        availability: "client",
        privacy: "redactQuery",
        read: (r) => new URL(r.meta.url ?? "").hostname,
      };
      // sparseResponse has no meta.url, so the accessor throws on `new URL("")` — the resolver must
      // treat that like every other dirty input: one field unset, no exception escaping.
      expect(resolveEmbeddedValue({ entry: hostnameEntry }, sparseResponse)).toBeUndefined();
      expect(resolveEmbeddedValue({ entry: hostnameEntry }, response)).toBe("example.com");
    });
  });

  describe("locked ingested fields", () => {
    test("resolve to the default even when data holds a value", () => {
      const field = makeField({ locked: true, defaultValue: "enterprise" });
      expect(resolve(field, "plan")).toBe("enterprise");
    });

    test("resolve to undefined when locked with no default, ignoring the stored value", () => {
      const field = makeField({ locked: true, defaultValue: null });
      expect(resolve(field, "plan")).toBeUndefined();
    });

    test("locked is ignored for computed fields, which never receive outside writes", () => {
      const field = makeField({ source: "computed", dataType: "number", locked: true, defaultValue: 0 });
      expect(resolve(field, SCORE_VARIABLE_ID)).toBe(42);
    });
  });

  describe("missing values fall back to defaultValue, then to undefined", () => {
    test("missing ingested value returns the default", () => {
      const field = makeField({ defaultValue: "fallback" });
      expect(resolve(field, "not-captured")).toBe("fallback");
    });

    test("missing ingested value with a null default returns undefined", () => {
      expect(resolve(makeField(), "not-captured")).toBeUndefined();
    });

    test("missing computed value returns the default", () => {
      const field = makeField({ source: "computed", dataType: "number", defaultValue: 0 });
      expect(resolve(field, "clx0000000000000000000v9")).toBe(0);
    });

    test("an uncoercible stored value is treated as missing and falls to the default", () => {
      const field = makeField({ dataType: "number", defaultValue: 7 });
      expect(resolve(field, "bad_number")).toBe(7);
    });

    test("an uncoercible stored value with a null default returns undefined", () => {
      const field = makeField({ dataType: "number", defaultValue: null });
      expect(resolve(field, "bad_number")).toBeUndefined();
    });

    test("a default that cannot be coerced to the dataType resolves to undefined", () => {
      // The schema forbids a mismatched default, so this only occurs for unparsed input — the
      // resolver still keeps its contract: the result agrees with dataType or is undefined.
      const field = makeField({ dataType: "number", defaultValue: "not-a-number" });
      expect(resolve(field, "not-captured")).toBeUndefined();
    });
  });

  describe("non-scalar response data (shared map with question answers)", () => {
    test("a string[] answer under the storage key is treated as missing", () => {
      const field = makeField({ defaultValue: "fallback" });
      expect(resolve(field, "multi")).toBe("fallback");
    });

    test("a record answer under the storage key is treated as missing", () => {
      expect(resolve(makeField(), "matrix")).toBeUndefined();
    });
  });

  test("a mixed field/link/entry shape is unrepresentable at compile time", () => {
    // This pin is enforced by `tsc` (this package's tsconfig includes *.test.ts, and an unused
    // expect-error directive fails the build), NOT by vitest — no CI workflow currently runs
    // typecheck, so the pin bites on local and agent `pnpm typecheck` runs only.
    const acceptsRef = (ref: TEmbeddedValueRef): TEmbeddedValueRef => ref;
    const mixed = { field: makeField(), link: { storageKey: "plan" }, entry: countryEntry };

    // @ts-expect-error — the `?: never` exclusion props reject a ref that is both shapes at once,
    // so the resolver never has to pick a winner silently. Fails typecheck if the props are removed.
    acceptsRef(mixed);

    // The exclusion props must not tax the two legitimate shapes.
    expect(acceptsRef({ field: makeField(), link: { storageKey: "plan" } })).toBeTruthy();
    expect(acceptsRef({ entry: countryEntry })).toBeTruthy();
  });

  test("a degenerate ref carrying entry: undefined resolves through its field, not the entry branch", () => {
    // The discriminator is definedness, not key presence — a `"entry" in ref` check would route
    // this object into the entry branch and crash on `undefined.read`.
    const ref: TEmbeddedValueRef = { field: makeField(), link: { storageKey: "plan" }, entry: undefined };
    expect(resolveEmbeddedValue(ref, response)).toBe("premium");
  });
});

describe("coerceToEmbeddedDataType", () => {
  describe("string", () => {
    test.each([
      ["hello", "hello"],
      ["", ""],
      [42, "42"],
      [true, "true"],
      [false, "false"],
    ])("coerces %p to %p", (input, expected) => {
      expect(coerceToEmbeddedDataType(input, "string")).toBe(expected);
    });

    test("coerces a Date to its ISO string", () => {
      expect(coerceToEmbeddedDataType(new Date("2026-08-01T09:00:00.000Z"), "string")).toBe(
        "2026-08-01T09:00:00.000Z"
      );
    });

    test.each([[["a", "b"]], [{ row1: "col1" }], [null], [undefined], [Number.NaN]])(
      "rejects %p",
      (input) => {
        expect(coerceToEmbeddedDataType(input, "string")).toBeUndefined();
      }
    );

    test("rejects an invalid Date instance instead of throwing on toISOString", () => {
      expect(coerceToEmbeddedDataType(new Date("banana"), "string")).toBeUndefined();
    });
  });

  describe("number", () => {
    test.each([
      [42, 42],
      [3.14, 3.14],
      ["42", 42],
      [" 7 ", 7],
      ["-1.5", -1.5],
      ["0", 0],
    ])("coerces %p to %p", (input, expected) => {
      expect(coerceToEmbeddedDataType(input, "number")).toBe(expected);
    });

    test.each<[unknown, string]>([
      ["", 'empty string — Number("") === 0 is an artifact, not data'],
      ["   ", "blank string"],
      ["abc", "non-numeric string"],
      ["25 seats", "partially numeric string — parseFloat would invent 25 where Number rejects"],
      [true, "boolean"],
      [Number.NaN, "NaN"],
      [Number.POSITIVE_INFINITY, "Infinity"],
      [new Date("2026-08-01"), "Date"],
      [["1"], "array"],
    ])("rejects %p (%s)", (input) => {
      expect(coerceToEmbeddedDataType(input, "number")).toBeUndefined();
    });
  });

  describe("boolean", () => {
    test.each([
      [true, true],
      [false, false],
      ["true", true],
      ["TRUE", true],
      [" False ", false],
    ])("coerces %p to %p", (input, expected) => {
      expect(coerceToEmbeddedDataType(input, "boolean")).toBe(expected);
    });

    test.each<[unknown, string]>([
      ["1", "numeric string — truthiness guessing is write-side ingest policy"],
      ["yes", "colloquial truthy string"],
      ["", "empty string"],
      [1, "number"],
      [0, "number"],
    ])("rejects %p (%s)", (input) => {
      expect(coerceToEmbeddedDataType(input, "boolean")).toBeUndefined();
    });
  });

  describe("date", () => {
    test("keeps an ISO date string as-is, not promoted to a midnight datetime", () => {
      expect(coerceToEmbeddedDataType("2026-08-06", "date")).toBe("2026-08-06");
    });

    test("keeps an ISO datetime string as-is", () => {
      expect(coerceToEmbeddedDataType("2026-08-06T10:30:00Z", "date")).toBe("2026-08-06T10:30:00Z");
    });

    test("coerces a Date instance to its ISO string", () => {
      expect(coerceToEmbeddedDataType(new Date("2026-08-06T10:30:00.000Z"), "date")).toBe(
        "2026-08-06T10:30:00.000Z"
      );
    });

    test("rejects an invalid Date instance", () => {
      expect(coerceToEmbeddedDataType(new Date("banana"), "date")).toBeUndefined();
    });

    test.each<[unknown, string]>([
      ["banana", "non-date string"],
      ["42", "would year-parse via new Date, which is not a date the user stored"],
      ["2026-13-45", "impossible calendar date"],
      ["06.08.2026", "non-ISO format — write-side coercion (ENG-1845) normalizes formats"],
      [1_723_000_000_000, "epoch number"],
      [true, "boolean"],
    ])("rejects %p (%s)", (input) => {
      expect(coerceToEmbeddedDataType(input, "date")).toBeUndefined();
    });

    test("accepts exactly the strings ZEmbeddedData accepts as date defaults — the two rules must not drift", () => {
      // Both files declare the ISO rule privately on purpose (each owns its side); this corpus is
      // the pin that keeps them the same rule. If either side alone gains offset/local acceptance,
      // a stored default becomes unresolvable (or vice versa) and this goes red.
      const dateDefaultRow = (defaultValue: string) => ({
        id: "clx0000000000000000000e1",
        createdAt: new Date("2026-08-01T09:00:00.000Z"),
        updatedAt: new Date("2026-08-01T09:00:00.000Z"),
        key: null,
        name: "Signup date",
        description: null,
        source: "ingested",
        dataType: "date",
        defaultValue,
        locked: false,
        surveyId: "clx0000000000000000000s1",
        workspaceId: "clx0000000000000000000w1",
      });

      const corpus = [
        "2026-08-06",
        "2026-08-06T10:30:00Z",
        "2026-08-06T10:30:00.123Z",
        "2026-08-06T10:30:00+02:00",
        "2026-08-06T10:30:00",
        " 2026-08-06",
      ];

      for (const candidate of corpus) {
        const rowAccepts = ZEmbeddedData.safeParse(dateDefaultRow(candidate)).success;
        const readAccepts = coerceToEmbeddedDataType(candidate, "date") !== undefined;
        expect({ candidate, readAccepts }).toStrictEqual({ candidate, readAccepts: rowAccepts });
      }
    });
  });
});

describe("projectReservedValues", () => {
  test("projects catalog entries into a name-keyed map, omitting absent values", () => {
    const projected = projectReservedValues(
      [browserEntry, totalTimeEntry, languageEntry, completedEntry, actionEntry],
      response
    );

    expect(projected).toStrictEqual({
      browser: "Chrome",
      total_time: 30_000,
      response_language: "de",
      // Booleans are stringified: the recall/logic maps have no boolean slot.
      completed: "true",
    });
    // meta.action was never captured, so the key must be absent — not null, not "".
    expect("action" in projected).toBe(false);
  });

  test("the projected map merges into the maps recall and logic already read", () => {
    const projected = projectReservedValues([browserEntry, totalTimeEntry], response);

    // Compile-time fit: assignable to both existing lookup-map types.
    const asVariables: TResponseVariables = projected;
    const asData: TResponseData = projected;

    // Runtime fit: a merged map serves reserved values through plain key lookup, the only access
    // pattern replaceRecallInfo / getLeftOperandValue use.
    const mergedVariables = { ...response.variables, ...asVariables };
    expect(mergedVariables.browser).toBe("Chrome");
    expect(mergedVariables[SCORE_VARIABLE_ID]).toBe(42);
    expect(asData.total_time).toBe(30_000);
  });

  test("projects an empty map when nothing was captured", () => {
    expect(projectReservedValues([countryEntry, totalTimeEntry], sparseResponse)).toStrictEqual({});
  });

  test("projects through the resolver's coercion — a Date-backed entry lands as its ISO string", () => {
    // The one entry kind where resolving differs from the raw read: a raw `Date` must never reach
    // the recall/logic maps.
    expect(projectReservedValues([startedAtEntry], response)).toStrictEqual({
      started_at: "2026-08-01T09:00:00.000Z",
    });
  });

  test("omits an entry whose raw value cannot be coerced to its dataType", () => {
    const miscastEntry: TReservedFieldCatalogEntry = {
      name: "total_time",
      dataType: "number",
      availability: "server",
      privacy: "keep",
      read: (r) => r.meta.source, // "web" — present, but not a number; projecting it would invent data
    };
    expect(projectReservedValues([miscastEntry], response)).toStrictEqual({});
  });

  test("keeps falsy-but-present values: false stringifies, empty string and zero stay in the map", () => {
    const emptySourceEntry: TReservedFieldCatalogEntry = {
      name: "empty_source",
      dataType: "string",
      availability: "client",
      privacy: "keep",
      read: () => "",
    };
    const zeroTimeEntry: TReservedFieldCatalogEntry = {
      name: "zero_time",
      dataType: "number",
      availability: "server",
      privacy: "keep",
      read: () => 0,
    };

    // sparseResponse has finished: false — a value, not a gap, exactly like "" and 0.
    expect(
      projectReservedValues([completedEntry, emptySourceEntry, zeroTimeEntry], sparseResponse)
    ).toStrictEqual({
      completed: "false",
      empty_source: "",
      zero_time: 0,
    });
  });

  test("a throwing accessor is skipped without aborting the rest of the catalog", () => {
    const hostnameEntry: TReservedFieldCatalogEntry = {
      name: "hostname",
      dataType: "string",
      availability: "client",
      privacy: "redactQuery",
      read: (r) => new URL(r.meta.url ?? "").hostname,
    };

    // meta emptied: the hostname accessor throws on `new URL("")`, and the entries after it must
    // still be evaluated.
    expect(projectReservedValues([hostnameEntry, languageEntry], { ...response, meta: {} })).toStrictEqual({
      response_language: "de",
    });
  });
});

describe("RESERVED_FIELD_CATALOG", () => {
  /** Every Tier-1 location captured — today's ingest shape, with IP capture enabled. */
  const capturedResponse: TEmbeddedValueResponse = {
    id: "clx0000000000000000000r3",
    surveyId: "clx0000000000000000000s2",
    createdAt: new Date("2026-08-01T09:00:00.000Z"),
    updatedAt: new Date("2026-08-01T09:02:30.000Z"),
    finished: true,
    language: "de",
    data: { plan: "premium" },
    variables: {},
    // Milliseconds, and deliberately not a whole number of seconds.
    ttc: { q1: 40_000, q2: 50_400, _total: 90_400 },
    meta: {
      source: "link",
      url: "https://example.com/pricing?utm_source=news&email=a@b.co",
      userAgent: { browser: "Chrome", os: "macOS", device: "desktop" },
      country: "DE",
      action: "Clicked Upgrade",
      ipAddress: "203.0.113.7",
    },
  };

  /**
   * A response stored years before this catalog existed: `meta` holds only what was captured then
   * (source + url), there is no `ttc` at all, and no language was selected. The catalog must resolve
   * what is there and report the rest as unset — never throw, and never invent a value.
   */
  const historicalResponse: TEmbeddedValueResponse = {
    id: "clx0000000000000000000r4",
    surveyId: "clx0000000000000000000s2",
    createdAt: new Date("2024-03-04T08:00:00.000Z"),
    updatedAt: new Date("2024-03-04T08:01:00.000Z"),
    finished: true,
    language: null,
    data: { plan: "free" },
    variables: {},
    meta: { source: "link", url: "https://example.com/old" },
  };

  const projectCatalog = (onResponse: TEmbeddedValueResponse) =>
    projectReservedValues(RESERVED_FIELD_CATALOG, onResponse);

  /** The named entry, failing loudly instead of resolving `undefined.read` if it is ever removed. */
  const catalogEntry = (name: string): TReservedFieldCatalogEntry => {
    const entry = RESERVED_FIELD_CATALOG.find((candidate) => candidate.name === name);
    if (!entry) throw new Error(`No reserved catalog entry named ${name}`);
    return entry;
  };

  test("declares exactly the Tier-1 entries, with their dataType, availability and privacy", () => {
    // The catalog is a product decision, so it is pinned as a table rather than probed field by
    // field: adding, removing or reclassifying an entry has to be a deliberate edit here too.
    // `status` is absent on purpose — `Response` has no status column and `finished` already carries
    // the complete/partial distinction.
    expect(
      RESERVED_FIELD_CATALOG.map(({ name, dataType, availability, privacy }) => ({
        name,
        dataType,
        availability,
        privacy,
      }))
    ).toStrictEqual([
      { name: "source", dataType: "string", availability: "client", privacy: "keep" },
      { name: "url", dataType: "string", availability: "client", privacy: "redactQuery" },
      { name: "country", dataType: "string", availability: "server", privacy: "drop" },
      { name: "action", dataType: "string", availability: "client", privacy: "keep" },
      { name: "browser", dataType: "string", availability: "server", privacy: "drop" },
      { name: "os", dataType: "string", availability: "server", privacy: "drop" },
      { name: "deviceType", dataType: "string", availability: "server", privacy: "drop" },
      { name: "ipAddress", dataType: "string", availability: "server", privacy: "drop" },
      { name: "finished", dataType: "boolean", availability: "server", privacy: "keep" },
      { name: "language", dataType: "string", availability: "both", privacy: "keep" },
      { name: "responseId", dataType: "string", availability: "server", privacy: "keep" },
      { name: "surveyId", dataType: "string", availability: "server", privacy: "keep" },
      { name: "durationSeconds", dataType: "number", availability: "server", privacy: "keep" },
      { name: "startedAt", dataType: "date", availability: "server", privacy: "keep" },
      { name: "finishedAt", dataType: "date", availability: "server", privacy: "keep" },
    ]);
  });

  test("every entry resolves against a fully captured response", () => {
    // One exact-map assertion rather than fifteen lookups: a missing key is a failed entry, and an
    // extra key is an entry nobody declared in the table above.
    expect(projectCatalog(capturedResponse)).toStrictEqual({
      source: "link",
      url: "https://example.com/pricing?utm_source=news&email=a@b.co",
      country: "DE",
      action: "Clicked Upgrade",
      browser: "Chrome",
      os: "macOS",
      deviceType: "desktop",
      ipAddress: "203.0.113.7",
      finished: "true",
      language: "de",
      responseId: "clx0000000000000000000r3",
      surveyId: "clx0000000000000000000s2",
      durationSeconds: 90,
      startedAt: "2026-08-01T09:00:00.000Z",
      finishedAt: "2026-08-01T09:02:30.000Z",
    });
  });

  test("resolves what a historical response captured and reports the rest as unset", () => {
    expect(projectCatalog(historicalResponse)).toStrictEqual({
      source: "link",
      url: "https://example.com/old",
      finished: "true",
      responseId: "clx0000000000000000000r4",
      surveyId: "clx0000000000000000000s2",
      startedAt: "2024-03-04T08:00:00.000Z",
      finishedAt: "2024-03-04T08:01:00.000Z",
    });
  });

  test("durationSeconds converts the stored milliseconds to whole seconds", () => {
    // ttc is milliseconds (MAX_RESPONSE_TTC in responses.ts), so a raw read would publish 90400
    // under a field named — and typed — in seconds.
    expect(projectCatalog(capturedResponse).durationSeconds).toBe(90);
  });

  test("durationSeconds is unset on a partial response rather than a duration-so-far", () => {
    // calculateTtcTotal is the only writer of `_total`, and every call site guards it behind
    // `finished ?` — so a partial response has per-element timings and no total. Summing them here
    // would report a duration no other surface agrees with.
    const partialResponse: TEmbeddedValueResponse = {
      ...capturedResponse,
      finished: false,
      ttc: { q1: 40_000, q2: 50_400 },
    };
    const projected = projectCatalog(partialResponse);

    expect("durationSeconds" in projected).toBe(false);
    expect(projected.finished).toBe("false");
  });

  test("startedAt and finishedAt resolve to ISO strings, never Date objects", () => {
    const startedAt = resolveEmbeddedValue({ entry: catalogEntry("startedAt") }, capturedResponse);
    const finishedAt = resolveEmbeddedValue({ entry: catalogEntry("finishedAt") }, capturedResponse);

    expect(startedAt).toBe("2026-08-01T09:00:00.000Z");
    expect(finishedAt).toBe("2026-08-01T09:02:30.000Z");
    // A raw Date reaching the recall/logic maps would render as a locale-dependent string.
    expect(startedAt).not.toBeInstanceOf(Date);
    expect(finishedAt).not.toBeInstanceOf(Date);
  });

  test("finished resolves as a boolean and projects as the string the maps can hold", () => {
    const entry = catalogEntry("finished");

    expect(resolveEmbeddedValue({ entry }, capturedResponse)).toBe(true);
    expect(resolveEmbeddedValue({ entry }, { ...capturedResponse, finished: false })).toBe(false);
    // false is a value, not a gap: it must survive the projection as "false", not vanish.
    expect(projectCatalog({ ...capturedResponse, finished: false }).finished).toBe("false");
  });

  test("no accessor throws on a response where every optional location is absent", () => {
    // The catalog runs over responses nobody curated; an accessor that assumed today's meta shape
    // would take a whole export loop down. sparseResponse is that worst case.
    expect(() => projectCatalog(sparseResponse)).not.toThrow();
    expect(projectCatalog(sparseResponse)).toStrictEqual({
      finished: "false",
      responseId: sparseResponse.id,
      surveyId: sparseResponse.surveyId,
      startedAt: "2026-08-02T12:00:00.000Z",
      finishedAt: "2026-08-02T12:00:00.000Z",
    });
  });

  test("RESERVED_FIELD_NAMES is exactly the catalog's names, lowercased", () => {
    // The blocklist is a hand-written leaf module (it cannot import the catalog without closing an
    // import cycle — see reserved-field-names.ts), so this is the only thing keeping the two in
    // step. A name added to one side and not the other fails here.
    expect([...RESERVED_FIELD_NAMES].sort()).toStrictEqual(
      RESERVED_FIELD_CATALOG.map((entry) => entry.name.toLowerCase()).sort()
    );
  });
});

describe("projectClientReservedValues", () => {
  /** What a running survey holds: no `id`, no `createdAt`/`updatedAt`, no final `finished`. */
  const midSurvey: TClientEmbeddedValueResponse = {
    surveyId: "clx0000000000000000000s2",
    language: "de",
    data: { plan: "premium" },
    variables: {},
    ttc: { q1: 40_000 },
    meta: { source: "link", url: "https://example.com/pricing", action: "Clicked Upgrade" },
  };

  test("projects only the entries a client can read mid-survey", () => {
    expect(projectClientReservedValues(RESERVED_FIELD_CATALOG, midSurvey)).toStrictEqual({
      source: "link",
      url: "https://example.com/pricing",
      action: "Clicked Upgrade",
      language: "de",
    });
  });

  test("never invokes a server-only accessor", () => {
    // Filtering by availability is not enough on its own: a server accessor invoked against the
    // client slice would read `undefined` and be dropped by coercion anyway, so the output would look
    // identical while the accessor had in fact run. Spies are what distinguish the two.
    const serverRead = vi.fn(() => "should never be read");
    const clientRead = vi.fn(() => "link");
    const bothRead = vi.fn(() => "de");

    const projected = projectClientReservedValues(
      [
        {
          name: "server_only",
          dataType: "string",
          availability: "server",
          privacy: "keep",
          read: serverRead,
        },
        {
          name: "client_only",
          dataType: "string",
          availability: "client",
          privacy: "keep",
          read: clientRead,
        },
        { name: "either_side", dataType: "string", availability: "both", privacy: "keep", read: bothRead },
      ],
      midSurvey
    );

    expect(projected).toStrictEqual({ client_only: "link", either_side: "de" });
    expect(serverRead).not.toHaveBeenCalled();
    expect(clientRead).toHaveBeenCalledTimes(1);
    expect(bothRead).toHaveBeenCalledTimes(1);
  });

  test("omits a client entry whose value has not been captured yet", () => {
    expect(
      projectClientReservedValues(RESERVED_FIELD_CATALOG, { ...midSurvey, language: null, meta: {} })
    ).toStrictEqual({});
  });
});

describe("listReadableFields", () => {
  const blocks: TSurveyBlocks = [
    {
      id: "clx0000000000000000000b1",
      name: "Block 1",
      elements: [
        {
          id: "q1",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "What is your name?" },
          required: false,
          inputType: "text",
          charLimit: { enabled: false },
        },
        {
          id: "q2",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "<p>Rate <b>us</b></p>" },
          required: false,
          inputType: "text",
          charLimit: { enabled: false },
        },
      ],
    },
    {
      id: "clx0000000000000000000b2",
      name: "Block 2",
      elements: [
        {
          id: "q3",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "#recall:q1/fallback:there# how are you?" },
          required: false,
          inputType: "text",
          charLimit: { enabled: false },
        },
        {
          id: "q4",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "" },
          required: false,
          inputType: "text",
          charLimit: { enabled: false },
        },
        {
          id: "q5",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "How likely?", de: "Wie wahrscheinlich?" },
          required: false,
          inputType: "text",
          charLimit: { enabled: false },
        },
      ],
    },
  ];

  const embeddedDataPairs: TLinkedEmbeddedField[] = [
    {
      field: makeField({ name: "Score", source: "computed", dataType: "number", defaultValue: 0 }),
      link: { storageKey: SCORE_VARIABLE_ID },
    },
    { field: makeField({ name: "Plan" }), link: { storageKey: "plan" } },
  ];

  test("returns all four groups, each entry keyed by its reference key", () => {
    const fields = listReadableFields({
      blocks,
      embeddedData: embeddedDataPairs,
      reservedEntries: [countryEntry, totalTimeEntry],
      contactAttributeKeys: [
        { key: "email", name: "Email address" },
        { key: "user_id", name: null },
      ],
    });

    expect(fields.question.map((field) => field.key)).toEqual(["q1", "q2", "q3", "q4", "q5"]);
    expect(fields.embeddedData).toEqual([
      { key: SCORE_VARIABLE_ID, label: "Score" },
      { key: "plan", label: "Plan" },
    ]);
    expect(fields.reserved).toEqual([
      { key: "country", label: "Country" },
      { key: "total_time", label: "Total Time" },
    ]);
    expect(fields.contactAttribute).toEqual([
      { key: "email", label: "Email address" },
      { key: "user_id", label: "user_id" },
    ]);
  });

  test("question labels come from headlines: HTML stripped, recall flattened, empty falls back to id", () => {
    const fields = listReadableFields({
      blocks,
      embeddedData: [],
      reservedEntries: [],
      contactAttributeKeys: [],
    });

    expect(fields.question).toEqual([
      { key: "q1", label: "What is your name?" },
      { key: "q2", label: "Rate us" },
      { key: "q3", label: "___ how are you?" },
      { key: "q4", label: "q4" },
      { key: "q5", label: "How likely?" },
    ]);
  });

  test("resolves headlines for the requested language, falling back to default", () => {
    const fields = listReadableFields({
      blocks,
      embeddedData: [],
      reservedEntries: [],
      contactAttributeKeys: [],
      languageCode: "de",
    });

    const q5 = fields.question.find((field) => field.key === "q5");
    const q1 = fields.question.find((field) => field.key === "q1");
    expect(q5?.label).toBe("Wie wahrscheinlich?");
    expect(q1?.label).toBe("What is your name?");
  });

  const singleElementBlocks = (elementId: string, headline: TI18nString): TSurveyBlocks => [
    {
      id: "clx0000000000000000000b3",
      name: "Block",
      elements: [
        {
          id: elementId,
          type: TSurveyElementTypeEnum.OpenText,
          headline,
          required: false,
          inputType: "text",
          charLimit: { enabled: false },
        },
      ],
    },
  ];

  test("a blank locale entry falls back to the default headline, not to a blank label", () => {
    // Blank locale entries are a real stored shape; today's apps/web picker labels this case with
    // the bare element id (its getLocalizedValue has no default fallback) — this pins the improved,
    // packages/surveys-style semantics the module documents.
    const fields = listReadableFields({
      blocks: singleElementBlocks("q6", { default: "How likely?", de: "" }),
      embeddedData: [],
      reservedEntries: [],
      contactAttributeKeys: [],
      languageCode: "de",
    });

    expect(fields.question).toEqual([{ key: "q6", label: "How likely?" }]);
  });

  test("flattens every recall token in a headline, not only the first", () => {
    const fields = listReadableFields({
      blocks: singleElementBlocks("q7", {
        default: "#recall:q1/fallback:a# and #recall:q2/fallback:b#",
      }),
      embeddedData: [],
      reservedEntries: [],
      contactAttributeKeys: [],
    });

    expect(fields.question).toEqual([{ key: "q7", label: "___ and ___" }]);
  });

  test("a non-string default in unparsed survey JSON degrades to the id fallback instead of throwing", () => {
    // prisma-json-types reads skip zod, so dirty i18n objects are representable at runtime.
    const dirtyHeadline = { default: 42 } as unknown as TI18nString;
    const fields = listReadableFields({
      blocks: singleElementBlocks("q8", dirtyHeadline),
      embeddedData: [],
      reservedEntries: [],
      contactAttributeKeys: [],
    });

    expect(fields.question).toEqual([{ key: "q8", label: "q8" }]);
  });

  test("reserved labels fall back to the entry name when title-casing yields nothing", () => {
    const underscoreEntry: TReservedFieldCatalogEntry = {
      name: "_",
      dataType: "string",
      availability: "server",
      privacy: "keep",
      read: () => undefined,
    };
    const fields = listReadableFields({
      blocks: [],
      embeddedData: [],
      reservedEntries: [underscoreEntry],
      contactAttributeKeys: [],
    });

    expect(fields.reserved).toEqual([{ key: "_", label: "_" }]);
  });

  test("embedded data labels fall back to the storageKey when the definition name is blank", () => {
    // ZEmbeddedData forbids blank names, but derived legacy pairs carry plain variable names.
    const fields = listReadableFields({
      blocks: [],
      embeddedData: [{ field: makeField({ name: "   " }), link: { storageKey: "plan" } }],
      reservedEntries: [],
      contactAttributeKeys: [],
    });

    expect(fields.embeddedData).toEqual([{ key: "plan", label: "plan" }]);
  });

  test("contact attribute labels fall back to the key when the name is blank", () => {
    const fields = listReadableFields({
      blocks: [],
      embeddedData: [],
      reservedEntries: [],
      contactAttributeKeys: [{ key: "user_id", name: "" }],
    });

    expect(fields.contactAttribute).toEqual([{ key: "user_id", label: "user_id" }]);
  });

  test("returns four empty groups for empty inputs", () => {
    const fields = listReadableFields({
      blocks: [],
      embeddedData: [],
      reservedEntries: [],
      contactAttributeKeys: [],
    });

    expect(fields).toStrictEqual({ question: [], embeddedData: [], reserved: [], contactAttribute: [] });
  });
});

describe("deriveLegacyEmbeddedData", () => {
  const legacySurvey = {
    variables: [
      { id: "clx0000000000000000000v1", name: "score", type: "number" as const, value: 10 },
      { id: "clx0000000000000000000v3", name: "plan_name", type: "text" as const, value: "basic" },
    ],
    hiddenFields: { enabled: true, fieldIds: ["source_page", "Coupon-Code"] },
  };

  test("maps a variable to a computed field addressed by its existing cuid", () => {
    const [scorePair] = deriveLegacyEmbeddedData(legacySurvey);
    expect(scorePair).toStrictEqual({
      field: { name: "score", source: "computed", dataType: "number", defaultValue: 10, locked: false },
      link: { storageKey: "clx0000000000000000000v1" },
    });
  });

  test("maps a text variable to a string field with its value as default", () => {
    const pairs = deriveLegacyEmbeddedData(legacySurvey);
    expect(pairs[1]).toStrictEqual({
      field: {
        name: "plan_name",
        source: "computed",
        dataType: "string",
        defaultValue: "basic",
        locked: false,
      },
      link: { storageKey: "clx0000000000000000000v3" },
    });
  });

  test("maps hidden fields to ingested string fields addressed by name, keeping legacy spellings", () => {
    const pairs = deriveLegacyEmbeddedData(legacySurvey);
    expect(pairs.slice(2)).toStrictEqual([
      {
        field: {
          name: "source_page",
          source: "ingested",
          dataType: "string",
          defaultValue: null,
          locked: false,
        },
        link: { storageKey: "source_page" },
      },
      {
        field: {
          name: "Coupon-Code",
          source: "ingested",
          dataType: "string",
          defaultValue: null,
          locked: false,
        },
        link: { storageKey: "Coupon-Code" },
      },
    ]);
  });

  test("derives declared hidden fields even when hiddenFields is disabled", () => {
    // Recall and logic consult fieldIds alone today — and the link-survey URL path ingests values
    // even when disabled — so deriving must not hide fields that may hold data.
    const pairs = deriveLegacyEmbeddedData({
      variables: [],
      hiddenFields: { enabled: false, fieldIds: ["plan"] },
    });
    expect(pairs).toHaveLength(1);
    expect(pairs[0].link.storageKey).toBe("plan");
  });

  test("handles absent fieldIds and fully empty declarations", () => {
    expect(deriveLegacyEmbeddedData({ variables: [], hiddenFields: { enabled: true } })).toEqual([]);
    expect(
      deriveLegacyEmbeddedData({ variables: [], hiddenFields: { enabled: false, fieldIds: [] } })
    ).toEqual([]);
  });

  test("derived pairs resolve end-to-end through resolveEmbeddedValue", () => {
    const pairs = deriveLegacyEmbeddedData(legacySurvey);

    // The variable's value arrives under its cuid in response.variables.
    expect(resolveEmbeddedValue(pairs[0], response)).toBe(42);
    // No stored value → the variable's declared value serves as the default.
    expect(resolveEmbeddedValue(pairs[0], sparseResponse)).toBe(10);
    // Hidden fields read response.data under their name; absent ones stay unset (null default).
    expect(resolveEmbeddedValue(pairs[2], sparseResponse)).toBeUndefined();
  });

  test("derived pairs enumerate through listReadableFields keyed by storageKey", () => {
    const fields = listReadableFields({
      blocks: [],
      embeddedData: deriveLegacyEmbeddedData(legacySurvey),
      reservedEntries: [],
      contactAttributeKeys: [],
    });

    expect(fields.embeddedData).toEqual([
      { key: "clx0000000000000000000v1", label: "score" },
      { key: "clx0000000000000000000v3", label: "plan_name" },
      { key: "source_page", label: "source_page" },
      { key: "Coupon-Code", label: "Coupon-Code" },
    ]);
  });
});

describe("getSurveyEmbeddedFields", () => {
  const legacySurvey = {
    variables: [{ id: "clx0000000000000000000v1", name: "score", type: "number" as const, value: 10 }],
    hiddenFields: { enabled: true, fieldIds: ["source_page"] },
  };

  const rows: TLinkedEmbeddedField[] = [
    {
      field: {
        name: "renamed_score",
        source: "computed",
        dataType: "number",
        defaultValue: 7,
        locked: false,
      },
      link: { storageKey: "clx0000000000000000000v1" },
    },
  ];

  test("uses the joined rows when the survey carries them", () => {
    expect(getSurveyEmbeddedFields({ ...legacySurvey, embeddedFields: rows })).toStrictEqual(rows);
  });

  test("reports nothing when the select omitted the join, rather than reading the columns", () => {
    // ENG-2412 removed the legacy fallback: the rows are the whole answer. The consequence is that
    // every survey select reaching a reader has to carry `selectSurveyEmbeddedDataLinks` — one that
    // does not makes the survey read as having no Embedded Data at all.
    expect(getSurveyEmbeddedFields(legacySurvey)).toStrictEqual([]);
    expect(getSurveyEmbeddedFields({ ...legacySurvey, embeddedFields: null })).toStrictEqual([]);
    expect(deriveLegacyEmbeddedData(legacySurvey)).not.toStrictEqual([]);
  });

  test("an empty row list means no fields, so deleting a survey's rows removes them", () => {
    // Previously this fell back to the columns, which is why deleting a survey's rows made its
    // fields reappear. Now they disappear, which is what the tables being the source of truth means.
    expect(getSurveyEmbeddedFields({ ...legacySurvey, embeddedFields: [] })).toStrictEqual([]);
  });

  test("a survey with no fields at all answers [] through either path", () => {
    const empty = { variables: [], hiddenFields: { enabled: false, fieldIds: [] } };
    expect(getSurveyEmbeddedFields(empty)).toEqual([]);
    expect(getSurveyEmbeddedFields({ ...empty, embeddedFields: [] })).toEqual([]);
  });

  test("partitions by source, preserving the inlined order within each group", () => {
    const survey = {
      ...legacySurvey,
      embeddedFields: [
        ...rows,
        {
          field: {
            name: "utm_source",
            source: "ingested" as const,
            dataType: "string" as const,
            defaultValue: null,
            locked: false,
          },
          link: { storageKey: "utm_source" },
        },
        {
          field: {
            name: "plan",
            source: "ingested" as const,
            dataType: "string" as const,
            defaultValue: null,
            locked: false,
          },
          link: { storageKey: "plan" },
        },
      ],
    };

    expect(getComputedEmbeddedFields(survey)).toStrictEqual([rows[0]]);
    expect(getIngestedStorageKeys(survey)).toStrictEqual(["utm_source", "plan"]);
    expect(getIngestedEmbeddedFields(survey).map(({ field }) => field.name)).toStrictEqual([
      "utm_source",
      "plan",
    ]);
  });

  test("the partitions report nothing too, rather than falling back independently", () => {
    expect(getComputedEmbeddedFields(legacySurvey)).toStrictEqual([]);
    expect(getIngestedStorageKeys(legacySurvey)).toStrictEqual([]);
  });
});

describe("ZLinkedEmbeddedField mirrors TLinkedEmbeddedField", () => {
  const pair: TLinkedEmbeddedField = {
    field: { name: "score", source: "computed", dataType: "number", defaultValue: 10, locked: false },
    link: { storageKey: "clx0000000000000000000v1" },
  };

  test("a TLinkedEmbeddedField parses, and the parsed value is assignable back", () => {
    const parsed = ZLinkedEmbeddedField.parse(pair);
    // Compile-time half of the check: the inferred type must satisfy the interface, and vice versa.
    const roundTripped: TLinkedEmbeddedField = parsed;
    const asSchemaType: z.infer<typeof ZLinkedEmbeddedField> = pair;
    expect(roundTripped).toStrictEqual(pair);
    expect(asSchemaType).toStrictEqual(pair);
  });

  test("every field deriveLegacyEmbeddedData produces round-trips through the schema", () => {
    const derived = deriveLegacyEmbeddedData({
      variables: [
        { id: "clx0000000000000000000v1", name: "score", type: "number", value: 10 },
        { id: "clx0000000000000000000v3", name: "plan_name", type: "text", value: "basic" },
      ],
      hiddenFields: { enabled: true, fieldIds: ["source_page", "Coupon-Code"] },
    });

    expect(z.array(ZLinkedEmbeddedField).parse(derived)).toStrictEqual(derived);
  });

  test("strips nothing the readers need, and rejects a blank name or storage key", () => {
    // The valid pair parses, so the rejections below are the rules firing and not the whole shape
    // being refused.
    expect(ZLinkedEmbeddedField.safeParse(pair).success).toBe(true);

    expect(ZLinkedEmbeddedField.safeParse({ ...pair, field: { ...pair.field, name: "  " } }).success).toBe(
      false
    );
    expect(ZLinkedEmbeddedField.safeParse({ ...pair, link: { storageKey: "" } }).success).toBe(false);
    // Whitespace-only, not just empty: an ingested field's storage key is its URL param name, so a
    // padded `" plan "` would never match `?plan=` while still counting as a distinct field under
    // `@@unique([surveyId, storageKey])`. Rejected twice over — by the blank check and by the
    // legacy-charset rule — so removing either one alone keeps this passing.
    expect(ZLinkedEmbeddedField.safeParse({ ...pair, link: { storageKey: "  " } }).success).toBe(false);
  });
});

describe("getDeclaredEmbeddedFields", () => {
  const legacySurvey = {
    variables: [{ id: "clx0000000000000000000v1", name: "score", type: "number" as const, value: 10 }],
    hiddenFields: { enabled: true, fieldIds: ["source_page"] },
  };

  const staleRows: TLinkedEmbeddedField[] = [
    {
      field: { name: "old_name", source: "computed", dataType: "string", defaultValue: "", locked: false },
      link: { storageKey: "clx0000000000000000000v1" },
    },
  ];

  test("ignores the stored rows and answers from the declarations", () => {
    // The editor's working copy carries the rows as of the last save, so a rename or a newly added
    // field is only visible through this accessor.
    expect(getDeclaredEmbeddedFields({ ...legacySurvey, embeddedFields: staleRows })).toStrictEqual(
      deriveLegacyEmbeddedData(legacySurvey)
    );
    expect(getSurveyEmbeddedFields({ ...legacySurvey, embeddedFields: staleRows })).toStrictEqual(staleRows);
  });

  test("partitions the declarations the same way the stored accessor does", () => {
    expect(getDeclaredComputedFields(legacySurvey).map(({ field }) => field.name)).toStrictEqual(["score"]);
    expect(getDeclaredIngestedStorageKeys(legacySurvey)).toStrictEqual(["source_page"]);
  });

  test("still answers from the declarations when the rows are a superset", () => {
    // A row for a field the survey no longer declares: the stored accessor keeps it, the declared
    // accessor does not. Asserted with a genuinely differing pair rather than two runs of the same
    // derivation, which could not fail.
    const withExtraRow = {
      ...legacySurvey,
      embeddedFields: [
        ...deriveLegacyEmbeddedData(legacySurvey),
        {
          field: {
            name: "removed",
            source: "ingested" as const,
            dataType: "string" as const,
            defaultValue: null,
            locked: false,
          },
          link: { storageKey: "removed" },
        },
      ],
    };

    expect(getDeclaredIngestedStorageKeys(withExtraRow)).toStrictEqual(["source_page"]);
    expect(getIngestedStorageKeys(withExtraRow)).toStrictEqual(["source_page", "removed"]);
  });
});

/**
 * The logic engines' read of a computed field. Lives here because
 * `packages/surveys/src/lib/logic.ts` and `apps/web/lib/surveyLogic/utils.ts` are near-copies and
 * both consume it — one definition of the value-preservation rule instead of two that can drift.
 */
describe("getLogicVariableValue", () => {
  const computedField = (storageKey: string, dataType: "number" | "string", defaultValue: number | string) =>
    ({
      field: { name: storageKey, source: "computed" as const, dataType, defaultValue, locked: false },
      link: { storageKey },
    }) satisfies TLinkedEmbeddedField;

  const numberField = computedField("score", "number", 5);
  const textField = computedField("tier", "string", "gold");
  const fields = [numberField, textField];

  test("reads a stored value under the field's declared type", () => {
    expect(getLogicVariableValue(fields, "score", { score: 42 })).toBe(42);
    expect(getLogicVariableValue(fields, "tier", { tier: "silver" })).toBe("silver");
  });

  test("a number field coerces its stored value, numeric strings included", () => {
    expect(getLogicVariableValue(fields, "score", { score: "42" })).toBe(42);
  });

  // The four cases below are the deltas `resolveEmbeddedValue` deliberately does not reproduce.
  // Swapping this helper onto it would change what already-stored responses evaluate to, and
  // responses are never migrated — so each one is asserted against the declared default it must NOT
  // fall back to.
  test("delta (a): a non-numeric stored value is 0, never the declared default", () => {
    expect(getLogicVariableValue(fields, "score", { score: "abc" })).toBe(0);
  });

  test('delta (a): a string field holding 0 is "", never "0"', () => {
    expect(getLogicVariableValue(fields, "tier", { tier: 0 })).toBe("");
  });

  test('delta (d): a response missing the key is 0 / "", never the declared default', () => {
    expect(getLogicVariableValue(fields, "score", {})).toBe(0);
    expect(getLogicVariableValue(fields, "tier", {})).toBe("");
  });

  test("a key the survey does not declare resolves to undefined, not to a coerced blank", () => {
    // Distinct from the "missing value" cases above: there is no field, so there is no type to
    // evaluate under, and the caller must be able to tell the two apart.
    expect(getLogicVariableValue(fields, "deleted_variable", { deleted_variable: 7 })).toBeUndefined();
  });
});

describe("getComputedFieldDataType", () => {
  const fields: TLinkedEmbeddedField[] = [
    {
      field: { name: "score", source: "computed", dataType: "number", defaultValue: 5, locked: false },
      link: { storageKey: "score" },
    },
  ];

  test("answers the declared type", () => {
    expect(getComputedFieldDataType(fields, "score")).toBe("number");
  });

  test("answers undefined for a field the survey no longer declares, instead of throwing", () => {
    // The guard both engines depend on: this runs before the operator switch, and a throw here is
    // swallowed by `evaluateSingleCondition`'s try/catch into a silent `false`.
    expect(getComputedFieldDataType(fields, "deleted_variable")).toBeUndefined();
    expect(findComputedEmbeddedField(fields, "deleted_variable")).toBeUndefined();
  });
});
