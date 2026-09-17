import { describe, expect, test } from "vitest";
import { ZEmbeddedData } from "./embedded-data";
import {
  type TDesiredEmbeddedField,
  linkedToDesiredEmbeddedFields,
  toDesiredEmbeddedFields,
  toLegacyEmbeddedFields,
} from "./embedded-data-mapping";
import { coerceToEmbeddedDataType } from "./embedded-data-resolver";
import { type TSurveyVariable, ZSurveyHiddenFields, ZSurveyVariable } from "./surveys/types";

/** Wraps a mapped field in the row it would be written as, so the two schemas can be checked together. */
const asStoredRow = (field: TDesiredEmbeddedField) => ({
  id: "clx000000000000000000009",
  createdAt: new Date(),
  updatedAt: new Date(),
  key: null,
  description: null,
  locked: false,
  surveyId: "clx000000000000000000008",
  workspaceId: "clx000000000000000000007",
  name: field.name,
  source: field.source,
  dataType: field.dataType,
  defaultValue: field.defaultValue,
});

const numberVariable: TSurveyVariable = {
  id: "clx000000000000000000001",
  name: "score",
  type: "number",
  value: 42,
};

const textVariable: TSurveyVariable = {
  id: "clx000000000000000000002",
  name: "tier",
  type: "text",
  value: "gold",
};

describe("toDesiredEmbeddedFields", () => {
  test("returns nothing for a survey with neither variables nor hidden fields", () => {
    expect(toDesiredEmbeddedFields({})).toEqual([]);
    expect(toDesiredEmbeddedFields({ variables: [], hiddenFields: { enabled: true, fieldIds: [] } })).toEqual(
      []
    );
    expect(toDesiredEmbeddedFields({ variables: null, hiddenFields: null })).toEqual([]);
  });

  test("maps a number variable to a computed number field addressed by its cuid", () => {
    expect(toDesiredEmbeddedFields({ variables: [numberVariable] })).toEqual([
      {
        storageKey: "clx000000000000000000001",
        name: "score",
        source: "computed",
        dataType: "number",
        defaultValue: 42,
        locked: false,
        key: null,
      },
    ]);
  });

  test("maps a text variable to a computed string field", () => {
    expect(toDesiredEmbeddedFields({ variables: [textVariable] })).toEqual([
      {
        storageKey: "clx000000000000000000002",
        name: "tier",
        source: "computed",
        dataType: "string",
        defaultValue: "gold",
        locked: false,
        key: null,
      },
    ]);
  });

  test("maps a hidden field to an ingested string field addressed by its name", () => {
    expect(toDesiredEmbeddedFields({ hiddenFields: { enabled: true, fieldIds: ["plan"] } })).toEqual([
      {
        storageKey: "plan",
        name: "plan",
        source: "ingested",
        dataType: "string",
        defaultValue: null,
        locked: false,
        key: null,
      },
    ]);
  });

  test("keeps a legacy hidden field name exactly as stored", () => {
    // Uppercase and hyphens are legal in stored hidden field ids. Normalising one here would move
    // the address its recall tokens and stored responses already use.
    const [field] = toDesiredEmbeddedFields({ hiddenFields: { enabled: true, fieldIds: ["Brand-Name"] } });
    expect(field.storageKey).toBe("Brand-Name");
    expect(field.name).toBe("Brand-Name");
  });

  test("ignores hiddenFields.enabled, which is a survey-level toggle rather than a field", () => {
    const disabled = toDesiredEmbeddedFields({ hiddenFields: { enabled: false, fieldIds: ["plan"] } });
    const enabled = toDesiredEmbeddedFields({ hiddenFields: { enabled: true, fieldIds: ["plan"] } });
    expect(disabled).toEqual(enabled);
  });

  test("returns variables before hidden fields, both in input order", () => {
    const fields = toDesiredEmbeddedFields({
      variables: [numberVariable, textVariable],
      hiddenFields: { enabled: true, fieldIds: ["plan", "campaign"] },
    });
    expect(fields.map((field) => field.storageKey)).toEqual([
      "clx000000000000000000001",
      "clx000000000000000000002",
      "plan",
      "campaign",
    ]);
  });

  describe("legacy names longer than any create-time cap", () => {
    // The legacy schemas put no length limit on a variable name or a hidden field id, and the column
    // is TEXT, so a stored survey can carry one of these. Everything the backfill can move therefore
    // has to survive the round trip — a row that writes but cannot be read back is the worst outcome,
    // because it only surfaces once ENG-1837 points readers at these tables.
    const longName = "a".repeat(300);

    test("the legacy schemas accept them, which is why this matters", () => {
      expect(
        ZSurveyVariable.safeParse({ id: "clx000000000000000000001", name: longName, type: "text", value: "" })
          .success
      ).toBe(true);
      expect(ZSurveyHiddenFields.safeParse({ enabled: true, fieldIds: [longName] }).success).toBe(true);
    });

    test("a long hidden field name maps and reads back, keeping its storage key", () => {
      const [field] = toDesiredEmbeddedFields({ hiddenFields: { enabled: true, fieldIds: [longName] } });

      expect(field.storageKey).toBe(longName);
      expect(ZEmbeddedData.safeParse(asStoredRow(field)).success).toBe(true);
    });

    test("a long variable name maps and reads back, keeping its cuid", () => {
      const [field] = toDesiredEmbeddedFields({
        variables: [{ id: "clx000000000000000000001", name: longName, type: "text", value: "" }],
      });

      expect(field.storageKey).toBe("clx000000000000000000001");
      expect(field.name).toBe(longName);
      expect(ZEmbeddedData.safeParse(asStoredRow(field)).success).toBe(true);
    });
  });

  test("passes duplicate storage keys through rather than merging them", () => {
    // Each caller decides: the write bridge rejects the save, the backfill can skip the survey.
    const fields = toDesiredEmbeddedFields({ hiddenFields: { enabled: true, fieldIds: ["plan", "plan"] } });
    expect(fields).toHaveLength(2);
  });
});

