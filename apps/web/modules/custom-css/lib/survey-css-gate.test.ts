import { describe, expect, test } from "vitest";
import { isSurveyCustomCssApplied } from "./survey-css-gate";

describe("isSurveyCustomCssApplied", () => {
  test("applies only when the workspace allows overrides and the survey uses them", () => {
    expect(isSurveyCustomCssApplied({ allowStyleOverwrite: true, overwriteThemeStyling: true })).toBe(true);
    expect(isSurveyCustomCssApplied({ allowStyleOverwrite: true, overwriteThemeStyling: false })).toBe(false);
    expect(isSurveyCustomCssApplied({ allowStyleOverwrite: false, overwriteThemeStyling: true })).toBe(false);
  });

  test("treats a missing setting as off, like the theme selection does", () => {
    expect(isSurveyCustomCssApplied({ allowStyleOverwrite: true, overwriteThemeStyling: undefined })).toBe(
      false
    );
    expect(isSurveyCustomCssApplied({ allowStyleOverwrite: null, overwriteThemeStyling: true })).toBe(false);
  });
});
