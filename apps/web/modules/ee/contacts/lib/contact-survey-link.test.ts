import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENCRYPTION_KEY, WEBAPP_URL } from "@formbricks/lib/constants";
import * as crypto from "@formbricks/lib/crypto";
import * as contactSurveyLink from "./contact-survey-link";

// Mock all modules needed (this gets hoisted to the top of the file)
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

// Mock constants - MUST be a literal object without using variables
vi.mock("@formbricks/lib/constants", () => ({
  ENCRYPTION_KEY: "test-encryption-key-32-chars-long!",
  WEBAPP_URL: "https://test.formbricks.com",
}));

vi.mock("@formbricks/lib/crypto", () => ({
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

    vi.mocked(jwt.sign).mockReturnValue(mockToken);

    vi.mocked(jwt.verify).mockReturnValue({
      contactId: mockEncryptedContactId,
      surveyId: mockEncryptedSurveyId,
    });
  });

  describe("getContactSurveyLink", () => {
    it("creates a survey link with encrypted contact and survey IDs", () => {
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
      expect(result).toBe(`${WEBAPP_URL}/c/${mockToken}`);
    });

    it("adds expiration to the token when expirationDays is provided", () => {
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

    it("throws an error when ENCRYPTION_KEY is not available", () => {
      // Mock the module temporarily to simulate missing ENCRYPTION_KEY
      const originalEncryptionKey = ENCRYPTION_KEY;
      Object.defineProperty(require("@formbricks/lib/constants"), "ENCRYPTION_KEY", {
        value: undefined,
        configurable: true,
      });

      expect(() => contactSurveyLink.getContactSurveyLink(mockContactId, mockSurveyId)).toThrow(
        "Encryption key not found - cannot create personalized survey link"
      );

      // Reset the ENCRYPTION_KEY back to its original value
      Object.defineProperty(require("@formbricks/lib/constants"), "ENCRYPTION_KEY", {
        value: originalEncryptionKey,
        configurable: true,
      });
    });
  });

  describe("verifyContactSurveyToken", () => {
    it("verifies and decrypts a valid token", () => {
      const result = contactSurveyLink.verifyContactSurveyToken(mockToken);

      // Verify JWT verify was called
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, ENCRYPTION_KEY);

      // Check the decrypted result
      expect(result).toEqual({
        contactId: mockContactId,
        surveyId: mockSurveyId,
      });
    });

    it("throws an error when token verification fails", () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error("Token verification failed");
      });

      expect(() => contactSurveyLink.verifyContactSurveyToken(mockToken)).toThrow(
        "Invalid or expired survey token"
      );
    });

    it("throws an error when token has invalid format", () => {
      // Mock JWT.verify to return an incomplete payload
      vi.mocked(jwt.verify).mockReturnValue({
        // Missing surveyId
        contactId: mockEncryptedContactId,
      });

      // Suppress console.error for this test
      vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => contactSurveyLink.verifyContactSurveyToken(mockToken)).toThrow(
        "Invalid or expired survey token"
      );
    });

    it("throws an error when ENCRYPTION_KEY is not available", () => {
      // Mock the module temporarily to simulate missing ENCRYPTION_KEY
      const originalEncryptionKey = ENCRYPTION_KEY;
      Object.defineProperty(require("@formbricks/lib/constants"), "ENCRYPTION_KEY", {
        value: undefined,
        configurable: true,
      });

      expect(() => contactSurveyLink.verifyContactSurveyToken(mockToken)).toThrow(
        "Encryption key not found - cannot verify survey token"
      );

      // Reset the ENCRYPTION_KEY back to its original value
      Object.defineProperty(require("@formbricks/lib/constants"), "ENCRYPTION_KEY", {
        value: originalEncryptionKey,
        configurable: true,
      });
    });
  });
});
