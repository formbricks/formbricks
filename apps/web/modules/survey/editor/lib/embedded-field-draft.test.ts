import { describe, expect, test } from "vitest";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import {
  type TEmbeddedFieldDraft,
  ZEmbeddedFieldDraft,
  toEmbeddedFieldDraft,
  toLocalEmbeddedField,
} from "./embedded-field-draft";

const draft = (overrides: Partial<TEmbeddedFieldDraft> = {}): TEmbeddedFieldDraft => ({
  name: "plan",
  source: "ingested",
  dataType: "string",
  defaultValue: "",
  locked: false,
  ...overrides,
});

/** The column each of a draft's issues was raised against. */
const issueColumns = (value: TEmbeddedFieldDraft): string[] => {
  const parsed = ZEmbeddedFieldDraft.safeParse(value);
  return parsed.success ? [] : parsed.error.issues.map((issue) => String(issue.path[0]));
};

describe("ZEmbeddedFieldDraft", () => {
  test("accepts a passed-in text field with no default", () => {
    expect(issueColumns(draft())).toEqual([]);
  });

  /**
   * Each of these is a rule the card deliberately does NOT restate — `ZEmbeddedData` owns it, and the
   * draft schema only forwards what it says onto the control that carries the column. A rule moving
   * or changing there has to keep reaching this form, which is what these pin.
   */
  test("forwards the row rules `ZEmbeddedData` owns, onto the control that carries them", () => {
    expect(issueColumns(draft({ name: "   " }))).toEqual(["name"]);
    expect(issueColumns(draft({ source: "computed", dataType: "date" }))).toEqual(["dataType"]);
    expect(issueColumns(draft({ source: "computed", locked: true }))).toEqual(["locked"]);
    expect(issueColumns(draft({ dataType: "number", defaultValue: "not a number" }))).toEqual([
      "defaultValue",
    ]);
    expect(issueColumns(draft({ dataType: "date", defaultValue: "31/12/2026" }))).toEqual(["defaultValue"]);
  });

  test("accepts a default that agrees with its type", () => {
    expect(issueColumns(draft({ dataType: "number", defaultValue: "7" }))).toEqual([]);
    expect(issueColumns(draft({ dataType: "boolean", defaultValue: "true" }))).toEqual([]);
    expect(issueColumns(draft({ dataType: "date", defaultValue: "2026-12-31" }))).toEqual([]);
  });

  // The message is the schema's own sentence rather than one this form invented, so an author reads
  // the same words a refused save would have returned.
  test("carries the schema's own sentence", () => {
    const parsed = ZEmbeddedFieldDraft.safeParse(draft({ source: "computed", locked: true }));

    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toBe("Only ingested fields can be locked");
  });
});

describe("toEmbeddedFieldDraft", () => {
  test("opens a new field as an unlocked passed-in text field", () => {
    expect(toEmbeddedFieldDraft(null)).toEqual({
      name: "",
      source: "ingested",
      dataType: "string",
      defaultValue: "",
      locked: false,
    });
  });

  test("reads an existing field's columns back into the controls", () => {
    const entry: TLinkedEmbeddedField = {
      field: {
        id: "ed_1",
        key: null,
        name: "Plan",
        source: "ingested",
        dataType: "number",
        defaultValue: 7,
        locked: true,
      },
      link: { storageKey: "plan" },
    };

    expect(toEmbeddedFieldDraft(entry)).toEqual({
      name: "Plan",
      source: "ingested",
      dataType: "number",
      defaultValue: "7",
      locked: true,
    });
  });
});

describe("toLocalEmbeddedField", () => {
  test("declares a field the survey owns, never a library link", () => {
    const entry = toLocalEmbeddedField(draft({ dataType: "number", defaultValue: "7" }), {
      storageKey: "plan",
    });

    expect(entry).toEqual({
      field: {
        key: null,
        name: "plan",
        source: "ingested",
        dataType: "number",
        defaultValue: 7,
        locked: false,
      },
      link: { storageKey: "plan" },
    });
  });

  // A blank draft is "no default", not `""` — an empty string is a value an ingested field would then
  // be filled with.
  test("reads a blank default as no default", () => {
    expect(toLocalEmbeddedField(draft(), { storageKey: "plan" }).field.defaultValue).toBeNull();
  });

  // Carried so the reconcile updates the row this field already has rather than replacing it; absent
  // on a field the survey has never saved, which has no row to name.
  test("carries the stored row's id when there is one", () => {
    expect(toLocalEmbeddedField(draft(), { storageKey: "plan", id: "ed_1" }).field.id).toBe("ed_1");
    expect(toLocalEmbeddedField(draft(), { storageKey: "plan" }).field).not.toHaveProperty("id");
  });
});
