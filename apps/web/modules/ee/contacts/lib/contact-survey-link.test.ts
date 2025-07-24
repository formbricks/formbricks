import { ENCRYPTION_KEY } from "@/lib/constants";
import * as crypto from "@/lib/crypto";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { generateSurveySingleUseId } from "@/lib/utils/single-use-surveys";
import { getSurvey } from "@/modules/survey/lib/survey";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import * as contactSurveyLink from "./contact-survey-link";

// Mock all modules needed (this gets hoisted to the top of the file)
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
    TokenExpiredError: class TokenExpiredError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "TokenExpiredError";
      }
    },
  },
}));

// Mock constants - MUST be a literal object without using variables
vi.mock("@/lib/constants", () => ({
  ENCRYPTION_KEY: "test-encryption-key-32-chars-long!",
}));

vi.mock("@/lib/getPublicUrl", () => ({
  getPublicDomain: vi.fn().mockReturnValue("https://test.formbricks.com"),
}));

vi.mock("@/lib/crypto", () => ({
  symmetricEncrypt: vi.fn(),
  symmetricDecrypt: vi.fn(),
}));

vi.mock("@/modules/survey/lib/survey", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/lib/utils/single-use-surveys", () => ({
  generateSurveySingleUseId: vi.fn(),
}));

