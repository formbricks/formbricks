import { describe, expect, test } from "vitest";
import {
  linkedToDesiredEmbeddedFields,
  toDesiredEmbeddedFields,
  toLegacyEmbeddedFields,
} from "@formbricks/types/embedded-data-mapping";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import {
  appendIngestedField,
  removeEmbeddedField,
  toCardVariable,
  toCardVariables,
  upsertCardVariable,
} from "./embedded-fields";

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

const ingested = (storageKey: string): TLinkedEmbeddedField => ({
  field: {
    name: storageKey,
    source: "ingested",
    dataType: "string",
    defaultValue: null,
    locked: false,
    key: null,
  },
  link: { storageKey },
});

describe("toCardVariable", () => {
  test("addresses the variable by its storage key and labels it with the field name", () => {
    expect(
      toCardVariable(computed("var_id", { name: "Score", dataType: "number", defaultValue: 7 }))
    ).toEqual({ id: "var_id", name: "Score", type: "number", value: 7 });
  });

  test("labels a shared field with its name, not the library key the legacy column uses", () => {
    const shared = computed("var_id", { name: "Plan tier", key: "plan_tier", id: "ed_1" });

    expect(toCardVariable(shared).name).toBe("Plan tier");
  });

  // Same fallbacks as `toLegacyVariable`: a value that cannot be the variable's declared type has to
  // land on what the schema's prefault would have supplied, or the card and the derived column
  // disagree about what the author typed.
  test("falls back to 0 / empty string when the default cannot be the declared type", () => {
    expect(toCardVariable(computed("a", { dataType: "number", defaultValue: "nope" })).value).toBe(0);
    expect(toCardVariable(computed("b", { dataType: "string", defaultValue: 12 })).value).toBe("");
  });

  test("reads any non-number data type as the card's text variable", () => {
    expect(toCardVariable(computed("c", { dataType: "date", defaultValue: "2026-01-01" })).type).toBe("text");
  });
});

describe("toCardVariables", () => {
  test("keeps list order and drops ingested fields", () => {
    const fields = [computed("one"), ingested("hidden"), computed("two")];

    expect(toCardVariables(fields).map((variable) => variable.id)).toEqual(["one", "two"]);
  });
});

describe("upsertCardVariable", () => {
  test("appends a new field as local and unlocked", () => {
    const result = upsertCardVariable([ingested("hidden")], {
      id: "var_new",
      name: "score",
      type: "number",
      value: 3,
    });

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      field: {
        name: "score",
        source: "computed",
        dataType: "number",
        defaultValue: 3,
        locked: false,
        key: null,
      },
      link: { storageKey: "var_new" },
    });
  });

  // The reason this is a merge and not a replace: the card's form has no word for a shared link, a
  // row id or a lock, so writing a whole new entry would unlink or unlock the field on the next save.
  test("preserves id, key and locked when editing an existing field", () => {
    const shared = computed("var_id", { name: "Plan tier", key: "plan_tier", id: "ed_1", locked: true });

    const [edited] = upsertCardVariable([shared], {
      id: "var_id",
      name: "Plan",
      type: "text",
      value: "pro",
    });

    expect(edited.field).toEqual({
      name: "Plan",
      source: "computed",
      dataType: "string",
      defaultValue: "pro",
      locked: true,
      key: "plan_tier",
      id: "ed_1",
    });
  });

  test("edits in place rather than reordering", () => {
    const fields = [computed("one"), ingested("hidden"), computed("two")];

    const result = upsertCardVariable(fields, { id: "one", name: "renamed", type: "text", value: "" });

    expect(result.map(({ link }) => link.storageKey)).toEqual(["one", "hidden", "two"]);
    expect(result[0].field.name).toBe("renamed");
  });

  test("never matches an ingested field that shares the storage key", () => {
    const result = upsertCardVariable([ingested("shadow")], {
      id: "shadow",
      name: "shadow",
      type: "text",
      value: "",
    });

    expect(result).toHaveLength(2);
    expect(result[0].field.source).toBe("ingested");
  });

  // The form has `text` and `number` only, so `toCardVariable` shows these as text — and the card
  // submits on blur, so a focus change with no edit would otherwise write that back and retype the
  // row. The name still moves: the form carries it losslessly whatever the type is.
  test.each([
    ["a date row", "date" as const, "2026-08-06"],
    ["a boolean row", "boolean" as const, false],
  ])("renames %s without retyping it or dropping its default", (_case, dataType, defaultValue) => {
    const [edited] = upsertCardVariable([computed("var_id", { dataType, defaultValue })], {
      id: "var_id",
      name: "Renamed",
      type: "text",
      value: "",
    });

    expect(edited.field).toMatchObject({ name: "Renamed", dataType, defaultValue });
  });
});

describe("appendIngestedField", () => {
  // Byte-for-byte the entry `toDesiredEmbeddedFields` derives from the legacy column, so the
  // `hiddenFields.fieldIds` the server derives back is exactly what the card used to write itself.
  test("matches what the legacy hidden-field column derives into", () => {
    const [added] = appendIngestedField([], "source_page");
    const [desired] = toDesiredEmbeddedFields({
      hiddenFields: { enabled: true, fieldIds: ["source_page"] },
    });

    expect(linkedToDesiredEmbeddedFields([added])).toEqual([desired]);
  });

  test("appends after the fields already declared", () => {
    const result = appendIngestedField([computed("one")], "utm_source");

    expect(result.map(({ link }) => link.storageKey)).toEqual(["one", "utm_source"]);
  });
});

describe("removeEmbeddedField", () => {
  test("drops only the addressed field", () => {
    const fields = [computed("one"), ingested("hidden"), computed("two")];

    expect(removeEmbeddedField(fields, "computed", "one").map(({ link }) => link.storageKey)).toEqual([
      "hidden",
      "two",
    ]);
  });

  test("ignores a matching storage key of the other source", () => {
    expect(removeEmbeddedField([ingested("shadow")], "computed", "shadow")).toHaveLength(1);
  });

  test("is a no-op for a key the survey does not declare", () => {
    const fields = [computed("one")];

    expect(removeEmbeddedField(fields, "computed", "absent")).toEqual(fields);
  });
});

/**
 * The property the whole refactor rests on: what the cards build derives back into the legacy
 * columns the editor used to write by hand. `enabled` is the server's, taken from the stored survey
 * and only ever turned on, so it is passed in here the way `updateSurveyInternal` passes it.
 */
describe("the columns the server derives back from a card-built list", () => {
  test("round-trips a variable and a hidden field", () => {
    const withVariable = upsertCardVariable([], {
      id: "cuid_var",
      name: "score",
      type: "number",
      value: 5,
    });
    const fields = appendIngestedField(withVariable, "source_page");

    expect(toLegacyEmbeddedFields(linkedToDesiredEmbeddedFields(fields), { enabled: false })).toEqual({
      variables: [{ id: "cuid_var", name: "score", type: "number", value: 5 }],
      hiddenFields: { enabled: true, fieldIds: ["source_page"] },
    });
  });

  test("leaves `enabled` on when the last ingested field is deleted", () => {
    const fields = removeEmbeddedField([ingested("source_page")], "ingested", "source_page");

    expect(
      toLegacyEmbeddedFields(linkedToDesiredEmbeddedFields(fields), { enabled: true, fieldIds: [] })
    ).toEqual({ variables: [], hiddenFields: { enabled: true, fieldIds: [] } });
  });
});
