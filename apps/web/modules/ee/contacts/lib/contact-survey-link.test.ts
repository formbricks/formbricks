import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENCRYPTION_KEY, WEBAPP_URL } from "@formbricks/lib/constants";
import * as crypto from "@formbricks/lib/crypto";
import { getContactSurveyLink, verifyContactSurveyToken } from "./contact-survey-link";

// Mock dependencies
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock("@formbricks/lib/constants", () => ({
  ENCRYPTION_KEY: "test-encryption-key-32-chars-long!",
  WEBAPP_URL: "https://test.formbricks.com",
}));

vi.mock("@formbricks/lib/crypto", () => ({
  symmetricEncrypt: vi.fn(),
}));

// Mock the imported symmetricDecrypt function
vi.mock("crypto", () => ({
  createDecipheriv: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnValue("decrypted"),
    final: vi.fn().mockReturnValue(""),
  }),
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

    vi.mocked(jwt.sign).mockReturnValue(mockToken);

    vi.mocked(jwt.verify).mockReturnValue({
      contactId: mockEncryptedContactId,
      surveyId: mockEncryptedSurveyId,
    });
  });

  describe("getContactSurveyLink", () => {
    it("creates a survey link with encrypted contact and survey IDs", () => {
      const result = getContactSurveyLink(mockContactId, mockSurveyId);

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
      getContactSurveyLink(mockContactId, mockSurveyId, expirationDays);

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
      // Temporarily mock ENCRYPTION_KEY as undefined
      const originalKey = ENCRYPTION_KEY;
      vi.mocked(ENCRYPTION_KEY as any, { partial: true }).mockReturnValue(undefined);

      expect(() => getContactSurveyLink(mockContactId, mockSurveyId)).toThrow(
        "Encryption key not found - cannot create personalized survey link"
      );

      // Restore the original value
      vi.mocked(ENCRYPTION_KEY as any, { partial: true }).mockReturnValue(originalKey);
    });
  });

  describe("verifyContactSurveyToken", () => {
    it("verifies and decrypts a valid token", () => {
      // Mock the implementation of symmetricDecrypt
      const originalModule = jest.requireActual("./contact-survey-link");
      const originalSymmetricDecrypt = originalModule.symmetricDecrypt;

      // Temporarily replace the implementation
      const symmetricDecryptSpy = vi
        .spyOn(originalModule, "symmetricDecrypt" as any)
        .mockImplementation((value) => {
          if (value === mockEncryptedContactId) return mockContactId;
          if (value === mockEncryptedSurveyId) return mockSurveyId;
          return value;
        });

      const result = verifyContactSurveyToken(mockToken);

      // Verify JWT verify was called
      expect(jwt.verify).toHaveBeenCalledWith(mockToken, ENCRYPTION_KEY);

      // Check the decrypted result
      expect(result).toEqual({
        contactId: mockContactId,
        surveyId: mockSurveyId,
      });

      // Restore original implementation
      symmetricDecryptSpy.mockRestore();
    });

    it("throws an error when token verification fails", () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error("Token verification failed");
      });

      expect(() => verifyContactSurveyToken(mockToken)).toThrow("Invalid or expired survey token");
    });

    it("throws an error when token has invalid format", () => {
      vi.mocked(jwt.verify).mockReturnValue({
        // Missing surveyId
        contactId: mockEncryptedContactId,
      });

      expect(() => verifyContactSurveyToken(mockToken)).toThrow("Invalid token format");
    });

    it("throws an error when ENCRYPTION_KEY is not available", () => {
      // Temporarily mock ENCRYPTION_KEY as undefined
      const originalKey = ENCRYPTION_KEY;
      vi.mocked(ENCRYPTION_KEY as any, { partial: true }).mockReturnValue(undefined);

      expect(() => verifyContactSurveyToken(mockToken)).toThrow(
        "Encryption key not found - cannot verify survey token"
      );

      // Restore the original value
      vi.mocked(ENCRYPTION_KEY as any, { partial: true }).mockReturnValue(originalKey);
    });
  });
});
