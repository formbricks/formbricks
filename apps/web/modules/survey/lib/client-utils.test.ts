import { describe, expect, test } from "vitest";
import { copySurveyLink } from "./client-utils";

describe("copySurveyLink", () => {
  const surveyUrl = "https://app.formbricks.com/s/someSurveyId";

  test("should return the surveyUrl with suId when singleUseId is provided", () => {
    const singleUseId = "someSingleUseId";
    const result = copySurveyLink(surveyUrl, singleUseId);
    expect(result).toBe(`${surveyUrl}?suId=${singleUseId}`);
  });

  test("should return just the surveyUrl when singleUseId is not provided", () => {
    const result = copySurveyLink(surveyUrl);
    expect(result).toBe(surveyUrl);
  });

  test("should return just the surveyUrl when singleUseId is an empty string", () => {
    const singleUseId = "";
    const result = copySurveyLink(surveyUrl, singleUseId);
    expect(result).toBe(surveyUrl);
  });

  test("should return just the surveyUrl when singleUseId is undefined", () => {
    const result = copySurveyLink(surveyUrl, undefined);
    expect(result).toBe(surveyUrl);
  });
});
