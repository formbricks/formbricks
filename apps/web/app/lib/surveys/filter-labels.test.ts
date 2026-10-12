import { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { getFilterOperatorLabel, getFilterValueLabel, getOtherFilterLabel } from "./filter-labels";

// Stands in for react-i18next: returns the key so a test can assert which key was looked up, and
// interpolates like i18next does for the one label that takes a variable.
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction;

// Every operator the option generators in `surveys.ts` can put in the left-hand menu, and the key
// each has to resolve to. A string added there without a label here renders as raw English.
const OPERATOR_LABELS: [string, string][] = [
  ["is", "workspace.surveys.summary.response_filters.is"],
  ["Includes all", "workspace.surveys.summary.includes_all"],
  ["Includes either", "workspace.surveys.summary.includes_either"],
  ["Is equal to", "workspace.surveys.summary.is_equal_to"],
  ["Is less than", "workspace.surveys.summary.is_less_than"],
  ["Is more than", "workspace.surveys.summary.response_filters.is_more_than"],
  ["Is greater than", "workspace.surveys.edit.validation.is_greater_than"],
  ["Is before", "workspace.surveys.edit.is_before"],
  ["Is after", "workspace.surveys.edit.is_after"],
  ["Is set", "workspace.surveys.edit.is_set"],
  ["Is not set", "workspace.surveys.edit.is_not_set"],
  ["Equals", "workspace.surveys.edit.equals"],
  ["Not equals", "workspace.surveys.summary.response_filters.not_equals"],
  ["Contains", "workspace.surveys.edit.contains"],
  ["Does not contain", "workspace.surveys.edit.does_not_contain"],
  ["Starts with", "workspace.surveys.edit.starts_with"],
  ["Does not start with", "workspace.surveys.edit.does_not_start_with"],
  ["Ends with", "workspace.surveys.edit.ends_with"],
  ["Does not end with", "workspace.surveys.edit.does_not_end_with"],
  ["Status", "common.status"],
  ["Submitted", "workspace.surveys.summary.response_filters.submitted"],
  ["Skipped", "common.skipped"],
];

// The same, for the right-hand value menu.
const VALUE_LABELS: [string, string][] = [
  ["Filled out", "workspace.surveys.summary.response_filters.filled_out"],
  ["Skipped", "common.skipped"],
  ["Submitted", "workspace.surveys.summary.response_filters.submitted"],
  ["Clicked", "workspace.surveys.summary.response_filters.clicked"],
  ["Dismissed", "common.dismissed"],
  ["Applied", "workspace.surveys.summary.response_filters.applied"],
  ["Not applied", "workspace.surveys.summary.response_filters.not_applied"],
  ["Accepted", "common.accepted"],
  ["Screened in", "workspace.surveys.summary.response_filters.screened_in"],
  ["Screened out (overquota)", "workspace.surveys.summary.response_filters.screened_out"],
  ["Not in quota", "workspace.surveys.summary.response_filters.not_in_quota"],
];

describe("getFilterOperatorLabel", () => {
  test.each(OPERATOR_LABELS)("translates %s", (value, key) => {
    expect(getFilterOperatorLabel(value, TSurveyElementTypeEnum.NPS, t)).toBe(key);
  });

  test("leaves matrix rows alone — they are the survey author's wording", () => {
    expect(getFilterOperatorLabel("Skipped", TSurveyElementTypeEnum.Matrix, t)).toBe("Skipped");
  });

  test("falls back to the raw value when no label is mapped", () => {
    expect(getFilterOperatorLabel("Some new operator", TSurveyElementTypeEnum.OpenText, t)).toBe(
      "Some new operator"
    );
  });
});

describe("getFilterValueLabel", () => {
  test.each(VALUE_LABELS)("translates %s", (value, key) => {
    expect(getFilterValueLabel(value, "Quotas", t)).toBe(key);
  });

  test("numbers and unmapped values pass through", () => {
    expect(getFilterValueLabel("7", TSurveyElementTypeEnum.NPS, t)).toBe("7");
    expect(getFilterValueLabel("true", "Variables", t)).toBe("true");
  });

  test("numbers a picture choice in the reader's language", () => {
    expect(getFilterValueLabel("Picture 2", TSurveyElementTypeEnum.PictureSelection, t)).toBe(
      'workspace.surveys.summary.response_filters.picture_index:{"index":"2"}'
    );
  });

  test("never touches survey or response data", () => {
    // A choice, matrix column, contact attribute or observed meta value that happens to read like
    // one of our options must still be shown exactly as it was authored or captured.
    expect(getFilterValueLabel("Skipped", TSurveyElementTypeEnum.MultipleChoiceSingle, t)).toBe("Skipped");
    expect(getFilterValueLabel("Accepted", TSurveyElementTypeEnum.Matrix, t)).toBe("Accepted");
    expect(getFilterValueLabel("Dismissed", "Attributes", t)).toBe("Dismissed");
    expect(getFilterValueLabel("Picture 2", "Meta", t)).toBe("Picture 2");
    expect(getFilterValueLabel("Clicked", undefined, t)).toBe("Clicked");
  });
});

describe("getOtherFilterLabel", () => {
  test("translates Language, whose English label is also the stored filter key", () => {
    expect(getOtherFilterLabel("Language", t)).toBe("common.language");
  });

  test("falls back to the raw label", () => {
    expect(getOtherFilterLabel("Something else", t)).toBe("Something else");
  });
});
