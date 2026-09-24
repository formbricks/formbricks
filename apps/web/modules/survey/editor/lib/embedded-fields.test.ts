import type { TFunction } from "i18next";
import { describe, expect, test, vi } from "vitest";
import {
  linkedToDesiredEmbeddedFields,
  toLegacyEmbeddedFields,
} from "@formbricks/types/embedded-data-mapping";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { ZSurveyVariable } from "@formbricks/types/surveys/types";
import { TValidateIdErrorCode } from "@formbricks/types/surveys/validation";
import {
  type TLinkableSharedField,
  cloneSharedFieldToLocal,
  declaredEmbeddedFieldName,
  getEmbeddedFieldErrorMessage,
  isEmbeddedFieldNameTaken,
  isPromotableEmbeddedField,
  listLinkableSharedFields,
  mintStorageKey,
  removeEmbeddedField,
  toSharedEntry,
  upsertEmbeddedField,
  validateEmbeddedFieldDeclaredName,
} from "./embedded-fields";

/** The legacy entry a computed field is dual-written as — the shape `ZSurveyVariable` judges. */
const toLegacyVariable = (storageKey: string) => ({
  id: storageKey,
  name: "plan_tier",
  type: "text" as const,
  value: "",
});

const computed = (
  storageKey: string,
  overrides: Partial<TLinkedEmbeddedField["field"]> = {}
): TLinkedEmbeddedField => ({
  field: {
    name: storageKey,
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

const sharedRow = (overrides: Partial<TLinkableSharedField> = {}): TLinkableSharedField => ({
  id: "ed_shared",
  key: "plan_tier",
  name: "Plan tier",
  description: null,
  source: "ingested",
  dataType: "string",
  defaultValue: null,
  locked: false,
  ...overrides,
});

const storageKeys = (fields: readonly TLinkedEmbeddedField[]): string[] =>
  fields.map(({ link }) => link.storageKey);

describe("mintStorageKey", () => {
  // An ingested field is filled from `?name=`, so its address has to BE the name; a computed field is
  // addressed by the id its recall tokens carry, so its name stays free to be renamed.
  test("addresses an ingested field by its name", () => {
    expect(mintStorageKey("ingested", "plan")).toBe("plan");
  });

  test("mints a fresh id for a computed field", () => {
    const first = mintStorageKey("computed", "score");

    expect(first).not.toBe("score");
    expect(mintStorageKey("computed", "score")).not.toBe(first);
  });

  test("a computed field's id is a cuid2, which the legacy variables column requires", () => {
    // Not cosmetic, and the reason the create form offers an ID input for a passed-in field only:
    // the rows are dual-written to `survey.variables` until ENG-2404 retires that column, and
    // `ZSurveyVariable` pins each entry's `id` to `z.cuid2()`. An author-written address would be
    // refused on save with "Invalid cuid2", pointing at no control.
    expect(() =>
      ZSurveyVariable.parse(toLegacyVariable(mintStorageKey("computed", "Plan tier")))
    ).not.toThrow();
    // The mutation this guards: hand the same column an author-written address and it is refused.
    expect(() => ZSurveyVariable.parse(toLegacyVariable("plan_tier"))).toThrow();
  });
});

describe("upsertEmbeddedField", () => {
  test("appends a field the survey does not have", () => {
    const result = upsertEmbeddedField([ingested("hidden")], computed("var_new", { name: "score" }));

    expect(storageKeys(result)).toEqual(["hidden", "var_new"]);
  });

  test("replaces in place rather than reordering", () => {
    const fields = [computed("one"), ingested("hidden"), computed("two")];

    const result = upsertEmbeddedField(fields, computed("one", { name: "renamed", dataType: "number" }));

    expect(storageKeys(result)).toEqual(["one", "hidden", "two"]);
    expect(result[0].field).toMatchObject({ name: "renamed", dataType: "number" });
  });

  // The address is unique per survey, but a malformed survey must not have a computed lookup answered
  // by an ingested field — the same pairing the reconcile identifies a field by.
  test("never matches a field of the other source at the same address", () => {
    const result = upsertEmbeddedField([ingested("shadow")], computed("shadow"));

    expect(result).toHaveLength(2);
    expect(result[0].field.source).toBe("ingested");
  });

  // Promote is expressed as an upsert of a differently-owned entry at the same address, so it has to
  // land as an edit in place rather than as a second row.
  test("carries an ownership change at the same address", () => {
    const result = upsertEmbeddedField(
      [ingested("plan", { id: "ed_1" })],
      toSharedEntry(sharedRow({ id: "ed_1" }), "plan")
    );

    expect(result).toHaveLength(1);
    expect(result[0].field).toMatchObject({ key: "plan_tier", id: "ed_1", name: "Plan tier" });
  });
});

describe("cloneSharedFieldToLocal", () => {
  const linked = [computed("var_id", { key: "plan_tier", id: "ed_1", name: "Plan tier" })];

  test("drops the library key and the row it named, keeping the definition and the address", () => {
    const [cloned] = cloneSharedFieldToLocal(linked, "computed", "var_id");

    expect(cloned.field).toEqual({
      key: null,
      name: "plan_tier",
      source: "computed",
      dataType: "string",
      defaultValue: "",
      locked: false,
    });
    expect(cloned.link.storageKey).toBe("var_id");
  });

  // The column a computed field is declared under moves with the ownership — the key while shared,
  // the name once local — so keeping the label would declare `Plan tier` as a variable name and the
  // survey could never be saved again.
  test("renames a cloned computed field to the key it drops", () => {
    const [cloned] = cloneSharedFieldToLocal(linked, "computed", "var_id");
    const declaredName = declaredEmbeddedFieldName(cloned);

    expect(
      validateEmbeddedFieldDeclaredName({
        declaredName,
        takenIds: [],
        otherDeclaredNames: [],
        previousDeclaredName: null,
      })
    ).toBeNull();
    expect(declaredName).toBe("plan_tier");
  });

  // An ingested field is declared by its storage key under either ownership, so nothing rides on its
  // label and the author keeps the one the library showed them.
  test("keeps a cloned ingested field's display name", () => {
    const linkedIngested = [ingested("plan_tier", { key: "plan_tier", id: "ed_1", name: "Plan tier" })];

    const [cloned] = cloneSharedFieldToLocal(linkedIngested, "ingested", "plan_tier");

    expect(cloned.field).toMatchObject({ key: null, name: "Plan tier" });
    expect(declaredEmbeddedFieldName(cloned)).toBe("plan_tier");
  });

  test("leaves a field the survey already owns alone", () => {
    const local = [computed("var_id", { id: "ed_1" })];

    expect(cloneSharedFieldToLocal(local, "computed", "var_id")).toEqual(local);
  });
});

describe("removeEmbeddedField", () => {
  test("drops only the addressed field", () => {
    const fields = [computed("one"), ingested("hidden"), computed("two")];

    expect(storageKeys(removeEmbeddedField(fields, "computed", "one"))).toEqual(["hidden", "two"]);
  });

  test("ignores a matching storage key of the other source", () => {
    expect(removeEmbeddedField([ingested("shadow")], "computed", "shadow")).toHaveLength(1);
  });

  test("is a no-op for a key the survey does not declare", () => {
    const fields = [computed("one")];

    expect(removeEmbeddedField(fields, "computed", "absent")).toEqual(fields);
  });
});

describe("declaredEmbeddedFieldName", () => {
  test("names a computed field by its name, and a shared one by its library key", () => {
    expect(declaredEmbeddedFieldName(computed("var_id", { name: "score" }))).toBe("score");
    expect(declaredEmbeddedFieldName(computed("var_id", { name: "Plan tier", key: "plan_tier" }))).toBe(
      "plan_tier"
    );
  });

  // An ingested field's value arrives under its storage key, which is what recall and logic address —
  // renaming the label does not move it.
  test("names an ingested field by its address", () => {
    expect(declaredEmbeddedFieldName(ingested("utm_source", { name: "Campaign source" }))).toBe("utm_source");
  });
});

describe("validateEmbeddedFieldDeclaredName", () => {
  const check = (
    declaredName: string,
    overrides: Partial<Parameters<typeof validateEmbeddedFieldDeclaredName>[0]> = {}
  ) =>
    validateEmbeddedFieldDeclaredName({
      declaredName,
      takenIds: [],
      otherDeclaredNames: [],
      previousDeclaredName: null,
      ...overrides,
    });

  test("accepts a safe identifier nothing else has taken", () => {
    expect(check("plan_tier")).toBeNull();
  });

  // The rules moved off the display name and onto the address, which is what actually has to be an
  // identifier: a URL parameter spells it, and so does a recall token.
  test("judges the address, leaving the display name free", () => {
    expect(check("plan_tier", { otherDeclaredNames: ["Plan Tier"] })).toBeNull();
  });

  // The whole point of delegating to `validateId`'s strict branch: `country` is lowercase with no
  // separators, so only the reserved list refuses it — and the server refuses it for the same reason.
  test("refuses an auto-captured field's address, in any casing", () => {
    expect(check("country")).toEqual({ code: TValidateIdErrorCode.Reserved, field: "country" });
    expect(check("Country")).toEqual({ code: TValidateIdErrorCode.Reserved, field: "Country" });
  });

  test("refuses an address that is not a safe identifier", () => {
    expect(check("Plan Tier")?.code).toBe(TValidateIdErrorCode.HasSpaces);
    expect(check("PlanTier")?.code).toBe(TValidateIdErrorCode.NotSafeIdentifier);
    expect(check("")?.code).toBe(TValidateIdErrorCode.Empty);
  });

  test("refuses an address another field or an element already answers to", () => {
    expect(check("score", { otherDeclaredNames: ["score"] })?.code).toBe(TValidateIdErrorCode.Duplicate);
    expect(check("q1", { takenIds: ["q1"] })?.code).toBe(TValidateIdErrorCode.Duplicate);
  });

  // The editor's half of the server's grandfather rule: a survey that already declares `country` has
  // to stay editable, or its author could never change the field's type or default.
  test("leaves an unchanged address alone, whatever it is", () => {
    expect(check("country", { previousDeclaredName: "country" })).toBeNull();
    expect(check("Country", { previousDeclaredName: "country" })).toBeNull();
  });
});

describe("listLinkableSharedFields", () => {
  const library = [
    sharedRow({ id: "ed_plan", key: "plan" }),
    sharedRow({ id: "ed_score", key: "score", source: "computed", name: "Score" }),
  ];
  const linkable = (embeddedFields: TLinkedEmbeddedField[], persistedFields = embeddedFields) =>
    listLinkableSharedFields({ library, embeddedFields, persistedFields }).map((row) => row.key);

  test("offers every row a survey with no fields can take", () => {
    expect(linkable([])).toEqual(["plan", "score"]);
  });

  test("leaves out a row the survey already links", () => {
    expect(linkable([toSharedEntry(library[0], "plan")])).toEqual(["score"]);
  });

  // `@@unique([surveyId, storageKey])` would refuse the link: an ingested field's address IS its key.
  test("leaves out a row whose address a local field already holds", () => {
    expect(linkable([ingested("plan")])).toEqual(["score"]);
  });

  // Recall and logic address fields by name across both namespaces, so a survey with a local
  // computed `plan` cannot also take the library's ingested `plan`.
  test("leaves out a row that would put one name in both namespaces", () => {
    expect(linkable([computed("var_id", { name: "plan" })])).toEqual(["score"]);
  });

  // The same name inside ONE namespace, which the cross-namespace rule above cannot see: both
  // derive the legacy variable `score`, and the save dies naming no field at all.
  test("leaves out a row that would duplicate a name inside its own namespace", () => {
    expect(linkable([computed("var_id", { name: "score" })])).toEqual(["plan"]);
  });

  // Grandfathering is per-save and reads the stored survey, exactly as the server's guard does: a
  // survey that already holds the clash keeps saving, so the row stays on offer.
  test("still offers a row whose clash the stored survey already holds", () => {
    const clash = [computed("var_id", { name: "plan" }), ingested("plan")];

    expect(linkable(clash, clash)).toEqual(["score"]);
  });
});

describe("isPromotableEmbeddedField", () => {
  const stored = ingested("plan", { id: "ed_1", name: "Plan", dataType: "number", defaultValue: 7 });

  test("promotes a local field whose stored row still says what the card shows", () => {
    expect(isPromotableEmbeddedField(stored, [stored])).toBe(true);
  });

  // Promote acts on the stored row, so a field edited since the last save would be filed under the
  // library key with its old definition.
  test("refuses a field the editor has changed since the save", () => {
    const renamed = { ...stored, field: { ...stored.field, name: "Plan tier" } };
    const relocked = { ...stored, field: { ...stored.field, locked: true } };

    expect(isPromotableEmbeddedField(renamed, [stored])).toBe(false);
    expect(isPromotableEmbeddedField(relocked, [stored])).toBe(false);
  });

  test("refuses a field the survey has never saved", () => {
    expect(isPromotableEmbeddedField(ingested("plan"), [])).toBe(false);
  });

  test("refuses a field that is already in the library", () => {
    const shared = toSharedEntry(sharedRow({ id: "ed_1" }), "plan");

    expect(isPromotableEmbeddedField(shared, [shared])).toBe(false);
  });
});

/**
 * The property the whole refactor rests on: what the card builds derives back into the legacy columns
 * the editor used to write by hand. `enabled` is the server's, taken from the stored survey and only
 * ever turned on, so it is passed in here the way `updateSurveyInternal` passes it.
 */
describe("the columns the server derives back from a card-built list", () => {
  test("round-trips a calculated and a passed-in field", () => {
    const fields = upsertEmbeddedField(
      [computed("cuid_var", { name: "score", dataType: "number", defaultValue: 5 })],
      ingested("source_page")
    );

    expect(toLegacyEmbeddedFields(linkedToDesiredEmbeddedFields(fields), { enabled: false })).toEqual({
      variables: [{ id: "cuid_var", name: "score", type: "number", value: 5 }],
      hiddenFields: { enabled: true, fieldIds: ["source_page"] },
    });
  });

  // A shared computed field answers to its library key in the derived column, because a display label
  // like `Plan tier` is not a legal variable name.
  test("derives a linked library field under its key", () => {
    const fields = [toSharedEntry(sharedRow({ source: "computed" }), "cuid_var")];

    expect(toLegacyEmbeddedFields(linkedToDesiredEmbeddedFields(fields), { enabled: false })).toEqual({
      variables: [{ id: "cuid_var", name: "plan_tier", type: "text", value: "" }],
      hiddenFields: { enabled: false, fieldIds: [] },
    });
  });

  test("leaves `enabled` on when the last ingested field is removed", () => {
    const fields = removeEmbeddedField([ingested("source_page")], "ingested", "source_page");

    expect(
      toLegacyEmbeddedFields(linkedToDesiredEmbeddedFields(fields), { enabled: true, fieldIds: [] })
    ).toEqual({ variables: [], hiddenFields: { enabled: true, fieldIds: [] } });
  });
});

describe("isEmbeddedFieldNameTaken", () => {
  const taken = (name: string, otherFieldNames: string[]) =>
    isEmbeddedFieldNameTaken({ name, otherFieldNames });

  test("catches a repeat whatever its casing or padding", () => {
    // The pickers label a local field by its name and have nothing else to show beside it, so two
    // fields called `Plan tier` are two identical rows in recall and logic.
    expect(taken("Plan tier", ["plan TIER"])).toBe(true);
    expect(taken("  Plan tier  ", ["Plan tier"])).toBe(true);
  });

  test("leaves a name no other field holds alone", () => {
    expect(taken("Plan tier", ["Region", "Score"])).toBe(false);
  });

  test("says nothing about elements, which collide in the other namespace", () => {
    // A field may perfectly well be named after the question it describes; what it may not do is
    // take that question's id as its address, which `validateEmbeddedFieldDeclaredName` is for.
    expect(taken("What is your plan?", [])).toBe(false);
  });
});

describe("getEmbeddedFieldErrorMessage", () => {
  /** Returns the key and whatever was interpolated, so a test can assert both. */
  const spyT = () =>
    vi.fn((key: string, params?: Record<string, string>) =>
      JSON.stringify({ key, ...params })
    ) as unknown as TFunction;

  const message = (code: TValidateIdErrorCode, label: string, field = "") => {
    const t = spyT();
    return JSON.parse(getEmbeddedFieldErrorMessage({ code, field }, label, t));
  };

  test("names the control the author is looking at, not the entity", () => {
    // The whole point: the shared `getValidateIdErrorMessage` phrases these as "{Variable,Hidden
    // field} ID …", which is what told an author naming a passed-in field that their ID could not
    // contain spaces. Same code, two controls, two sentences.
    expect(message(TValidateIdErrorCode.HasSpaces, "Key").label).toBe("Key");
    expect(message(TValidateIdErrorCode.HasSpaces, "Name").label).toBe("Name");
  });

  test("every code has a sentence of this card's own", () => {
    // A code falling through would render the key itself at the author, so pin all six.
    const keys = [
      TValidateIdErrorCode.Empty,
      TValidateIdErrorCode.Duplicate,
      TValidateIdErrorCode.Reserved,
      TValidateIdErrorCode.HasSpaces,
      TValidateIdErrorCode.InvalidChars,
      TValidateIdErrorCode.NotSafeIdentifier,
    ].map((code) => message(code, "Key").key);

    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^workspace\.embedded_data\./);
  });

  test("carries the refused spelling for a reserved name", () => {
    expect(message(TValidateIdErrorCode.Reserved, "Key", "country").field).toBe("country");
  });

  test("a taken address is answered without naming a control", () => {
    // It is the one refusal that is about the survey rather than about what was typed, so it reads
    // the same whichever control holds the declared name.
    expect(message(TValidateIdErrorCode.Duplicate, "Key")).toStrictEqual({
      key: "workspace.embedded_data.survey_field_address_taken",
    });
  });
});
