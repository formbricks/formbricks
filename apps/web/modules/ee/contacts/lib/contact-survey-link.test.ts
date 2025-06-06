import { ENCRYPTION_KEY, SURVEY_URL } from "@/lib/constants";
import * as crypto from "@/lib/crypto";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, test, vi } from "vitest";
import * as contactSurveyLink from "./contact-survey-link";

// Mock all modules needed (this gets hoisted to the top of the file)
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

// Mock constants - MUST be a literal object without using variables
vi.mock("@/lib/constants", () => ({
  ENCRYPTION_KEY: "test-encryption-key-32-chars-long!",
  SURVEY_URL: "https://test.formbricks.com",
}));

vi.mock("@/lib/crypto", () => ({
  symmetricEncrypt: vi.fn(),
  symmetricDecrypt: vi.fn(),
}));

describe("Contact Survey Link", () => {
  const mockContactId = "contact-123";
  const mockSurveyId = "survey-456";
  const mockToken = "mock.jwt.token";
  const mockEncryptedContactId = "encrypted-contact-id";
  const mockEncryptedSurveyId = "encrypted-survey-id";

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
  });

  describe("getContactSurveyLink", () => {
    test("creates a survey link with encrypted contact and survey IDs", () => {
      const result = contactSurveyLink.getContactSurveyLink(mockContactId, mockSurveyId);

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
        data: `${SURVEY_URL}/c/${mockToken}`,
      });
    });

    test("adds expiration to the token when expirationDays is provided", () => {
      const expirationDays = 7;
      contactSurveyLink.getContactSurveyLink(mockContactId, mockSurveyId, expirationDays);

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

    test("throws an error when ENCRYPTION_KEY is not available", async () => {
      // Reset modules so the new mock is used by the module under test
      vi.resetModules();
      // Re‑mock constants to simulate missing ENCRYPTION_KEY
      vi.doMock("@/lib/constants", () => ({
        ENCRYPTION_KEY: undefined,
        SURVEY_URL: "https://test.formbricks.com",
      }));
      // Re‑import the modules so they pick up the new mock
      const { getContactSurveyLink } = await import("./contact-survey-link");

      const result = getContactSurveyLink(mockContactId, mockSurveyId);
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

    test("throws an error when token verification fails", () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error("Token verification failed");
      });

      const result = contactSurveyLink.verifyContactSurveyToken(mockToken);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "bad_request",
          message: "Invalid or expired survey token",
          details: [{ field: "token", issue: "Invalid or expired survey token" }],
        });
      }
    });

    test("throws an error when token has invalid format", () => {
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
          message: "Invalid or expired survey token",
          details: [{ field: "token", issue: "Invalid or expired survey token" }],
        });
      }
    });

    test("throws an error when ENCRYPTION_KEY is not available", async () => {
      vi.resetModules();
      vi.doMock("@/lib/constants", () => ({
        ENCRYPTION_KEY: undefined,
        SURVEY_URL: "https://test.formbricks.com",
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