/**
 * The proof behind ENG-1837's decision to seed the renderer's variable map from a computed field's
 * `defaultValue` instead of `survey.variables[].value`. `ZSurveyVariable` guarantees a number
 * variable holds a number and a text variable a string, and `toDesiredEmbeddedFields` copies that
 * value verbatim — so coercing it back through the resolver is a pure pass-through and the seeded
 * map is byte-identical to today's. If either schema ever loosens, this test fails before the
 * renderer starts seeding a different value.
 */
describe("computed-field seeding is value-preserving", () => {
  const variables: TSurveyVariable[] = [
    numberVariable,
    textVariable,
    { id: "clx000000000000000000003", name: "zero", type: "number", value: 0 },
    { id: "clx000000000000000000004", name: "blank", type: "text", value: "" },
    { id: "clx000000000000000000005", name: "negative", type: "number", value: -12.5 },
    { id: "clx000000000000000000006", name: "numeric_text", type: "text", value: "0" },
  ];

  test.each(variables)("$name coerces back to exactly its declared value", (variable) => {
    const [field] = toDesiredEmbeddedFields({ variables: [variable] });

    expect(coerceToEmbeddedDataType(field.defaultValue, field.dataType)).toBe(variable.value);
  });

  test("a variable's declared value is never dropped by the coercion", () => {
    const fields = toDesiredEmbeddedFields({ variables });

    expect(fields.map((field) => coerceToEmbeddedDataType(field.defaultValue, field.dataType))).toStrictEqual(
      variables.map((variable) => variable.value)
    );
  });
});

describe("linkedToDesiredEmbeddedFields", () => {
  test("carries the attributes the legacy columns cannot express", () => {
    expect(
      linkedToDesiredEmbeddedFields([
        {
          field: {
            key: null,
            name: "seats",
            source: "ingested",
            dataType: "number",
            defaultValue: 5,
            locked: true,
          },
          link: { storageKey: "seats" },
        },
      ])
    ).toEqual([
      {
        storageKey: "seats",
        name: "seats",
        source: "ingested",
        dataType: "number",
        defaultValue: 5,
        locked: true,
        key: null,
      },
    ]);
  });

  test("reads ownership off `key`, and names the row a shared entry links", () => {
    const [field] = linkedToDesiredEmbeddedFields([
      {
        field: {
          id: "clx000000000000000000009",
          key: "plan_tier",
          name: "Plan tier",
          source: "ingested",
          dataType: "string",
          defaultValue: null,
          locked: false,
        },
        link: { storageKey: "plan_tier" },
      },
    ]);

    expect(field.key).toBe("plan_tier");
    expect(field.embeddedDataId).toBe("clx000000000000000000009");
  });

  test("ignores an id on a local entry, which is created rather than linked", () => {
    // A local entry describes a row this survey owns or is about to own. Carrying an id here would
    // make the reconcile link a definition instead of writing one.
    const [field] = linkedToDesiredEmbeddedFields([
      {
        field: {
          id: "clx000000000000000000009",
          key: null,
          name: "plan",
          source: "ingested",
          dataType: "string",
          defaultValue: null,
          locked: false,
        },
        link: { storageKey: "plan" },
      },
    ]);

    expect(field.embeddedDataId).toBeUndefined();
  });
});

