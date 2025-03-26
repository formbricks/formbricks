import { describe, expect, it } from "vitest";
import { copySurveyLink } from "../client-utils";

describe("copySurveyLink", () => {
  it("appends singleUseId when provided", () => {
    const surveyUrl = "http://example.com/survey";
    const singleUseId = "12345";
    const result = copySurveyLink(surveyUrl, singleUseId);
    expect(result).toBe("http://example.com/survey?suId=12345");
  });

  it("returns original surveyUrl when singleUseId is not provided", () => {
    const surveyUrl = "http://example.com/survey";
    const result = copySurveyLink(surveyUrl);
    expect(result).toBe(surveyUrl);
  });
});
