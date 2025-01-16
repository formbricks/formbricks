// authOptions.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
// External dependencies used within authOptions:
import { prisma } from "@formbricks/database";
import { EMAIL_VERIFICATION_DISABLED } from "@formbricks/lib/constants";
import { createToken } from "@formbricks/lib/jwt";
import { TUser } from "@formbricks/types/user";
// Some constants used in the module.

// Import the module under test. Adjust the path as needed.
import { authOptions } from "./authOptions";

const userId = "cm5yzxcp900000cl78fzocjal";
const hashedPassword = "$2a$12$LZsLq.9nkZlU0YDPx2aLNelnwD/nyavqbewLN.5.Q5h/UxRD8Ymcy";

export const mockUser: TUser = {
  id: "cm5yzxcp900000cl78fzocjal",
  name: "mock User",
  email: "test@unit.com",
  emailVerified: new Date(),
  imageUrl: "https://www.google.com",
  createdAt: new Date(),
  updatedAt: new Date(),
  twoFactorEnabled: false,
  identityProvider: "google",
  objective: "improve_user_retention",
  notificationSettings: {
    alert: {},
    weeklySummary: {},
    unsubscribedOrganizationIds: [],
  },
  role: "other",
  locale: "en-US",
};

// We need to mock the totp authenticator check function.
vi.mock("./totp", () => ({
  totpAuthenticatorCheck: vi.fn(),
}));

// Helper to get the provider by id from authOptions.providers.
function getProviderById(id: string): any {
  console.log("authOptions.providers", authOptions.providers[0].options);
  console.log("authOptions.providers", authOptions.providers[1].options);
  const provider = authOptions.providers.find((p: any) => p.options.id === id);
  if (!provider) {
    throw new Error(`Provider with id ${id} not found`);
  }
  return provider;
}

describe("authOptions", () => {
  // Reset mocks after each test.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CredentialsProvider (credentials) - email/password login", () => {
    const credentialsProvider = getProviderById("credentials");

    it("should throw error if credentials are not provided", async () => {
      // Convert to Promise.resolve() to ensure we're working with a Promise
      await expect(credentialsProvider.options.authorize(undefined, {})).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("should throw error if user not found", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(null);

      const credentials = { email: "test@example.com", password: "password123" };

      // Ensure the function correctly throws when user is not found
      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow("User not found");
    });

    it("should throw error if user has no password stored", async () => {
      // Stub prisma call to return a user without a password field
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: userId,
        email: "test@example.com",
        password: null,
      } as any);

      const credentials = { email: "test@example.com", password: "password123" };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "User has no password stored"
      );
    });

    it("should throw error if password verification fails", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({
        id: userId,
        email: "test@example.com",
        password: hashedPassword,
      });

      const credentials = { email: "test@example.com", password: "wrongPassword" };

      await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Invalid credentials"
      );
    });

    it("should successfully login when credentials are valid", async () => {
      const fakeUser = {
        id: userId,
        email: "test@example.com",
        password: hashedPassword,
        emailVerified: new Date(),
        imageUrl: "http://example.com/avatar.png",
        twoFactorEnabled: false,
      };

      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(fakeUser);

      const credentials = { email: "test@example.com", password: "password" };

      const result = await credentialsProvider.options.authorize(credentials, {});
      expect(result).toEqual({
        id: fakeUser.id,
        email: fakeUser.email,
        emailVerified: fakeUser.emailVerified,
        imageUrl: fakeUser.imageUrl,
      });
    });

    describe("Two-Factor Backup Code login", () => {
      it("should throw error if backup codes are missing", async () => {
        const mockUser = {
          id: userId,
          email: "2fa@example.com",
          password: hashedPassword,
          twoFactorEnabled: true,
          backupCodes: null,
        };
        vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser);

        const credentials = { email: "2fa@example.com", password: "password", backupCode: "123456" };

        await expect(credentialsProvider.options.authorize(credentials, {})).rejects.toThrow(
          "No backup codes found"
        );
      });
    });
  });

  describe("CredentialsProvider (token) - Token-based email verification", () => {
    const tokenProvider = getProviderById("token");
    console.log("tokenProvider", tokenProvider);

    it("should throw error if token is not provided", async () => {
      await expect(tokenProvider.options.authorize({}, {})).rejects.toThrow(
        "Either a user does not match the provided token or the token is invalid"
      );
    });

    it("should throw error if token is invalid or user not found", async () => {
      // Stub verifyToken to throw

      const credentials = { token: "badtoken" };

      await expect(tokenProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Either a user does not match the provided token or the token is invalid"
      );
    });

    it("should throw error if email is already verified", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(mockUser);

      const credentials = { token: createToken(mockUser.id, mockUser.email) };

      await expect(tokenProvider.options.authorize(credentials, {})).rejects.toThrow(
        "Email already verified"
      );
    });

    it("should update user and verify email when token is valid", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({ id: mockUser.id, emailVerified: null });
      vi.spyOn(prisma.user, "update").mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
        backupCodes: null,
        twoFactorSecret: null,
        identityProviderAccountId: null,
        groupId: null,
      });

      const credentials = { token: createToken(userId, mockUser.email) };

      const result = await tokenProvider.options.authorize(credentials, {});
      expect(result.email).toBe(mockUser.email);
      expect(result.emailVerified).toBeInstanceOf(Date);
    });
  });

  describe("Callbacks", () => {
    describe("jwt callback", () => {
      it("should add profile information to token if user is found", async () => {
        // Mock findFirst to return a properly formatted user object
        vi.spyOn(prisma.user, "findFirst").mockResolvedValue({
          id: mockUser.id,
          locale: mockUser.locale,
          email: mockUser.email,
          emailVerified: mockUser.emailVerified,
        });

        const token = { email: mockUser.email };
        const result = await authOptions?.callbacks?.jwt({ token });
        expect(result).toEqual({
          ...token,
          profile: { id: mockUser.id },
        });
      });

      it("should return token unchanged if no existing user is found", async () => {
        vi.spyOn(prisma.user, "findFirst").mockResolvedValue(null);

        const token = { email: "nonexistent@example.com" };
        const result = await authOptions.callbacks.jwt({ token } as any);
        expect(result).toEqual(token);
      });
    });

    describe("session callback", () => {
      it("should add user profile to session", async () => {
        const token = {
          id: "user6",
          profile: { id: "user6", email: "user6@example.com" },
        };

        const session = { user: {} };
        const result = await authOptions.callbacks.session({ session, token } as any);
        // In this implementation the session.user becomes token.profile.
        expect(result.user).toEqual(token.profile);
      });
    });

    describe("signIn callback", () => {
      it("should throw error if email is not verified and email verification is enabled", async () => {
        const user = { ...mockUser, emailVerified: null };
        const account = { provider: "credentials" } as any;
        // EMAIL_VERIFICATION_DISABLED is imported from constants.
        if (!EMAIL_VERIFICATION_DISABLED) {
          await expect(authOptions?.callbacks?.signIn({ user, account })).rejects.toThrow(
            "Email Verification is Pending"
          );
        }
      });
    });
  });
});
