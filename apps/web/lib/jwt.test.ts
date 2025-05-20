import { env } from "@/lib/env";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
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

// Mock environment variables
vi.mock("@/lib/env", () => ({
  env: {
    ENCRYPTION_KEY: "0".repeat(32), // 32-byte key for AES-256-GCM
    NEXTAUTH_SECRET: "test-nextauth-secret",
  } as typeof env,
}));

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("JWT Functions", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
  });

  describe("createToken", () => {
    test("should create a valid token", () => {
      const token = createToken(mockUser.id, mockUser.email);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
    });
  });

  describe("createTokenForLinkSurvey", () => {
    test("should create a valid survey link token", () => {
      const surveyId = "test-survey-id";
      const token = createTokenForLinkSurvey(surveyId, mockUser.email);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
    });
  });

  describe("createEmailToken", () => {
    test("should create a valid email token", () => {
      const token = createEmailToken(mockUser.email);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
    });

    test("should throw error if NEXTAUTH_SECRET is not set", () => {
      const originalSecret = env.NEXTAUTH_SECRET;
      try {
        (env as any).NEXTAUTH_SECRET = undefined;
        expect(() => createEmailToken(mockUser.email)).toThrow("NEXTAUTH_SECRET is not set");
      } finally {
        (env as any).NEXTAUTH_SECRET = originalSecret;
      }
    });
  });

  describe("getEmailFromEmailToken", () => {
    test("should extract email from valid token", () => {
      const token = createEmailToken(mockUser.email);
      const extractedEmail = getEmailFromEmailToken(token);
      expect(extractedEmail).toBe(mockUser.email);
    });
  });

  describe("createInviteToken", () => {
    test("should create a valid invite token", () => {
      const inviteId = "test-invite-id";
      const token = createInviteToken(inviteId, mockUser.email);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
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
  });

  describe("verifyToken", () => {
    test("should verify valid token", async () => {
      const token = createToken(mockUser.id, mockUser.email);
      const verified = await verifyToken(token);
      expect(verified).toEqual({
        id: mockUser.id,
        email: mockUser.email,
      });
    });

    test("should throw error if user not found", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      const token = createToken(mockUser.id, mockUser.email);
      await expect(verifyToken(token)).rejects.toThrow("User not found");
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
  });

  describe("verifyEmailChangeToken", () => {
    test("should verify and decrypt valid email change token", async () => {
      const userId = "test-user-id";
      const email = "test@example.com";
      const token = createEmailChangeToken(userId, email);
      const result = await verifyEmailChangeToken(token);
      expect(result).toEqual({ id: userId, email });
    });

    test("should throw error if token is invalid or missing fields", async () => {
      // Create a token with missing fields
      const jwt = await import("jsonwebtoken");
      const token = jwt.sign({ foo: "bar" }, env.NEXTAUTH_SECRET as string);
      await expect(verifyEmailChangeToken(token)).rejects.toThrow(
        "Token is invalid or missing required fields"
      );
    });

    test("should return original id/email if decryption fails", async () => {
      // Create a token with non-encrypted id/email
      const jwt = await import("jsonwebtoken");
      const payload = { id: "plain-id", email: "plain@example.com" };
      const token = jwt.sign(payload, env.NEXTAUTH_SECRET as string);
      const result = await verifyEmailChangeToken(token);
      expect(result).toEqual(payload);
    });
  });
});
