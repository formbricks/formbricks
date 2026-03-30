import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import {
  INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
  InvalidPasswordResetTokenError,
} from "@formbricks/types/errors";
import type { TUser } from "@formbricks/types/user";
import { hashPassword } from "@/lib/auth";
import { hashString } from "@/lib/hash-string";
import { sendPasswordResetLinkEmail, sendPasswordResetNotifyEmail } from "@/modules/email";
import {
  ACCOUNT_RECOVERY_LINK_EMAIL_ERROR_CODE,
  completePasswordReset,
  getPasswordResetTokenLifetimeInMinutes,
  requestPasswordReset,
} from "./password-reset-service";
import type { TPasswordResetTokenRecord } from "./password-reset-token-repository";

type TPasswordResetTestUser = Pick<TUser, "id" | "email" | "locale" | "emailVerified"> & {
  password: string;
};

type TPasswordResetAuditUserFixture = Pick<
  TPasswordResetTestUser,
  "id" | "email" | "locale" | "emailVerified"
>;

type TPasswordResetTransactionStub = {
  user: {
    findUnique: (args: { where: { id: string } }) => Promise<TPasswordResetAuditUserFixture | null>;
    update: (args: {
      where: { id: string };
      data: { password: string };
    }) => Promise<TPasswordResetAuditUserFixture>;
  };
};

const testState = vi.hoisted(() => {
  const tokenStore = new Map<string, TPasswordResetTokenRecord>();
  const users = new Map<string, TPasswordResetTestUser>();

  const selectAuditUser = (user: TPasswordResetTestUser): TPasswordResetAuditUserFixture => ({
    id: user.id,
    email: user.email,
    locale: user.locale,
    emailVerified: user.emailVerified,
  });

  const mockUpsertActiveToken = vi.fn(async (userId: string, tokenHash: string, expiresAt: Date) => {
    const existingRecord = tokenStore.get(userId);
    const now = new Date();
    const record = {
      id: existingRecord?.id ?? `prt_${userId}`,
      userId,
      tokenHash,
      expiresAt,
      createdAt: existingRecord?.createdAt ?? now,
      updatedAt: now,
    };

    tokenStore.set(userId, record);
    return record;
  });

  const mockFindByTokenHash = vi.fn(async (tokenHash: string) => {
    return [...tokenStore.values()].find((record) => record.tokenHash === tokenHash) ?? null;
  });

  const mockDeleteByTokenHash = vi.fn(async (tokenHash: string) => {
    const existingRecord = [...tokenStore.values()].find((record) => record.tokenHash === tokenHash);

    if (!existingRecord) {
      return 0;
    }

    tokenStore.delete(existingRecord.userId);
    return 1;
  });

  const mockConsumeActiveToken = vi.fn(async (tokenHash: string, now: Date) => {
    const record = [...tokenStore.values()].find(
      (storedRecord) => storedRecord.tokenHash === tokenHash && storedRecord.expiresAt > now
    );

    if (!record) {
      return 0;
    }

    tokenStore.delete(record.userId);
    return 1;
  });

  const mockTransaction = vi.fn(async <T>(callback: (tx: TPasswordResetTransactionStub) => Promise<T>) => {
    const tx: TPasswordResetTransactionStub = {
      user: {
        findUnique: vi.fn(async ({ where }) => {
          const user = users.get(where.id);
          return user ? selectAuditUser(user) : null;
        }),
        update: vi.fn(async ({ where, data }) => {
          const user = users.get(where.id);

          if (!user) {
            throw new Error("User not found");
          }

          const updatedUser = {
            ...user,
            password: data.password,
          };

          users.set(where.id, updatedUser);
          return selectAuditUser(updatedUser);
        }),
      },
    };

    return await callback(tx);
  });

  return {
    tokenStore,
    users,
    mockUpsertActiveToken,
    mockFindByTokenHash,
    mockDeleteByTokenHash,
    mockConsumeActiveToken,
    mockTransaction,
  };
});

const constantsState = vi.hoisted(() => ({
  debugShowResetLink: false,
}));

vi.mock("@/lib/hash-string", () => ({
  hashString: vi.fn((value: string) => `hash:${value}`),
}));

vi.mock("@/lib/constants", () => ({
  PASSWORD_RESET_TOKEN_LIFETIME_MINUTES: 30,
  WEBAPP_URL: "http://localhost:3000",
  get DEBUG_SHOW_RESET_LINK() {
    return constantsState.debugShowResetLink;
  },
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));

vi.mock("@/modules/email", () => ({
  sendPasswordResetLinkEmail: vi.fn(async () => true),
  sendPasswordResetNotifyEmail: vi.fn(async () => true),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: testState.mockTransaction,
  },
}));

