import { describe, expect, test } from "vitest";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { embeddedFieldKey, embeddedFieldWarnings, needsTypeChangeConfirm } from "./embedded-field-guards";

const computed = (
  name: string,
  overrides: Partial<TLinkedEmbeddedField["field"]> = {},
  storageKey = "cm0computed"
): TLinkedEmbeddedField => ({
  field: {
    name,
    source: "computed",
    dataType: "string",
    defaultValue: "",
    locked: false,
    key: null,
    ...overrides,
  },
  link: { storageKey },
});

const ingested = (
  storageKey: string,
  overrides: Partial<TLinkedEmbeddedField["field"]> = {}
): TLinkedEmbeddedField => ({
  field: {
    name: storageKey,
    source: "ingested",
    dataType: "string",
    defaultValue: null,
    locked: false,
    key: null,
    ...overrides,
  },
  link: { storageKey },
});

const warningsFor = (fields: TLinkedEmbeddedField[], entry: TLinkedEmbeddedField) =>
  embeddedFieldWarnings(fields).get(embeddedFieldKey(entry)) ?? [];

describe("embeddedFieldWarnings", () => {
  test("a well-formed survey warns about nothing", () => {
    expect(embeddedFieldWarnings([ingested("utm_campaign"), computed("score")]).size).toBe(0);
  });

  test("an ingested address that is not a legal identifier warns", () => {
    const field = ingested("utm-campaign");
    expect(warningsFor([field], field)).toEqual(["unsafeAddress"]);
  });

  test("a mixed-case ingested address warns", () => {
    const field = ingested("Source");
    // `Source` is stored lowercased in the reserved set, so it is both illegal and reserved.
    expect(warningsFor([field], field)).toEqual(["unsafeAddress", "reservedAddress"]);
  });

  test("a legal but reserved address warns without being called malformed", () => {
    const field = ingested("country");
    expect(warningsFor([field], field)).toEqual(["reservedAddress"]);
  });

  test("a computed field is judged on its declared name, not its minted storage key", () => {
    // The storage key is a cuid, which is always a legal identifier — the name is what recall and
    // logic address, and a legacy `survey.variables` entry was allowed to start with a digit.
    const field = computed("1foo");
    expect(warningsFor([field], field)).toEqual(["unsafeAddress"]);
  });

  test("a computed field with a well-formed name is clean despite its cuid address", () => {
    expect(embeddedFieldWarnings([computed("score")]).size).toBe(0);
  });

  test("a shared computed field answers to its library key", () => {
    const field = computed("Plan tier", { key: "plan_tier" });
    expect(embeddedFieldWarnings([field]).size).toBe(0);
  });

  test("a grandfathered computed/ingested pair warns on both rows", () => {
    const variable = computed("source");
    const hidden = ingested("source");
    const warnings = embeddedFieldWarnings([variable, hidden]);

    expect(warnings.get(embeddedFieldKey(variable))).toContain("clashingAddress");
    expect(warnings.get(embeddedFieldKey(hidden))).toContain("clashingAddress");
  });

  test("the clash is matched case-insensitively, as the namespace is", () => {
    const variable = computed("Source");
    const hidden = ingested("source");

    expect(warningsFor([variable, hidden], variable)).toContain("clashingAddress");
  });

  test("two unrelated names are not a clash", () => {
    const variable = computed("score");
    const hidden = ingested("utm_campaign");

    expect(warningsFor([variable, hidden], variable)).not.toContain("clashingAddress");
  });

  test("a locked field with no default can never hold a value", () => {
    const field = ingested("account_id", { locked: true, defaultValue: null });
    expect(warningsFor([field], field)).toEqual(["lockedWithoutDefault"]);
  });

  test("a locked field with a default is fine", () => {
    expect(embeddedFieldWarnings([ingested("account_id", { locked: true, defaultValue: "0" })]).size).toBe(0);
  });

  test("an unlocked field with no default is fine", () => {
    expect(embeddedFieldWarnings([ingested("account_id", { defaultValue: null })]).size).toBe(0);
  });

  test("a row carrying several problems reports all of them", () => {
    const field = ingested("Country", { locked: true, defaultValue: null });
    expect(warningsFor([field], field)).toEqual(["unsafeAddress", "reservedAddress", "lockedWithoutDefault"]);
  });
});

describe("needsTypeChangeConfirm", () => {
  test("asks when a stored field is retyped and the survey has responses", () => {
    expect(
      needsTypeChangeConfirm({ nextDataType: "number", storedDataType: "string", responseCount: 3 })
    ).toBe(true);
  });

  test("stays silent when the type is unchanged", () => {
    expect(
      needsTypeChangeConfirm({ nextDataType: "string", storedDataType: "string", responseCount: 3 })
    ).toBe(false);
  });

  test("stays silent when the survey has no responses to reinterpret", () => {
    expect(
      needsTypeChangeConfirm({ nextDataType: "number", storedDataType: "string", responseCount: 0 })
    ).toBe(false);
  });

  test("stays silent for a field the survey has never saved", () => {
    expect(needsTypeChangeConfirm({ nextDataType: "number", storedDataType: null, responseCount: 3 })).toBe(
      false
    );
  });
});
