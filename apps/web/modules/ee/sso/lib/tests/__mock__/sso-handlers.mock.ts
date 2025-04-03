import { Organization } from "@prisma/client";
import type { Account } from "next-auth";
import type { TUser } from "@formbricks/types/user";

// Mock user data
export const mockUser: TUser = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  notificationSettings: {
    alert: {},
    weeklySummary: {},
    unsubscribedOrganizationIds: [],
  },
  emailVerified: new Date(),
  imageUrl: "https://example.com/image.png",
  twoFactorEnabled: false,
  identityProvider: "google",
  locale: "en-US",
  role: "other",
  createdAt: new Date(),
  updatedAt: new Date(),
  objective: "improve_user_retention",
  lastLoginAt: new Date(),
};

// Mock account data
export const mockAccount: Account = {
  provider: "google",
  type: "oauth",
  providerAccountId: "provider-123",
};

// Mock OpenID account
export const mockOpenIdAccount: Account = {
  ...mockAccount,
  provider: "openid",
};

// Mock SAML account
export const mockSamlAccount: Account = {
  ...mockAccount,
  provider: "saml",
};

// Mock organization data
export const mockOrganization: Organization = {
  id: "org-123",
  name: "Test Organization",
  isAIEnabled: false,
  whitelabel: {
    enabled: false,
  },
  billing: {
    stripeCustomerId: null,
    plan: "free",
    period: "monthly",
    limits: { monthly: { responses: null, miu: null }, projects: null },
    periodStart: new Date(),
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock user with OpenID fields
export const mockOpenIdUser = (options?: {
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  email?: string;
}): TUser & {
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
} => ({
  ...mockUser,
  name: options?.name || "",
  given_name: options?.given_name,
  family_name: options?.family_name,
  preferred_username: options?.preferred_username,
  email: options?.email || mockUser.email,
});

// Mock created user response
export const mockCreatedUser = (name: string = mockUser.name): TUser => ({
  ...mockUser,
  name,
  emailVerified: new Date(),
});
