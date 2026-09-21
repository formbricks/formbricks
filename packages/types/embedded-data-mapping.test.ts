import { describe, expect, test } from "vitest";
import { ZEmbeddedData } from "./embedded-data";
import { type TDesiredEmbeddedField, toDesiredEmbeddedFields } from "./embedded-data-mapping";
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
