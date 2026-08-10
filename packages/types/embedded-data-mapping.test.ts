import { describe, expect, test } from "vitest";
import { toDesiredEmbeddedFields } from "./embedded-data-mapping";
import { type TSurveyVariable } from "./surveys/types";

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

  test("passes duplicate storage keys through rather than merging them", () => {
    // Each caller decides: the write bridge rejects the save, the backfill can skip the survey.
    const fields = toDesiredEmbeddedFields({ hiddenFields: { enabled: true, fieldIds: ["plan", "plan"] } });
    expect(fields).toHaveLength(2);
  });
});
