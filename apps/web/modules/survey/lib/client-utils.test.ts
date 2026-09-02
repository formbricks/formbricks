import { describe, expect, test } from "vitest";
import { copySurveyLink } from "./client-utils";

describe("copySurveyLink", () => {
  test("returns the survey url unchanged", () => {
    const surveyUrl = "https://app.formbricks.com/s/someSurveyId";
    expect(copySurveyLink(surveyUrl)).toBe(surveyUrl);
  });
});
