import { describe, expect, test } from "vitest";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import {
  getPreviewStartKey,
  getTestValueFields,
  getTestValuesKey,
  restartsPreviewOnFinish,
  toHiddenFieldsRecord,
} from "./test-values";

/**
 * The preview's "Test values" (ENG-6932, P15/T27): URL parameters and hidden fields typed in the
 * editor, handed to the preview so rules before the first question can be tried without leaving it.
 */
describe("preview test values", () => {
  test("offers the survey's URL parameters and hidden fields, in order, and no computed field", () => {
    const fields = getTestValueFields(surveyFlowFixture);

    expect(fields.slice(0, 3)).toEqual([
      ids.hiddenFields.panelId,
      ids.hiddenFields.seg,
      ids.hiddenFields.signupDate,
    ]);
    expect(fields).not.toContain(ids.variables.score);
  });

  test("hands the preview only the filled-in values of fields the survey still has", () => {
    const fields = getTestValueFields(surveyFlowFixture);

    expect(
      toHiddenFieldsRecord(
        { [ids.hiddenFields.seg]: "heavy", [ids.hiddenFields.panelId]: "  ", gone: "x" },
        fields
      )
    ).toEqual({ [ids.hiddenFields.seg]: "heavy" });
    expect(toHiddenFieldsRecord({}, fields)).toEqual({});
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
