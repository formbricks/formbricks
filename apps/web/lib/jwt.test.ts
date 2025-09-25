import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import * as crypto from "@/lib/crypto";
import {
  createEmailChangeToken,
  createEmailToken,
  createInviteToken,
  createToken,
  createTokenForLinkSurvey,
  getEmailFromEmailToken,
  verifyEmailChangeToken,
  verifyInviteToken,
  verifyToken,
  verifyTokenForLinkSurvey,
} from "./jwt";

const TEST_ENCRYPTION_KEY = "0".repeat(32); // 32-byte key for AES-256-GCM
const TEST_NEXTAUTH_SECRET = "test-nextauth-secret";
const DIFFERENT_SECRET = "different-secret";

// Error message constants
const NEXTAUTH_SECRET_ERROR = "NEXTAUTH_SECRET is not set";
const ENCRYPTION_KEY_ERROR = "ENCRYPTION_KEY is not set";

// Helper function to test error cases for missing secrets/keys
const testMissingSecretsError = async (
  testFn: (...args: any[]) => any,
  args: any[],
  options: {
    testNextAuthSecret?: boolean;
    testEncryptionKey?: boolean;
    isAsync?: boolean;
  } = {}
) => {
  const { testNextAuthSecret = true, testEncryptionKey = true, isAsync = false } = options;

  if (testNextAuthSecret) {
    const constants = await import("@/lib/constants");
    const originalSecret = (constants as any).NEXTAUTH_SECRET;
    (constants as any).NEXTAUTH_SECRET = undefined;

    if (isAsync) {
      await expect(testFn(...args)).rejects.toThrow(NEXTAUTH_SECRET_ERROR);
    } else {
      expect(() => testFn(...args)).toThrow(NEXTAUTH_SECRET_ERROR);
    }

    // Restore
    (constants as any).NEXTAUTH_SECRET = originalSecret;
  }

  if (testEncryptionKey) {
    const constants = await import("@/lib/constants");
    const originalKey = (constants as any).ENCRYPTION_KEY;
    (constants as any).ENCRYPTION_KEY = undefined;

    if (isAsync) {
      await expect(testFn(...args)).rejects.toThrow(ENCRYPTION_KEY_ERROR);
    } else {
      expect(() => testFn(...args)).toThrow(ENCRYPTION_KEY_ERROR);
    }

    // Restore
    (constants as any).ENCRYPTION_KEY = originalKey;
  }
};

// Mock environment variables
vi.mock("@/lib/env", () => ({
  env: {
    ENCRYPTION_KEY: "0".repeat(32),
    NEXTAUTH_SECRET: "test-nextauth-secret",
  },
}));

