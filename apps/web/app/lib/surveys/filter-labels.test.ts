import { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { getFilterOperatorLabel, getFilterValueLabel, getOtherFilterLabel } from "./filter-labels";

// Stands in for react-i18next: returns the key so a test can assert which key was looked up, and
// interpolates like i18next does for the one label that takes a variable.
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction;

describe("getFilterOperatorLabel", () => {
  test("translates the operators we generate", () => {
    expect(getFilterOperatorLabel("Includes either", TSurveyElementTypeEnum.NPS, t)).toBe(
      "workspace.surveys.summary.includes_either"
    );
    expect(getFilterOperatorLabel("Does not start with", "Meta", t)).toBe(
      "workspace.surveys.edit.does_not_start_with"
    );
    expect(getFilterOperatorLabel("Status", "Quotas", t)).toBe("common.status");
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
  test("translates the values we generate", () => {
    expect(getFilterValueLabel("Filled out", TSurveyElementTypeEnum.OpenText, t)).toBe(
      "workspace.surveys.summary.response_filters.filled_out"
    );
    expect(getFilterValueLabel("Not applied", "Tags", t)).toBe(
      "workspace.surveys.summary.response_filters.not_applied"
    );
    expect(getFilterValueLabel("Screened out (overquota)", "Quotas", t)).toBe(
      "workspace.surveys.summary.response_filters.screened_out"
    );
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
