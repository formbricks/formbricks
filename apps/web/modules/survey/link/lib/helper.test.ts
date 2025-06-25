import { verifyTokenForLinkSurvey } from "@/lib/jwt";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getEmailVerificationDetails } from "./helper";

vi.mock("@/lib/jwt", () => ({
  verifyTokenForLinkSurvey: vi.fn(),
}));

describe("getEmailVerificationDetails", () => {
  const mockedVerifyTokenForLinkSurvey = vi.mocked(verifyTokenForLinkSurvey);
  const testSurveyId = "survey-123";
  const testEmail = "test@example.com";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("returns not-verified status when no token is provided", async () => {
    const result = await getEmailVerificationDetails(testSurveyId, "");

    expect(result).toEqual({ status: "not-verified" });
    expect(mockedVerifyTokenForLinkSurvey).not.toHaveBeenCalled();
  });

  test("returns verified status with email when token is valid", async () => {
    mockedVerifyTokenForLinkSurvey.mockReturnValueOnce(testEmail);
    const testToken = "valid-token";

    const result = await getEmailVerificationDetails(testSurveyId, testToken);

    expect(result).toEqual({ status: "verified", email: testEmail });
    expect(mockedVerifyTokenForLinkSurvey).toHaveBeenCalledWith(testToken, testSurveyId);
  });

  test("returns fishy status when token verification returns falsy value", async () => {
    mockedVerifyTokenForLinkSurvey.mockReturnValueOnce("");
    const testToken = "fishy-token";

    const result = await getEmailVerificationDetails(testSurveyId, testToken);

    expect(result).toEqual({ status: "fishy" });
    expect(mockedVerifyTokenForLinkSurvey).toHaveBeenCalledWith(testToken, testSurveyId);
  });

  test("returns not-verified status when verification throws an error", async () => {
    mockedVerifyTokenForLinkSurvey.mockImplementationOnce(() => {
      throw new Error("Verification failed");
    });
    const testToken = "error-token";

    const result = await getEmailVerificationDetails(testSurveyId, testToken);

    expect(result).toEqual({ status: "not-verified" });
    expect(mockedVerifyTokenForLinkSurvey).toHaveBeenCalledWith(testToken, testSurveyId);
  });
});
