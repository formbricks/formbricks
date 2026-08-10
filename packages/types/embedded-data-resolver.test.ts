import { describe, expect, test } from "vitest";
import {
  RESERVED_FIELD_CATALOG,
  type TEmbeddedValueRef,
  type TEmbeddedValueResponse,
  type TLinkedEmbeddedField,
  type TReservedFieldCatalogEntry,
  coerceToEmbeddedDataType,
  deriveLegacyEmbeddedData,
  listReadableFields,
  projectReservedValues,
  resolveEmbeddedValue,
} from "./embedded-data-resolver";
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

/** Sample catalog entries — contents live in the tests only; the production catalog is ENG-1839's. */
const countryEntry: TReservedFieldCatalogEntry = {
  name: "country",
  dataType: "string",
  read: (r) => r.meta.country,
};
const browserEntry: TReservedFieldCatalogEntry = {
  name: "browser",
  dataType: "string",
  read: (r) => r.meta.userAgent?.browser,
};
const totalTimeEntry: TReservedFieldCatalogEntry = {
  name: "total_time",
  dataType: "number",
  read: (r) => r.ttc?._total,
};
const languageEntry: TReservedFieldCatalogEntry = {
  name: "response_language",
  dataType: "string",
  read: (r) => r.language,
};
const completedEntry: TReservedFieldCatalogEntry = {
  name: "completed",
  dataType: "boolean",
  read: (r) => r.finished,
};
const startedAtEntry: TReservedFieldCatalogEntry = {
  name: "started_at",
  dataType: "date",
  read: (r) => r.createdAt,
};
const actionEntry: TReservedFieldCatalogEntry = {
  name: "action",
  dataType: "string",
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
    const acceptsRef = (ref: TEmbeddedValueRef): TEmbeddedValueRef => ref;
    const mixed = { field: makeField(), link: { storageKey: "plan" }, entry: countryEntry };

    // @ts-expect-error — the `?: never` exclusion props reject a ref that is both shapes at once,
    // so the resolver never has to pick a winner silently. Fails typecheck if the props are removed.
    acceptsRef(mixed);

    // The exclusion props must not tax the two legitimate shapes.
    expect(acceptsRef({ field: makeField(), link: { storageKey: "plan" } })).toBeTruthy();
    expect(acceptsRef({ entry: countryEntry })).toBeTruthy();
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

  test("the production catalog is empty until ENG-1839 and projects to an empty map", () => {
    expect(RESERVED_FIELD_CATALOG).toHaveLength(0);
    expect(projectReservedValues(RESERVED_FIELD_CATALOG, response)).toStrictEqual({});
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
    // Recall and logic consult fieldIds alone today; a disabled field just never receives a value.
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