describe("Contact Survey Link", () => {
  const mockContactId = "contact-123";
  const mockSurveyId = "survey-456";
  const mockToken = "mock.jwt.token";
  const mockEncryptedContactId = "encrypted-contact-id";
  const mockEncryptedSurveyId = "encrypted-survey-id";
  const mockedGetSurvey = vi.mocked(getSurvey);
  const mockedGenerateSurveySingleUseId = vi.mocked(generateSurveySingleUseId);

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(crypto.symmetricEncrypt).mockImplementation((value) =>
      value === mockContactId ? mockEncryptedContactId : mockEncryptedSurveyId
    );

    vi.mocked(crypto.symmetricDecrypt).mockImplementation((value) => {
      if (value === mockEncryptedContactId) return mockContactId;
      if (value === mockEncryptedSurveyId) return mockSurveyId;
      return value;
    });

    vi.mocked(jwt.sign).mockReturnValue(mockToken as any);

    vi.mocked(jwt.verify).mockReturnValue({
      contactId: mockEncryptedContactId,
      surveyId: mockEncryptedSurveyId,
    } as any);

    mockedGetSurvey.mockResolvedValue({
      id: mockSurveyId,
      singleUse: { enabled: false, isEncrypted: false },
    } as TSurvey);
    mockedGenerateSurveySingleUseId.mockReturnValue("single-use-id");
  });

  describe("getContactSurveyLink", () => {
    test("creates a survey link with encrypted contact and survey IDs", async () => {
      const result = await contactSurveyLink.getContactSurveyLink(mockContactId, mockSurveyId);

      // Verify encryption was called for both IDs
      expect(crypto.symmetricEncrypt).toHaveBeenCalledWith(mockContactId, ENCRYPTION_KEY);
      expect(crypto.symmetricEncrypt).toHaveBeenCalledWith(mockSurveyId, ENCRYPTION_KEY);

      // Verify JWT sign was called with correct payload
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          contactId: mockEncryptedContactId,
          surveyId: mockEncryptedSurveyId,
        },
        ENCRYPTION_KEY,
        { algorithm: "HS256" }
      );

      // Verify the returned URL
      expect(result).toEqual({
        ok: true,
        data: `${getPublicDomain()}/c/${mockToken}`,
      });

      expect(mockedGenerateSurveySingleUseId).not.toHaveBeenCalled();
    });

    test("adds expiration to the token when expirationDays is provided", async () => {
      const expirationDays = 7;
      await contactSurveyLink.getContactSurveyLink(mockContactId, mockSurveyId, expirationDays);

      // Verify JWT sign was called with expiration
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          contactId: mockEncryptedContactId,
          surveyId: mockEncryptedSurveyId,
        },
        ENCRYPTION_KEY,
        { algorithm: "HS256", expiresIn: "7d" }
      );
    });

    test("returns a not_found error when survey does not exist", async () => {
      mockedGetSurvey.mockResolvedValue(null as unknown as TSurvey);

      const result = await contactSurveyLink.getContactSurveyLink(mockContactId, "unfound-survey-id");

      expect(result).toEqual({
        ok: false,
        error: {
          type: "not_found",
          message: "Survey not found",
          details: [{ field: "surveyId", issue: "not_found" }],
        },
      });
      expect(mockedGetSurvey).toHaveBeenCalledWith("unfound-survey-id");
    });

    test("creates a link with unencrypted single use ID when enabled", async () => {
      mockedGetSurvey.mockResolvedValue({
        id: mockSurveyId,
        singleUse: { enabled: true, isEncrypted: false },
      } as TSurvey);
      mockedGenerateSurveySingleUseId.mockReturnValue("suId-unencrypted");

      const result = await contactSurveyLink.getContactSurveyLink(mockContactId, mockSurveyId);

      expect(mockedGenerateSurveySingleUseId).toHaveBeenCalledWith(false);
      expect(result).toEqual({
        ok: true,
        data: `${getPublicDomain()}/c/${mockToken}?suId=suId-unencrypted`,
      });
    });

    test("creates a link with encrypted single use ID when enabled and encrypted", async () => {
      mockedGetSurvey.mockResolvedValue({
        id: mockSurveyId,
        singleUse: { enabled: true, isEncrypted: true },
      } as TSurvey);
      mockedGenerateSurveySingleUseId.mockReturnValue("suId-encrypted");

      const result = await contactSurveyLink.getContactSurveyLink(mockContactId, mockSurveyId);

      expect(mockedGenerateSurveySingleUseId).toHaveBeenCalledWith(true);
      expect(result).toEqual({
        ok: true,
        data: `${getPublicDomain()}/c/${mockToken}?suId=suId-encrypted`,
      });
    });

    test("returns an error when ENCRYPTION_KEY is not available", async () => {
      // Reset modules so the new mock is used by the module under test
      vi.resetModules();
      // Re‑mock constants to simulate missing ENCRYPTION_KEY
      vi.doMock("@/lib/constants", () => ({
        ENCRYPTION_KEY: undefined,
        PUBLIC_URL: "https://test.formbricks.com",
      }));
      // Re‑import the modules so they pick up the new mock
      const { getContactSurveyLink } = await import("./contact-survey-link");

      const result = await getContactSurveyLink(mockContactId, mockSurveyId);
      expect(result).toEqual({
        ok: false,
        error: {
          type: "internal_server_error",
          message: "Encryption key not found - cannot create personalized survey link",
        },
      });
    });
  });

  describe("verifyContactSurveyToken", () => {
    test("verifies and decrypts a valid token", () => {
      const result = contactSurveyLink.verifyContactSurveyToken(mockToken);

      // Verify JWT verify was called
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, ENCRYPTION_KEY);

      // Check the decrypted result
      expect(result).toEqual({
        ok: true,
        data: {
          contactId: mockContactId,
          surveyId: mockSurveyId,
        },
      });
    });

    test("returns an error when token verification fails", () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error("Token verification failed");
      });

      const result = contactSurveyLink.verifyContactSurveyToken(mockToken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "bad_request",
          message: "Invalid survey token",
          details: [{ field: "token", issue: "invalid_token" }],
        });
      }
    });

    test("returns an error when token has invalid format", () => {
      // Mock JWT.verify to return an incomplete payload
      vi.mocked(jwt.verify).mockReturnValue({
        // Missing surveyId
        contactId: mockEncryptedContactId,
      } as any);

      // Suppress console.error for this test
      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = contactSurveyLink.verifyContactSurveyToken(mockToken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "bad_request",
          message: "Invalid survey token",
          details: [{ field: "token", issue: "invalid_token" }],
        });
      }
    });

    test("returns an error when ENCRYPTION_KEY is not available", async () => {
      vi.resetModules();
      vi.doMock("@/lib/constants", () => ({
        ENCRYPTION_KEY: undefined,
      }));
      const { verifyContactSurveyToken } = await import("./contact-survey-link");
      const result = verifyContactSurveyToken(mockToken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          message: "Encryption key not found - cannot verify survey token",
        });
      }
    });
  });
});