describe("toLegacyEmbeddedFields", () => {
  const computed = (overrides: Partial<TDesiredEmbeddedField> = {}): TDesiredEmbeddedField => ({
    storageKey: "clx000000000000000000001",
    name: "score",
    source: "computed",
    dataType: "number",
    defaultValue: 42,
    locked: false,
    key: null,
    ...overrides,
  });

  test("writes a computed field as the variable it is stored as", () => {
    expect(toLegacyEmbeddedFields([computed()]).variables).toEqual([
      { id: "clx000000000000000000001", name: "score", type: "number", value: 42 },
    ]);
  });

  test("writes an ingested field as its storage key, which is the id the URL carries", () => {
    expect(
      toLegacyEmbeddedFields([
        { ...computed({ source: "ingested", storageKey: "plan", name: "plan", dataType: "string" }) },
      ]).hiddenFields
    ).toEqual({ enabled: true, fieldIds: ["plan"] });
  });

  test("a shared computed field takes its library key as the legacy name", () => {
    // `ZSurveyVariable` runs every name through `isLegacyVariableName`, so a library label like
    // `Plan tier` would fail the schema this column is validated by on every save and read.
    const derived = toLegacyEmbeddedFields([
      computed({ name: "Plan tier", key: "plan_tier", embeddedDataId: "clx000000000000000000009" }),
    ]);

    expect(derived.variables[0].name).toBe("plan_tier");
    expect(ZSurveyVariable.safeParse(derived.variables[0]).success).toBe(true);
  });

  describe("the derived variables always satisfy ZSurveyVariable", () => {
    // `defaultValue` is a `string | number | boolean | null`, but the schema's `number` arm demands a
    // number and its `text` arm a string, so a mismatch would write a column that fails to parse the
    // next time the survey is read. The last two rows are types `ZEmbeddedData` refuses on a computed
    // row — covered anyway, because this derivation is what a malformed payload would reach first.
    test.each([
      ["a number field with no default", computed({ defaultValue: null }), 0],
      ["a number field defaulted to a string", computed({ defaultValue: "7" }), 0],
      ["a text field with no default", computed({ dataType: "string", defaultValue: null }), ""],
      [
        "a boolean field, whose default no variable arm accepts",
        computed({ dataType: "boolean", defaultValue: true }),
        "",
      ],
      [
        "a date field, whose ISO default the text arm takes verbatim",
        computed({ dataType: "date", defaultValue: "2026-08-06" }),
        "2026-08-06",
      ],
    ])("%s", (_label, field, expectedValue) => {
      const [variable] = toLegacyEmbeddedFields([field]).variables;

      expect(variable.value).toBe(expectedValue);
      expect(ZSurveyVariable.safeParse(variable).success).toBe(true);
    });
  });

  describe("hiddenFields.enabled", () => {
    const plan = computed({ source: "ingested", storageKey: "plan", name: "plan", dataType: "string" });

    test("turns on when the survey has its first ingested field", () => {
      expect(toLegacyEmbeddedFields([plan], { enabled: false, fieldIds: [] }).hiddenFields.enabled).toBe(
        true
      );
    });

    test("stays on when every ingested field is removed", () => {
      // It is a survey-level toggle rather than a property of any field, and the two ingest paths
      // disagree about it — turning it off behind the author's back is not this function's call.
      expect(toLegacyEmbeddedFields([], { enabled: true, fieldIds: ["plan"] }).hiddenFields).toEqual({
        enabled: true,
        fieldIds: [],
      });
    });

    test("stays off for a survey with only computed fields and no previous value", () => {
      expect(toLegacyEmbeddedFields([computed()]).hiddenFields).toEqual({ enabled: false, fieldIds: [] });
    });
  });

  test("round-trips toDesiredEmbeddedFields for local fields", () => {
    // The property ENG-3228 rests on: a V2 payload that describes exactly what the columns describe
    // has to derive back to those columns, or every save through the new carrier would rewrite them.
    const legacy = {
      variables: [numberVariable, textVariable],
      hiddenFields: { enabled: true, fieldIds: ["plan", "Brand-Name"] },
    };

    expect(toLegacyEmbeddedFields(toDesiredEmbeddedFields(legacy), legacy.hiddenFields)).toEqual(legacy);
  });
});
