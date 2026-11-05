import { describe, expect, test } from "vitest";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import {
  formatTestValuesList,
  getPreviewStartKey,
  getTestValueEntries,
  getTestValueFields,
  getTestValuesKey,
  restartsPreviewOnFinish,
  toTestDateValue,
} from "./test-values";

/** The renderer's `hiddenFieldsRecord`, as the preview builds it from the entries. */
const toRecord = (...args: Parameters<typeof getTestValueEntries>) =>
  Object.fromEntries(getTestValueEntries(...args));

/**
 * The preview's "Test values" (ENG-6932, P15/T27): URL parameters and hidden fields typed in the
 * editor, handed to the preview so rules before the first question can be tried without leaving it.
 */
describe("preview test values", () => {
  test("offers the survey's URL parameters and hidden fields, in order, and no computed field", () => {
    const fields = getTestValueFields(surveyFlowFixture);

    expect(fields.slice(0, 3)).toEqual([
      { key: ids.hiddenFields.panelId, dataType: "string" },
      { key: ids.hiddenFields.seg, dataType: "string" },
      { key: ids.hiddenFields.signupDate, dataType: "date" },
    ]);
    expect(fields.map(({ key }) => key)).not.toContain(ids.variables.score);
  });

  test("hands the preview only the filled-in values of fields the survey still has", () => {
    const fields = getTestValueFields(surveyFlowFixture);

    expect(
      toRecord({ [ids.hiddenFields.seg]: "heavy", [ids.hiddenFields.panelId]: "  ", gone: "x" }, fields)
    ).toEqual({ [ids.hiddenFields.seg]: "heavy" });
    expect(toRecord({}, fields)).toEqual({});
  });

  test("hands each value over in the format a real `?key=` link carries for the field's type", () => {
    const fields = [
      { key: "panel_id", dataType: "number" },
      { key: "signup_date", dataType: "date" },
      { key: "is_member", dataType: "boolean" },
      { key: "seg", dataType: "string" },
    ] as const;

    expect(
      toRecord(
        { panel_id: " 4711.50 ", signup_date: "2026-08-06", is_member: "false", seg: " heavy " },
        fields
      )
    ).toEqual({ panel_id: "4711.5", signup_date: "2026-08-06", is_member: "false", seg: " heavy " });
  });

  test("leaves out a value the field's type cannot read, e.g. one kept from before its type changed", () => {
    const fields = [
      { key: "panel_id", dataType: "number" },
      { key: "signup_date", dataType: "date" },
      { key: "is_member", dataType: "boolean" },
    ] as const;

    expect(toRecord({ panel_id: "heavy", signup_date: "asdasdasda", is_member: "yes" }, fields)).toEqual({});
    expect(toRecord({ signup_date: "2026-02-30" }, fields)).toEqual({});
  });

  test("the date picker writes its day as yyyy-MM-dd, in the author's own calendar", () => {
    expect(toTestDateValue(new Date(2026, 7, 6))).toBe("2026-08-06");
    expect(toTestDateValue(new Date(2026, 0, 1, 23, 59))).toBe("2026-01-01");
  });

  test("lists the values the preview runs with, in the fields' order, as `key = value`", () => {
    const fields = getTestValueFields(surveyFlowFixture);
    const entries = getTestValueEntries(
      {
        [ids.hiddenFields.seg]: "heavy",
        [ids.hiddenFields.panelId]: "4711",
        [ids.hiddenFields.signupDate]: "",
      },
      fields
    );

    expect(formatTestValuesList(entries, "en-US")).toBe("panel_id = 4711 and seg = heavy");
    expect(formatTestValuesList(entries.slice(0, 1), "en-US")).toBe("panel_id = 4711");
    expect(formatTestValuesList(entries, "de-DE")).toBe("panel_id = 4711 und seg = heavy");
  });

  test("the preview restarts when the values change, and only then", () => {
    const a = getTestValuesKey({ seg: "heavy", panel_id: "p1" });

    expect(getTestValuesKey({ panel_id: "p1", seg: "heavy" })).toBe(a);
    expect(getTestValuesKey({ seg: "light", panel_id: "p1" })).not.toBe(a);
    expect(getTestValuesKey({})).toBe("");
  });

  test("the preview also restarts when the rules before the first question change, and only then", () => {
    const startLogic = surveyFlowFixture.startLogic ?? [];
    expect(startLogic.length).toBeGreaterThan(0);
    const key = getPreviewStartKey({ seg: "heavy" }, startLogic);

    expect(getPreviewStartKey({ seg: "heavy" }, structuredClone(startLogic))).toBe(key);
    expect(getPreviewStartKey({ seg: "heavy" }, startLogic.slice(1))).not.toBe(key);
    expect(getPreviewStartKey({ seg: "light" }, startLogic)).not.toBe(key);
  });

  test("an app survey without endings starts over after a finish, with a new key so start logic runs again", () => {
    const startLogic = surveyFlowFixture.startLogic ?? [];
    expect(restartsPreviewOnFinish({ type: "app", endings: [] })).toBe(true);
    expect(restartsPreviewOnFinish({ type: "app", endings: [{}] })).toBe(false);
    expect(restartsPreviewOnFinish({ type: "link", endings: [] })).toBe(false);
    expect(getPreviewStartKey({}, startLogic, 1)).not.toBe(getPreviewStartKey({}, startLogic, 0));
  });
});
