import { describe, expect, test } from "vitest";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { getTestValueFields, getTestValuesKey, toHiddenFieldsRecord } from "./test-values";

/**
 * The preview's "Test values" (ENG-6932, P15/T27): URL parameters and hidden fields typed in the
 * editor, handed to the preview so rules before the first question can be tried without leaving it.
 */
describe("preview test values", () => {
  test("offers the survey's URL parameters and hidden fields, in order", () => {
    expect(getTestValueFields(surveyFlowFixture)).toEqual([
      ids.hiddenFields.panelId,
      ids.hiddenFields.seg,
      ids.hiddenFields.signupDate,
    ]);
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
});
