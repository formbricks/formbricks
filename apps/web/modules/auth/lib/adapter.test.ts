import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import type { AdapterAccount } from "next-auth/adapters";
import { createRequire } from "node:module";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { getNextAuthAdapter } from "./adapter";

type TCallbackHandler = (params: unknown) => Promise<unknown>;

const mocks = vi.hoisted(() => ({
  getUserByAccount: vi.fn(),
  getUserByEmail: vi.fn(),
  linkAccount: vi.fn(),
  unlinkAccount: vi.fn(),
  createUser: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@next-auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(),
}));

const requireNextAuthModule = createRequire(import.meta.url);
const nextAuthPackageRoot = path.dirname(requireNextAuthModule.resolve("next-auth"));
const callbackHandler = requireNextAuthModule(path.join(nextAuthPackageRoot, "core/lib/callback-handler.js"))
  .default as TCallbackHandler;

const baseAdapter = {
  getUserByAccount: mocks.getUserByAccount,
  getUserByEmail: mocks.getUserByEmail,
  linkAccount: mocks.linkAccount,
  unlinkAccount: mocks.unlinkAccount,
  createUser: mocks.createUser,
  createSession: mocks.createSession,
};

const prismaClient = {} as PrismaClient;

const azureAccount: AdapterAccount = {
  userId: "user_1",
  type: "oauth",
  provider: "azure-ad",
  providerAccountId: "sub-123",
};

describe("getNextAuthAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(PrismaAdapter).mockReturnValue(baseAdapter as never);
  });

  test("normalizes the Microsoft provider id to the canonical value when resolving a user", async () => {
    const user = { id: "user_1", email: "user@example.com" };
    mocks.getUserByAccount.mockResolvedValue(user);

    const adapter = getNextAuthAdapter(prismaClient);
    const result = await adapter.getUserByAccount?.({
      provider: "azure-ad",
      providerAccountId: "sub-123",
    });

    expect(mocks.getUserByAccount).toHaveBeenCalledWith({
      provider: "azuread",
      providerAccountId: "sub-123",
    });
    expect(result).toBe(user);
  });

  test("passes already-canonical providers through unchanged", async () => {
    mocks.getUserByAccount.mockResolvedValue(null);

    const adapter = getNextAuthAdapter(prismaClient);
    await adapter.getUserByAccount?.({ provider: "google", providerAccountId: "g-1" });

    expect(mocks.getUserByAccount).toHaveBeenCalledWith({
      provider: "google",
      providerAccountId: "g-1",
    });
  });

  test("normalizes the provider when linking and unlinking accounts", async () => {
    const adapter = getNextAuthAdapter(prismaClient);

    await adapter.linkAccount?.(azureAccount);
    await adapter.unlinkAccount?.({ provider: "azure-ad", providerAccountId: "sub-123" });

    expect(mocks.linkAccount).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "azuread", providerAccountId: "sub-123", userId: "user_1" })
    );
    expect(mocks.unlinkAccount).toHaveBeenCalledWith({
      provider: "azuread",
      providerAccountId: "sub-123",
    });
  });

  test("lets the NextAuth OAuth callback resolve canonical Microsoft account rows", async () => {
    const user = { id: "user_1", email: "user@example.com" };
    const session = {
      sessionToken: "session-token",
      userId: user.id,
      expires: new Date("2026-01-01T00:00:00.000Z"),
    };

    mocks.getUserByAccount.mockImplementation(async ({ provider }) => (provider === "azuread" ? user : null));
    mocks.getUserByEmail.mockResolvedValue(user);
    mocks.createSession.mockResolvedValue(session);

    const result = await callbackHandler({
      sessionToken: undefined,
      profile: { id: "profile_1", email: user.email },
      account: azureAccount,
      options: {
        adapter: getNextAuthAdapter(prismaClient),
        events: {},
        jwt: {},
        provider: { id: "azure-ad" },
        session: {
          strategy: "database",
          generateSessionToken: () => "session-token",
          maxAge: 60 * 60,
        },
      },
    });

    expect(result).toEqual({
      session,
      user,
      isNewUser: false,
    });
    expect(mocks.getUserByAccount).toHaveBeenCalledWith({
      provider: "azuread",
      providerAccountId: "sub-123",
    });
    expect(mocks.getUserByEmail).not.toHaveBeenCalled();
    expect(mocks.linkAccount).not.toHaveBeenCalled();
  });

  test("logs and rethrows when a delegated adapter method fails", async () => {
    const failure = new Error("database unavailable");
    mocks.getUserByAccount.mockRejectedValue(failure);

    const adapter = getNextAuthAdapter(prismaClient);

    await expect(
      adapter.getUserByAccount?.({ provider: "azure-ad", providerAccountId: "sub-123" })
    ).rejects.toThrow(failure);
    expect(logger.error).toHaveBeenCalledWith(failure, 'NextAuth Prisma adapter "getUserByAccount" failed');
  });

  test("preserves base adapter methods that do not key on the provider", () => {
    const adapter = getNextAuthAdapter(prismaClient);
    expect(adapter.createUser).toBe(mocks.createUser);
  });

  test("throws when the base adapter is missing required account methods", () => {
    vi.mocked(PrismaAdapter).mockReturnValueOnce({} as never);
    expect(() => getNextAuthAdapter(prismaClient)).toThrow(
      "PrismaAdapter is missing the account methods required for SSO sign-in"
    );
  });
});