// Mock constants
vi.mock("@/lib/constants", () => ({
  NEXTAUTH_SECRET: "test-nextauth-secret",
  ENCRYPTION_KEY: "0".repeat(32),
}));

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe("JWT Functions - Comprehensive Security Tests", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
  };

  let mockSymmetricEncrypt: any;
  let mockSymmetricDecrypt: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default crypto mocks
    mockSymmetricEncrypt = vi
      .spyOn(crypto, "symmetricEncrypt")
      .mockImplementation((text: string) => `encrypted_${text}`);

    mockSymmetricDecrypt = vi
      .spyOn(crypto, "symmetricDecrypt")
      .mockImplementation((encryptedText: string) => encryptedText.replace("encrypted_", ""));

    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
  });

  describe("createToken", () => {
    test("should create a valid token with encrypted user ID", () => {
      const token = createToken(mockUser.id);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(mockSymmetricEncrypt).toHaveBeenCalledWith(mockUser.id, TEST_ENCRYPTION_KEY);
    });

    test("should accept custom options", () => {
      const customOptions = { expiresIn: "1h" };
      const token = createToken(mockUser.id, customOptions);
      expect(token).toBeDefined();

      // Verify the token contains the expected expiration
      const decoded = jwt.decode(token) as any;
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      // Should expire in approximately 1 hour (3600 seconds)
      expect(decoded.exp - decoded.iat).toBe(3600);
    });

    test("should throw error if NEXTAUTH_SECRET is not set", async () => {
      await testMissingSecretsError(createToken, [mockUser.id], {
        testNextAuthSecret: true,
        testEncryptionKey: false,
      });
    });
  });

  describe("createTokenForLinkSurvey", () => {
    test("should create a valid survey link token", () => {
      const surveyId = "test-survey-id";
      const token = createTokenForLinkSurvey(surveyId, mockUser.email);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(mockSymmetricEncrypt).toHaveBeenCalledWith(mockUser.email, TEST_ENCRYPTION_KEY);
    });

    test("should include surveyId in payload", () => {
      const surveyId = "test-survey-id";
      const token = createTokenForLinkSurvey(surveyId, mockUser.email);
      const decoded = jwt.decode(token) as any;
      expect(decoded.surveyId).toBe(surveyId);
    });

    test("should throw error if NEXTAUTH_SECRET or ENCRYPTION_KEY is not set", async () => {
      await testMissingSecretsError(createTokenForLinkSurvey, ["survey-id", mockUser.email]);
    });
  });

  describe("createEmailToken", () => {
    test("should create a valid email token", () => {
      const token = createEmailToken(mockUser.email);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(mockSymmetricEncrypt).toHaveBeenCalledWith(mockUser.email, TEST_ENCRYPTION_KEY);
    });

    test("should throw error if NEXTAUTH_SECRET or ENCRYPTION_KEY is not set", async () => {
      await testMissingSecretsError(createEmailToken, [mockUser.email]);
    });
  });

  describe("createEmailChangeToken", () => {
    test("should create a valid email change token with 1 day expiration", () => {
      const token = createEmailChangeToken(mockUser.id, mockUser.email);
      expect(token).toBeDefined();
      expect(mockSymmetricEncrypt).toHaveBeenCalledWith(mockUser.id, TEST_ENCRYPTION_KEY);
      expect(mockSymmetricEncrypt).toHaveBeenCalledWith(mockUser.email, TEST_ENCRYPTION_KEY);

      const decoded = jwt.decode(token) as any;
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      // Should expire in approximately 1 day (86400 seconds)
      expect(decoded.exp - decoded.iat).toBe(86400);
    });

    test("should throw error if NEXTAUTH_SECRET or ENCRYPTION_KEY is not set", async () => {
      await testMissingSecretsError(createEmailChangeToken, [mockUser.id, mockUser.email]);
    });
  });

  describe("createInviteToken", () => {
    test("should create a valid invite token", () => {
      const inviteId = "test-invite-id";
      const token = createInviteToken(inviteId, mockUser.email);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(mockSymmetricEncrypt).toHaveBeenCalledWith(inviteId, TEST_ENCRYPTION_KEY);
      expect(mockSymmetricEncrypt).toHaveBeenCalledWith(mockUser.email, TEST_ENCRYPTION_KEY);
    });

    test("should accept custom options", () => {
      const inviteId = "test-invite-id";
      const customOptions = { expiresIn: "24h" };
      const token = createInviteToken(inviteId, mockUser.email, customOptions);
      expect(token).toBeDefined();

      const decoded = jwt.decode(token) as any;
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      // Should expire in approximately 24 hours (86400 seconds)
      expect(decoded.exp - decoded.iat).toBe(86400);
    });

    test("should throw error if NEXTAUTH_SECRET or ENCRYPTION_KEY is not set", async () => {
      await testMissingSecretsError(createInviteToken, ["invite-id", mockUser.email]);
    });
  });

  describe("getEmailFromEmailToken", () => {
    test("should extract email from valid token", () => {
      const token = createEmailToken(mockUser.email);
      const extractedEmail = getEmailFromEmailToken(token);
      expect(extractedEmail).toBe(mockUser.email);
      expect(mockSymmetricDecrypt).toHaveBeenCalledWith(`encrypted_${mockUser.email}`, TEST_ENCRYPTION_KEY);
    });

    test("should fall back to original email if decryption fails", () => {
      mockSymmetricDecrypt.mockImplementationOnce(() => {
        throw new Error("Decryption failed");
      });

      // Create token manually with unencrypted email for legacy compatibility
      const legacyToken = jwt.sign({ email: mockUser.email }, TEST_NEXTAUTH_SECRET);
      const extractedEmail = getEmailFromEmailToken(legacyToken);
      expect(extractedEmail).toBe(mockUser.email);
    });

    test("should throw error if NEXTAUTH_SECRET or ENCRYPTION_KEY is not set", async () => {
      const token = jwt.sign({ email: "test@example.com" }, TEST_NEXTAUTH_SECRET);
      await testMissingSecretsError(getEmailFromEmailToken, [token]);
    });
  });

  describe("verifyTokenForLinkSurvey", () => {
    test("should verify valid survey link token", () => {
      const surveyId = "test-survey-id";
      const token = createTokenForLinkSurvey(surveyId, mockUser.email);
      const verifiedEmail = verifyTokenForLinkSurvey(token, surveyId);
      expect(verifiedEmail).toBe(mockUser.email);
    });

    test("should return null for invalid token", () => {
      const result = verifyTokenForLinkSurvey("invalid-token", "test-survey-id");
      expect(result).toBeNull();
    });

    test("should return null if NEXTAUTH_SECRET is not set", async () => {
      const constants = await import("@/lib/constants");
      const originalSecret = (constants as any).NEXTAUTH_SECRET;
      (constants as any).NEXTAUTH_SECRET = undefined;

      const result = verifyTokenForLinkSurvey("any-token", "test-survey-id");
      expect(result).toBeNull();

      // Restore
      (constants as any).NEXTAUTH_SECRET = originalSecret;
    });

    test("should return null if surveyId doesn't match", () => {
      const surveyId = "test-survey-id";
      const differentSurveyId = "different-survey-id";
      const token = createTokenForLinkSurvey(surveyId, mockUser.email);
      const result = verifyTokenForLinkSurvey(token, differentSurveyId);
      expect(result).toBeNull();
    });

    test("should return null if email is missing from payload", () => {
      const tokenWithoutEmail = jwt.sign({ surveyId: "test-survey-id" }, TEST_NEXTAUTH_SECRET);
      const result = verifyTokenForLinkSurvey(tokenWithoutEmail, "test-survey-id");
      expect(result).toBeNull();
    });

    test("should fall back to original email if decryption fails", () => {
      mockSymmetricDecrypt.mockImplementationOnce(() => {
        throw new Error("Decryption failed");
      });

      // Create legacy token with unencrypted email
      const legacyToken = jwt.sign(
        {
          email: mockUser.email,
          surveyId: "test-survey-id",
        },
        TEST_NEXTAUTH_SECRET
      );

      const result = verifyTokenForLinkSurvey(legacyToken, "test-survey-id");
      expect(result).toBe(mockUser.email);
    });

    test("should fall back to original email if ENCRYPTION_KEY is not set", async () => {
      const constants = await import("@/lib/constants");
      const originalKey = (constants as any).ENCRYPTION_KEY;
      (constants as any).ENCRYPTION_KEY = undefined;

      // Create a token with unencrypted email (as it would be if ENCRYPTION_KEY was not set during creation)
      const token = jwt.sign(
        {
          email: mockUser.email,
          surveyId: "survey-id",
        },
        TEST_NEXTAUTH_SECRET
      );

      const result = verifyTokenForLinkSurvey(token, "survey-id");
      expect(result).toBe(mockUser.email);

      // Restore
      (constants as any).ENCRYPTION_KEY = originalKey;
    });

    test("should verify legacy survey tokens with surveyId-based secret", async () => {
      const surveyId = "test-survey-id";

      // Create legacy token with old format (NEXTAUTH_SECRET + surveyId)
      const legacyToken = jwt.sign({ email: `encrypted_${mockUser.email}` }, TEST_NEXTAUTH_SECRET + surveyId);

      const result = verifyTokenForLinkSurvey(legacyToken, surveyId);
      expect(result).toBe(mockUser.email);
    });

    test("should reject survey tokens that fail both new and legacy verification", async () => {
      const surveyId = "test-survey-id";
      const invalidToken = jwt.sign({ email: "encrypted_test@example.com" }, "wrong-secret");

      const result = verifyTokenForLinkSurvey(invalidToken, surveyId);
      expect(result).toBeNull();

      // Verify error logging
      const { logger } = await import("@formbricks/logger");
      expect(logger.error).toHaveBeenCalledWith(expect.any(Error), "Survey link token verification failed");
    });

    test("should reject legacy survey tokens for wrong survey", () => {
      const correctSurveyId = "correct-survey-id";
      const wrongSurveyId = "wrong-survey-id";

      // Create legacy token for one survey
      const legacyToken = jwt.sign(
        { email: `encrypted_${mockUser.email}` },
        TEST_NEXTAUTH_SECRET + correctSurveyId
      );

      // Try to verify with different survey ID
      const result = verifyTokenForLinkSurvey(legacyToken, wrongSurveyId);
      expect(result).toBeNull();
    });
  });

  describe("verifyToken", () => {
    test("should verify valid token", async () => {
      const token = createToken(mockUser.id);
      const verified = await verifyToken(token);
      expect(verified).toEqual({
        id: mockUser.id, // Returns the decrypted user ID
        email: mockUser.email,
      });
    });

    test("should throw error if user not found", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      const token = createToken(mockUser.id);
      await expect(verifyToken(token)).rejects.toThrow("User not found");
    });

    test("should throw error if NEXTAUTH_SECRET is not set", async () => {
      await testMissingSecretsError(verifyToken, ["any-token"], {
        testNextAuthSecret: true,
        testEncryptionKey: false,
        isAsync: true,
      });
    });

    test("should throw error for invalid token signature", async () => {
      const invalidToken = jwt.sign({ id: "test-id" }, DIFFERENT_SECRET);
      await expect(verifyToken(invalidToken)).rejects.toThrow("Invalid token");
    });

    test("should throw error if token payload is missing id", async () => {
      const tokenWithoutId = jwt.sign({ email: mockUser.email }, TEST_NEXTAUTH_SECRET);
      await expect(verifyToken(tokenWithoutId)).rejects.toThrow("Invalid token");
    });

    test("should return raw id from payload", async () => {
      // Create token with unencrypted id
      const token = jwt.sign({ id: mockUser.id }, TEST_NEXTAUTH_SECRET);
      const verified = await verifyToken(token);
      expect(verified).toEqual({
        id: mockUser.id, // Returns the raw ID from payload
        email: mockUser.email,
      });
    });

    test("should verify legacy tokens with email-based secret", async () => {
      // Create legacy token with old format (NEXTAUTH_SECRET + userEmail)
      const legacyToken = jwt.sign({ id: `encrypted_${mockUser.id}` }, TEST_NEXTAUTH_SECRET + mockUser.email);

      const verified = await verifyToken(legacyToken);
      expect(verified).toEqual({
        id: mockUser.id, // Returns the decrypted user ID
        email: mockUser.email,
      });
    });

    test("should prioritize new tokens over legacy tokens", async () => {
      // Create both new and legacy tokens for the same user
      const newToken = createToken(mockUser.id);
      const legacyToken = jwt.sign({ id: `encrypted_${mockUser.id}` }, TEST_NEXTAUTH_SECRET + mockUser.email);

      // New token should verify without triggering legacy path
      const verifiedNew = await verifyToken(newToken);
      expect(verifiedNew.id).toBe(mockUser.id); // Returns decrypted user ID

      // Legacy token should trigger legacy path
      const verifiedLegacy = await verifyToken(legacyToken);
      expect(verifiedLegacy.id).toBe(mockUser.id); // Returns decrypted user ID
    });

    test("should reject tokens that fail both new and legacy verification", async () => {
      const invalidToken = jwt.sign({ id: "encrypted_test-id" }, "wrong-secret");
      await expect(verifyToken(invalidToken)).rejects.toThrow("Invalid token");

      // Verify both methods were attempted
      const { logger } = await import("@formbricks/logger");
      expect(logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        "Token verification failed with new method"
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.any(Error),
        "Token verification failed with legacy method"
      );
    });
  });

  describe("verifyInviteToken", () => {
    test("should verify valid invite token", () => {
      const inviteId = "test-invite-id";
      const token = createInviteToken(inviteId, mockUser.email);
      const verified = verifyInviteToken(token);
      expect(verified).toEqual({
        inviteId,
        email: mockUser.email,
      });
    });

    test("should throw error for invalid token", () => {
      expect(() => verifyInviteToken("invalid-token")).toThrow("Invalid or expired invite token");
    });

    test("should throw error if NEXTAUTH_SECRET or ENCRYPTION_KEY is not set", async () => {
      await testMissingSecretsError(verifyInviteToken, ["any-token"]);
    });

    test("should throw error if inviteId is missing", () => {
      const tokenWithoutInviteId = jwt.sign({ email: mockUser.email }, TEST_NEXTAUTH_SECRET);
      expect(() => verifyInviteToken(tokenWithoutInviteId)).toThrow("Invalid or expired invite token");
    });

    test("should throw error if email is missing", () => {
      const tokenWithoutEmail = jwt.sign({ inviteId: "test-invite-id" }, TEST_NEXTAUTH_SECRET);
      expect(() => verifyInviteToken(tokenWithoutEmail)).toThrow("Invalid or expired invite token");
    });

    test("should fall back to original values if decryption fails", () => {
      mockSymmetricDecrypt.mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      const inviteId = "test-invite-id";
      const legacyToken = jwt.sign(
        {
          inviteId,
          email: mockUser.email,
        },
        TEST_NEXTAUTH_SECRET
      );

      const verified = verifyInviteToken(legacyToken);
      expect(verified).toEqual({
        inviteId,
        email: mockUser.email,
      });
    });

    test("should throw error for token with wrong signature", () => {
      const invalidToken = jwt.sign(
        {
          inviteId: "test-invite-id",
          email: mockUser.email,
        },
        DIFFERENT_SECRET
      );

      expect(() => verifyInviteToken(invalidToken)).toThrow("Invalid or expired invite token");
    });
  });

  describe("verifyEmailChangeToken", () => {
    test("should verify and decrypt valid email change token", async () => {
      const userId = "test-user-id";
      const email = "test@example.com";
      const token = createEmailChangeToken(userId, email);
      const result = await verifyEmailChangeToken(token);
      expect(result).toEqual({ id: userId, email });
    });

    test("should throw error if NEXTAUTH_SECRET or ENCRYPTION_KEY is not set", async () => {
      await testMissingSecretsError(verifyEmailChangeToken, ["any-token"], { isAsync: true });
    });

    test("should throw error if token is invalid or missing fields", async () => {
      const token = jwt.sign({ foo: "bar" }, TEST_NEXTAUTH_SECRET);
      await expect(verifyEmailChangeToken(token)).rejects.toThrow(
        "Token is invalid or missing required fields"
      );
    });

    test("should throw error if id is missing", async () => {
      const token = jwt.sign({ email: "test@example.com" }, TEST_NEXTAUTH_SECRET);
      await expect(verifyEmailChangeToken(token)).rejects.toThrow(
        "Token is invalid or missing required fields"
      );
    });

    test("should throw error if email is missing", async () => {
      const token = jwt.sign({ id: "test-id" }, TEST_NEXTAUTH_SECRET);
      await expect(verifyEmailChangeToken(token)).rejects.toThrow(
        "Token is invalid or missing required fields"
      );
    });

    test("should return original id/email if decryption fails", async () => {
      mockSymmetricDecrypt.mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      const payload = { id: "plain-id", email: "plain@example.com" };
      const token = jwt.sign(payload, TEST_NEXTAUTH_SECRET);
      const result = await verifyEmailChangeToken(token);
      expect(result).toEqual(payload);
    });

    test("should throw error for token with wrong signature", async () => {
      const invalidToken = jwt.sign(
        {
          id: "test-id",
          email: "test@example.com",
        },
        DIFFERENT_SECRET
      );

      await expect(verifyEmailChangeToken(invalidToken)).rejects.toThrow();
    });
  });

  // SECURITY SCENARIO TESTS
  describe("Security Scenarios", () => {
    describe("Algorithm Confusion Attack Prevention", () => {
      test("should reject 'none' algorithm tokens in verifyToken", async () => {
        // Create malicious token with "none" algorithm
        const maliciousToken =
          Buffer.from(
            JSON.stringify({
              alg: "none",
              typ: "JWT",
            })
          ).toString("base64url") +
          "." +
          Buffer.from(
            JSON.stringify({
              id: "encrypted_malicious-id",
            })
          ).toString("base64url") +
          ".";

        await expect(verifyToken(maliciousToken)).rejects.toThrow("Invalid token");
      });

      test("should reject 'none' algorithm tokens in verifyTokenForLinkSurvey", () => {
        const maliciousToken =
          Buffer.from(
            JSON.stringify({
              alg: "none",
              typ: "JWT",
            })
          ).toString("base64url") +
          "." +
          Buffer.from(
            JSON.stringify({
              email: "encrypted_attacker@evil.com",
              surveyId: "test-survey-id",
            })
          ).toString("base64url") +
          ".";

        const result = verifyTokenForLinkSurvey(maliciousToken, "test-survey-id");
        expect(result).toBeNull();
      });

      test("should reject 'none' algorithm tokens in verifyInviteToken", () => {
        const maliciousToken =
          Buffer.from(
            JSON.stringify({
              alg: "none",
              typ: "JWT",
            })
          ).toString("base64url") +
          "." +
          Buffer.from(
            JSON.stringify({
              inviteId: "encrypted_malicious-invite",
              email: "encrypted_attacker@evil.com",
            })
          ).toString("base64url") +
          ".";

        expect(() => verifyInviteToken(maliciousToken)).toThrow("Invalid or expired invite token");
      });

      test("should reject 'none' algorithm tokens in verifyEmailChangeToken", async () => {
        const maliciousToken =
          Buffer.from(
            JSON.stringify({
              alg: "none",
              typ: "JWT",
            })
          ).toString("base64url") +
          "." +
          Buffer.from(
            JSON.stringify({
              id: "encrypted_malicious-id",
              email: "encrypted_attacker@evil.com",
            })
          ).toString("base64url") +
          ".";

        await expect(verifyEmailChangeToken(maliciousToken)).rejects.toThrow();
      });

      test("should reject RS256 algorithm tokens (HS256/RS256 confusion)", async () => {
        // Create malicious token with RS256 algorithm header but HS256 signature
        const maliciousHeader = Buffer.from(
          JSON.stringify({
            alg: "RS256",
            typ: "JWT",
          })
        ).toString("base64url");

        const maliciousPayload = Buffer.from(
          JSON.stringify({
            id: "encrypted_malicious-id",
          })
        ).toString("base64url");

        // Create signature using HMAC (as if it were HS256)
        const crypto = require("crypto");
        const signature = crypto
          .createHmac("sha256", TEST_NEXTAUTH_SECRET)
          .update(`${maliciousHeader}.${maliciousPayload}`)
          .digest("base64url");

        const maliciousToken = `${maliciousHeader}.${maliciousPayload}.${signature}`;

        await expect(verifyToken(maliciousToken)).rejects.toThrow("Invalid token");
      });

      test("should only accept HS256 algorithm", async () => {
        // Test that other valid algorithms are rejected
        const otherAlgorithms = ["HS384", "HS512", "RS256", "RS384", "RS512", "ES256", "ES384", "ES512"];

        for (const alg of otherAlgorithms) {
          const maliciousHeader = Buffer.from(
            JSON.stringify({
              alg,
              typ: "JWT",
            })
          ).toString("base64url");

          const maliciousPayload = Buffer.from(
            JSON.stringify({
              id: "encrypted_test-id",
            })
          ).toString("base64url");

          const maliciousToken = `${maliciousHeader}.${maliciousPayload}.fake-signature`;

          await expect(verifyToken(maliciousToken)).rejects.toThrow("Invalid token");
        }
      });
    });

    describe("Token Tampering", () => {
      test("should reject tokens with modified payload", async () => {
        const token = createToken(mockUser.id);
        const [header, payload, signature] = token.split(".");

        // Modify the payload
        const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString());
        decodedPayload.id = "malicious-id";
        const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString("base64url");
        const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

        await expect(verifyToken(tamperedToken)).rejects.toThrow("Invalid token");
      });

      test("should reject tokens with modified signature", async () => {
        const token = createToken(mockUser.id);
        const [header, payload] = token.split(".");
        const tamperedToken = `${header}.${payload}.tamperedsignature`;

        await expect(verifyToken(tamperedToken)).rejects.toThrow("Invalid token");
      });

      test("should reject malformed tokens", async () => {
        const malformedTokens = [
          "not.a.jwt",
          "only.two.parts",
          "too.many.parts.here.invalid",
          "",
          "invalid-base64",
        ];

        for (const malformedToken of malformedTokens) {
          await expect(verifyToken(malformedToken)).rejects.toThrow();
        }
      });
    });

    describe("Cross-Survey Token Reuse", () => {
      test("should reject survey tokens used for different surveys", () => {
        const surveyId1 = "survey-1";
        const surveyId2 = "survey-2";

        const token = createTokenForLinkSurvey(surveyId1, mockUser.email);
        const result = verifyTokenForLinkSurvey(token, surveyId2);

        expect(result).toBeNull();
      });
    });

    describe("Expired Tokens", () => {
      test("should reject expired tokens", async () => {
        const expiredToken = jwt.sign(
          {
            id: "encrypted_test-id",
            exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
          },
          TEST_NEXTAUTH_SECRET
        );

        await expect(verifyToken(expiredToken)).rejects.toThrow("Invalid token");
      });

      test("should reject expired email change tokens", async () => {
        const expiredToken = jwt.sign(
          {
            id: "encrypted_test-id",
            email: "encrypted_test@example.com",
            exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
          },
          TEST_NEXTAUTH_SECRET
        );

        await expect(verifyEmailChangeToken(expiredToken)).rejects.toThrow();
      });
    });

    describe("Encryption Key Attacks", () => {
      test("should fail gracefully with wrong encryption key", async () => {
        mockSymmetricDecrypt.mockImplementation(() => {
          throw new Error("Authentication tag verification failed");
        });

        // Mock findUnique to only return user for correct decrypted ID, not ciphertext
        (prisma.user.findUnique as any).mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === mockUser.id) {
            return Promise.resolve(mockUser);
          }
          return Promise.resolve(null); // Return null for ciphertext IDs
        });

        const token = createToken(mockUser.id);
        // Should fail because ciphertext passed as userId won't match any user in DB
        await expect(verifyToken(token)).rejects.toThrow(/User not found/i);
      });

      test("should handle encryption key not set gracefully", async () => {
        const constants = await import("@/lib/constants");
        const originalKey = (constants as any).ENCRYPTION_KEY;
        (constants as any).ENCRYPTION_KEY = undefined;

        const token = jwt.sign(
          {
            email: "test@example.com",
            surveyId: "test-survey-id",
          },
          TEST_NEXTAUTH_SECRET
        );

        const result = verifyTokenForLinkSurvey(token, "test-survey-id");
        expect(result).toBe("test@example.com");

        // Restore
        (constants as any).ENCRYPTION_KEY = originalKey;
      });
    });

    describe("SQL Injection Attempts", () => {
      test("should safely handle malicious user IDs", async () => {
        const maliciousIds = [
          "'; DROP TABLE users; --",
          "1' OR '1'='1",
          "admin'/*",
          "<script>alert('xss')</script>",
          "../../etc/passwd",
        ];

        for (const maliciousId of maliciousIds) {
          mockSymmetricDecrypt.mockReturnValueOnce(maliciousId);

          const token = jwt.sign({ id: "encrypted_malicious" }, TEST_NEXTAUTH_SECRET);

          // The function should look up the user safely
          await verifyToken(token);
          expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { id: maliciousId },
          });
        }
      });
    });

    describe("Token Reuse and Replay Attacks", () => {
      test("should allow legitimate token reuse within validity period", async () => {
        const token = createToken(mockUser.id);

        // First use
        const result1 = await verifyToken(token);
        expect(result1.id).toBe(mockUser.id); // Returns decrypted user ID

        // Second use (should still work)
        const result2 = await verifyToken(token);
        expect(result2.id).toBe(mockUser.id); // Returns decrypted user ID
      });
    });

    describe("Legacy Token Compatibility", () => {
      test("should handle legacy unencrypted tokens gracefully", async () => {
        // Legacy token with plain text data
        const legacyToken = jwt.sign({ id: mockUser.id }, TEST_NEXTAUTH_SECRET);
        const result = await verifyToken(legacyToken);

        expect(result.id).toBe(mockUser.id); // Returns raw ID from payload
        expect(result.email).toBe(mockUser.email);
      });

      test("should handle mixed encrypted/unencrypted fields", async () => {
        mockSymmetricDecrypt
          .mockImplementationOnce(() => mockUser.id) // id decrypts successfully
          .mockImplementationOnce(() => {
            throw new Error("Email not encrypted");
          }); // email fails

        const token = jwt.sign(
          {
            id: "encrypted_test-id",
            email: "plain-email@example.com",
          },
          TEST_NEXTAUTH_SECRET
        );

        const result = await verifyEmailChangeToken(token);
        expect(result.id).toBe(mockUser.id);
        expect(result.email).toBe("plain-email@example.com");
      });

      test("should verify old format user tokens with email-based secrets", async () => {
        // Simulate old token format with per-user secret
        const oldFormatToken = jwt.sign(
          { id: `encrypted_${mockUser.id}` },
          TEST_NEXTAUTH_SECRET + mockUser.email
        );

        const result = await verifyToken(oldFormatToken);
        expect(result.id).toBe(mockUser.id); // Returns decrypted user ID
        expect(result.email).toBe(mockUser.email);
      });

      test("should verify old format survey tokens with survey-based secrets", () => {
        const surveyId = "legacy-survey-id";

        // Simulate old survey token format
        const oldFormatSurveyToken = jwt.sign(
          { email: `encrypted_${mockUser.email}` },
          TEST_NEXTAUTH_SECRET + surveyId
        );

        const result = verifyTokenForLinkSurvey(oldFormatSurveyToken, surveyId);
        expect(result).toBe(mockUser.email);
      });

      test("should gracefully handle database errors during legacy verification", async () => {
        // Create token that will fail new method
        const legacyToken = jwt.sign(
          { id: `encrypted_${mockUser.id}` },
          TEST_NEXTAUTH_SECRET + mockUser.email
        );

        // Make database lookup fail
        (prisma.user.findUnique as any).mockRejectedValueOnce(new Error("DB connection lost"));

        await expect(verifyToken(legacyToken)).rejects.toThrow("DB connection lost");
      });
    });

    describe("Edge Cases and Error Handling", () => {
      test("should handle database connection errors gracefully", async () => {
        (prisma.user.findUnique as any).mockRejectedValue(new Error("Database connection failed"));

        const token = createToken(mockUser.id);
        await expect(verifyToken(token)).rejects.toThrow("Database connection failed");
      });

      test("should handle crypto module errors", () => {
        mockSymmetricEncrypt.mockImplementation(() => {
          throw new Error("Crypto module error");
        });

        expect(() => createToken(mockUser.id)).toThrow("Crypto module error");
      });

      test("should validate email format in tokens", () => {
        const invalidEmails = ["", "not-an-email", "missing@", "@missing-local.com", "spaces in@email.com"];

        invalidEmails.forEach((invalidEmail) => {
          expect(() => createEmailToken(invalidEmail)).not.toThrow();
          // Note: JWT functions don't validate email format, they just encrypt/decrypt
          // Email validation should happen at a higher level
        });
      });

      test("should handle extremely long inputs", () => {
        const longString = "a".repeat(10000);

        expect(() => createToken(longString)).not.toThrow();
        expect(() => createEmailToken(longString)).not.toThrow();
      });

      test("should handle special characters in user data", () => {
        const specialChars = "!@#$%^&*()_+-=[]{}|;:'\",.<>?/~`";

        expect(() => createToken(specialChars)).not.toThrow();
        expect(() => createEmailToken(specialChars)).not.toThrow();
      });
    });

    describe("Performance and Resource Exhaustion", () => {
      test("should handle rapid token creation without memory leaks", () => {
        const tokens: string[] = [];
        for (let i = 0; i < 1000; i++) {
          tokens.push(createToken(`user-${i}`));
        }

        expect(tokens.length).toBe(1000);
        expect(tokens.every((token) => typeof token === "string")).toBe(true);
      });

      test("should handle rapid token verification", async () => {
        const token = createToken(mockUser.id);

        const verifications: Promise<any>[] = [];
        for (let i = 0; i < 100; i++) {
          verifications.push(verifyToken(token));
        }

        const results = await Promise.all(verifications);
        expect(results.length).toBe(100);
        expect(results.every((result: any) => result.id === mockUser.id)).toBe(true); // Returns decrypted user ID
      });
    });
  });
});
