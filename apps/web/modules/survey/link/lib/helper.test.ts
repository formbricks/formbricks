import { validateSurveySingleUseId } from "@/app/lib/singleUseSurveys";
import { verifyTokenForLinkSurvey } from "@/lib/jwt";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { checkAndValidateSingleUseId, getEmailVerificationDetails } from "./helper";

vi.mock("@/lib/jwt", () => ({
  verifyTokenForLinkSurvey: vi.fn(),
}));

vi.mock("@/app/lib/singleUseSurveys", () => ({
  validateSurveySingleUseId: vi.fn(),
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

describe("checkAndValidateSingleUseId", () => {
  const mockedValidateSurveySingleUseId = vi.mocked(validateSurveySingleUseId);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("returns null when no suid is provided", () => {
    const result = checkAndValidateSingleUseId();

    expect(result).toBeNull();
    expect(mockedValidateSurveySingleUseId).not.toHaveBeenCalled();
  });

  test("returns null when suid is empty string", () => {
    const result = checkAndValidateSingleUseId("");

    expect(result).toBeNull();
    expect(mockedValidateSurveySingleUseId).not.toHaveBeenCalled();
  });

  test("returns suid as-is when isEncrypted is false", () => {
    const testSuid = "plain-suid-123";
    const result = checkAndValidateSingleUseId(testSuid, false);

    expect(result).toBe(testSuid);
    expect(mockedValidateSurveySingleUseId).not.toHaveBeenCalled();
  });

  test("returns suid as-is when isEncrypted is not provided (defaults to false)", () => {
    const testSuid = "plain-suid-123";
    const result = checkAndValidateSingleUseId(testSuid);

    expect(result).toBe(testSuid);
    expect(mockedValidateSurveySingleUseId).not.toHaveBeenCalled();
  });

  test("returns validated suid when isEncrypted is true and validation succeeds", () => {
    const encryptedSuid = "encrypted-suid-123";
    const validatedSuid = "validated-suid-456";
    mockedValidateSurveySingleUseId.mockReturnValueOnce(validatedSuid);

    const result = checkAndValidateSingleUseId(encryptedSuid, true);

    expect(result).toBe(validatedSuid);
    expect(mockedValidateSurveySingleUseId).toHaveBeenCalledWith(encryptedSuid);
  });

  test("returns null when isEncrypted is true and validation returns undefined", () => {
    const encryptedSuid = "invalid-encrypted-suid";
    mockedValidateSurveySingleUseId.mockReturnValueOnce(undefined);

    const result = checkAndValidateSingleUseId(encryptedSuid, true);

    expect(result).toBeNull();
    expect(mockedValidateSurveySingleUseId).toHaveBeenCalledWith(encryptedSuid);
  });

  test("returns null when isEncrypted is true and validation returns empty string", () => {
    const encryptedSuid = "invalid-encrypted-suid";
    mockedValidateSurveySingleUseId.mockReturnValueOnce("");

    const result = checkAndValidateSingleUseId(encryptedSuid, true);

    expect(result).toBeNull();
    expect(mockedValidateSurveySingleUseId).toHaveBeenCalledWith(encryptedSuid);
  });

  test("returns null when isEncrypted is true and validation returns null", () => {
    const encryptedSuid = "invalid-encrypted-suid";
    mockedValidateSurveySingleUseId.mockReturnValueOnce(null as any);

    const result = checkAndValidateSingleUseId(encryptedSuid, true);

    expect(result).toBeNull();
    expect(mockedValidateSurveySingleUseId).toHaveBeenCalledWith(encryptedSuid);
  });
});