vi.mock("./password-reset-token-repository", () => ({
  upsertActiveToken: testState.mockUpsertActiveToken,
  findByTokenHash: testState.mockFindByTokenHash,
  deleteByTokenHash: testState.mockDeleteByTokenHash,
  consumeActiveToken: testState.mockConsumeActiveToken,
}));

describe("password-reset-service", () => {
  const user = {
    id: "cm8z6bn2q000008l34h8g7k9m",
    email: "user@example.com",
    locale: "en-US" as const,
  };

  const parseTokenFromResetLink = (): string => {
    const lastCall = vi.mocked(sendPasswordResetLinkEmail).mock.calls.at(-1);
    const verifyLink = lastCall?.[0]?.verifyLink;

    if (!verifyLink) {
      throw new Error("No verify link found");
    }

    const url = new URL(verifyLink);
    const token = url.searchParams.get("token");

    if (!token) {
      throw new Error("No token found in verify link");
    }

    return token;
  };

  const parseTokenFromDebugLog = (): string => {
    const verifyLink = vi
      .mocked(logger.info)
      .mock.calls.map(([payload]) => payload?.verifyLink)
      .find((loggedVerifyLink): loggedVerifyLink is string => typeof loggedVerifyLink === "string");

    if (!verifyLink) {
      throw new Error("No debug verify link found");
    }

    const url = new URL(verifyLink);
    const token = url.searchParams.get("token");

    if (!token) {
      throw new Error("No token found in debug verify link");
    }

    return token;
  };

  const getStoredToken = (userId: string): TPasswordResetTokenRecord => {
    const storedToken = testState.tokenStore.get(userId);

    if (!storedToken) {
      throw new Error("No stored token found");
    }

    return storedToken;
  };

  const getStoredUser = (userId: string): TPasswordResetTestUser => {
    const storedUser = testState.users.get(userId);

    if (!storedUser) {
      throw new Error("No stored user found");
    }

    return storedUser;
  };

  beforeEach(() => {
    constantsState.debugShowResetLink = false;
    testState.tokenStore.clear();
    testState.users.clear();
    testState.users.set(user.id, {
      ...user,
      emailVerified: null,
      password: "old-password-hash",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  test("issues a hashed token with the configured default lifetime", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T12:00:00.000Z"));

    await requestPasswordReset(user, "public");

    const rawToken = parseTokenFromResetLink();
    const storedToken = getStoredToken(user.id);

    expect(getPasswordResetTokenLifetimeInMinutes()).toBe(30);
    expect(storedToken.tokenHash).toBe(`hash:${rawToken}`);
    expect(storedToken.tokenHash).not.toBe(rawToken);
    expect(storedToken.expiresAt).toEqual(new Date("2026-03-30T12:30:00.000Z"));
    expect(sendPasswordResetLinkEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: user.email,
        locale: user.locale,
        linkValidityInMinutes: 30,
      })
    );
  });

  test("invalidates the previous token when a new reset request is issued", async () => {
    await requestPasswordReset(user, "public");
    const firstToken = parseTokenFromResetLink();

    await requestPasswordReset(user, "public");
    const secondToken = parseTokenFromResetLink();

    await expect(completePasswordReset(firstToken, "Password123")).rejects.toMatchObject({
      name: "InvalidPasswordResetTokenError",
      message: INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
    });

    const result = await completePasswordReset(secondToken, "Password123");

    expect(result.userId).toBe(user.id);
    expect(getStoredUser(user.id).password).toBe("hashed:Password123");
  });

  test("rejects expired reset tokens", async () => {
    await requestPasswordReset(user, "public");
    const token = parseTokenFromResetLink();

    testState.tokenStore.set(user.id, {
      ...getStoredToken(user.id),
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    await expect(completePasswordReset(token, "Password123")).rejects.toMatchObject({
      name: "InvalidPasswordResetTokenError",
      reason: "expired",
      message: INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "consume",
        reason: "expired",
        userId: user.id,
      }),
      "Rejected password reset token"
    );
  });

  test("rejects unknown and legacy jwt reset tokens", async () => {
    await expect(completePasswordReset("unknown-token", "Password123")).rejects.toBeInstanceOf(
      InvalidPasswordResetTokenError
    );
    await expect(completePasswordReset("legacy.jwt.token", "Password123")).rejects.toMatchObject({
      reason: "legacy_jwt",
      message: INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
    });
  });

  test("consumes a token only once", async () => {
    await requestPasswordReset(user, "public");
    const token = parseTokenFromResetLink();

    await expect(completePasswordReset(token, "Password123")).resolves.toMatchObject({
      userId: user.id,
    });
    await expect(completePasswordReset(token, "Password123")).rejects.toBeInstanceOf(
      InvalidPasswordResetTokenError
    );
  });

  test("allows only one successful result for concurrent token submissions", async () => {
    await requestPasswordReset(user, "public");
    const token = parseTokenFromResetLink();

    const results = await Promise.allSettled([
      completePasswordReset(token, "Password123"),
      completePasswordReset(token, "Password123"),
    ]);

    const fulfilledResults = results.filter((result) => result.status === "fulfilled");
    const rejectedResults = results.filter((result) => result.status === "rejected");

    expect(fulfilledResults).toHaveLength(1);
    expect(rejectedResults).toHaveLength(1);
    expect((rejectedResults[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      InvalidPasswordResetTokenError
    );
  });

  test("revokes the issued token when email delivery fails for a public request", async () => {
    vi.mocked(sendPasswordResetLinkEmail).mockResolvedValueOnce(false);

    await expect(requestPasswordReset(user, "public")).resolves.toBeUndefined();

    const revokedToken = parseTokenFromResetLink();

    expect(testState.tokenStore.size).toBe(0);
    expect(testState.mockDeleteByTokenHash).toHaveBeenCalledWith(`hash:${revokedToken}`);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "public",
        stage: "send",
        userId: user.id,
      }),
      "Password reset request failed"
    );
  });

  test("logs the reset link instead of sending an email when DEBUG_SHOW_RESET_LINK is enabled", async () => {
    constantsState.debugShowResetLink = true;

    await requestPasswordReset(user, "public");

    expect(sendPasswordResetLinkEmail).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        verifyLink: expect.stringMatching(/^http:\/\/localhost:3000\/auth\/forgot-password\/reset\?token=/),
      }),
      "DEBUG_SHOW_RESET_LINK is enabled; password reset email delivery skipped"
    );
  });

  test("logs and suppresses token issuance failures for public requests", async () => {
    testState.mockUpsertActiveToken.mockRejectedValueOnce(new Error("Database unavailable"));

    await expect(requestPasswordReset(user, "public")).resolves.toBeUndefined();

    expect(sendPasswordResetLinkEmail).not.toHaveBeenCalled();
    expect(testState.mockDeleteByTokenHash).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "public",
        stage: "issue",
        userId: user.id,
      }),
      "Password reset request failed"
    );
  });

  test("surfaces profile reset request failures after revoking the token", async () => {
    vi.mocked(sendPasswordResetLinkEmail).mockResolvedValueOnce(false);

    await expect(requestPasswordReset(user, "profile")).rejects.toThrow(
      ACCOUNT_RECOVERY_LINK_EMAIL_ERROR_CODE
    );
    expect(testState.tokenStore.size).toBe(0);
  });

  test("does not roll back a successful password reset when the notification email fails", async () => {
    await requestPasswordReset(user, "public");
    const token = parseTokenFromResetLink();
    vi.mocked(sendPasswordResetNotifyEmail).mockResolvedValueOnce(false);

    const result = await completePasswordReset(token, "Password123");

    expect(result.userId).toBe(user.id);
    expect(getStoredUser(user.id).password).toBe("hashed:Password123");
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "notify_email",
        userId: user.id,
      }),
      "Failed to send password reset notification email"
    );
  });

  test("skips notification email delivery when DEBUG_SHOW_RESET_LINK is enabled", async () => {
    constantsState.debugShowResetLink = true;

    await requestPasswordReset(user, "public");
    const token = parseTokenFromDebugLog();

    await completePasswordReset(token, "Password123");

    expect(sendPasswordResetNotifyEmail).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
      }),
      "DEBUG_SHOW_RESET_LINK is enabled; password reset notification delivery skipped"
    );
  });

  test("validates the reset token before hashing the new password", async () => {
    await requestPasswordReset(user, "public");
    const token = parseTokenFromResetLink();

    await completePasswordReset(token, "Password123");

    expect(testState.mockFindByTokenHash).toHaveBeenCalledBefore(vi.mocked(hashPassword));
    expect(vi.mocked(hashPassword)).toHaveBeenCalledBefore(vi.mocked(prisma.$transaction));
    expect(hashString).toHaveBeenCalledWith(token);
  });

  test("rejects invalid reset tokens before hashing the new password", async () => {
    await expect(completePasswordReset("unknown-token", "Password123")).rejects.toBeInstanceOf(
      InvalidPasswordResetTokenError
    );

    expect(hashPassword).not.toHaveBeenCalled();
  });
});
