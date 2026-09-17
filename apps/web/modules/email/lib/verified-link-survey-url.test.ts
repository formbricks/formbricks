import { describe, expect, test } from "vitest";
import { buildVerifiedLinkSurveyUrl } from "./verified-link-survey-url";

const baseParams = {
  publicDomain: "https://app.formbricks.com",
  surveyId: "survey-1",
  token: "verify-token",
};

const paramsOf = (url: string): URLSearchParams => new URL(url).searchParams;

describe("buildVerifiedLinkSurveyUrl", () => {
  test("carries the requested survey language back into the link", () => {
    const url = buildVerifiedLinkSurveyUrl({ ...baseParams, surveyLanguageCode: "de-DE" });

    expect(paramsOf(url).get("lang")).toBe("de-DE");
    expect(paramsOf(url).get("verify")).toBe("verify-token");
  });

  test("omits lang when the respondent chose nothing or stayed on the survey default", () => {
    expect(paramsOf(buildVerifiedLinkSurveyUrl(baseParams)).has("lang")).toBe(false);
    expect(
      paramsOf(buildVerifiedLinkSurveyUrl({ ...baseParams, surveyLanguageCode: "default" })).has("lang")
    ).toBe(false);
  });

  test("keeps single-use parameters intact alongside the language", () => {
    const params = paramsOf(
      buildVerifiedLinkSurveyUrl({
        ...baseParams,
        singleUseId: "su-1",
        singleUseToken: "su-token",
        surveyLanguageCode: "de-DE",
      })
    );

    expect(params.get("suId")).toBe("su-1");
    expect(params.get("suToken")).toBe("su-token");
    expect(params.get("verify")).toBe("verify-token");
    expect(params.get("lang")).toBe("de-DE");
  });

  test("omits suToken when there is none, and suId when the link is not single-use", () => {
    const withoutToken = paramsOf(buildVerifiedLinkSurveyUrl({ ...baseParams, singleUseId: "su-1" }));
    expect(withoutToken.get("suId")).toBe("su-1");
    expect(withoutToken.has("suToken")).toBe(false);

    // A single-use token without an id is meaningless — the id is what gets validated.
    const withoutId = paramsOf(buildVerifiedLinkSurveyUrl({ ...baseParams, singleUseToken: "su-token" }));
    expect(withoutId.has("suId")).toBe(false);
    expect(withoutId.has("suToken")).toBe(false);
  });

  test("points at the survey and encodes values that need it", () => {
    const url = buildVerifiedLinkSurveyUrl({
      ...baseParams,
      token: "a+b/c=",
      surveyLanguageCode: "zh-Hans-CN",
    });

    expect(url.startsWith("https://app.formbricks.com/s/survey-1?")).toBe(true);
    // The raw token would otherwise be read back as a space and a path separator.
    expect(url).not.toContain("a+b/c=");
    expect(paramsOf(url).get("verify")).toBe("a+b/c=");
    expect(paramsOf(url).get("lang")).toBe("zh-Hans-CN");
  });
});
