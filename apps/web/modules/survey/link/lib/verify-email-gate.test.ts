import { describe, expect, test, vi } from "vitest";

const { verifyTokenForLinkSurveyMock } = vi.hoisted(() => ({
  verifyTokenForLinkSurveyMock: vi.fn(),
}));

vi.mock("@/lib/jwt", () => ({
  verifyTokenForLinkSurvey: verifyTokenForLinkSurveyMock,
}));

const { resolveVerifiedEmailFromResponseMeta } = await import("./verify-email-gate");

const SURVEY_ID = "survey_abc";

describe("resolveVerifiedEmailFromResponseMeta", () => {
  test("returns the verified email for a valid token in the submission URL", () => {
    verifyTokenForLinkSurveyMock.mockReturnValue("respondent@example.com");

    const email = resolveVerifiedEmailFromResponseMeta(
      SURVEY_ID,
      `https://app.example.com/s/${SURVEY_ID}?verify=tok123&lang=de`
    );

    expect(email).toBe("respondent@example.com");
    // The survey id is passed through so the token stays bound to this survey.
    expect(verifyTokenForLinkSurveyMock).toHaveBeenCalledWith("tok123", SURVEY_ID);
  });

  test("returns null when the token does not verify", () => {
    verifyTokenForLinkSurveyMock.mockReturnValue(null);

    expect(
      resolveVerifiedEmailFromResponseMeta(SURVEY_ID, `https://app.example.com/s/${SURVEY_ID}?verify=nope`)
    ).toBeNull();
  });

  // These are the shapes an attacker submitting straight to the public response endpoint would send.
  test.each([
    ["no verify param", `https://app.example.com/s/${SURVEY_ID}`],
    ["empty verify param", `https://app.example.com/s/${SURVEY_ID}?verify=`],
    ["unparseable url", "not a url"],
    ["missing url", undefined],
    ["null url", null],
  ])("returns null when the submission URL has %s", (_label, metaUrl) => {
    verifyTokenForLinkSurveyMock.mockReturnValue("respondent@example.com");

    expect(resolveVerifiedEmailFromResponseMeta(SURVEY_ID, metaUrl)).toBeNull();
    expect(verifyTokenForLinkSurveyMock).not.toHaveBeenCalled();
  });
});
