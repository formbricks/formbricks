import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { InvalidPasswordResetTokenError } from "@formbricks/types/errors";
import { hashPassword } from "@/lib/auth";
import { hashString } from "@/lib/hash-string";
import { sendPasswordResetLinkEmail, sendPasswordResetNotifyEmail } from "@/modules/email";
import {
  INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
  completePasswordReset,
  getPasswordResetTokenLifetimeInMinutes,
  requestPasswordReset,
} from "./password-reset-service";

const testState = vi.hoisted(() => {
  const tokenStore = new Map<string, any>();
  const users = new Map<string, any>();

  const selectAuditUser = (user: any) => ({
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

  const mockDeleteByUserId = vi.fn(async (userId: string) => {
    const didDelete = tokenStore.delete(userId);
    return didDelete ? 1 : 0;
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

  const mockTransaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => {
    const tx = {
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          const user = users.get(where.id);
          return user ? selectAuditUser(user) : null;
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: { password: string } }) => {
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
    mockDeleteByUserId,
    mockConsumeActiveToken,
    mockTransaction,
  };
});

vi.mock("@/lib/hash-string", () => ({
  hashString: vi.fn((value: string) => `hash:${value}`),
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
  deleteByUserId: testState.mockDeleteByUserId,
  deleteByTokenHash: vi.fn(),
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

  beforeEach(() => {
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
    const storedToken = testState.tokenStore.get(user.id);

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
      message: INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
    });

    const result = await completePasswordReset(secondToken, "Password123");

    expect(result.userId).toBe(user.id);
    expect(testState.users.get(user.id).password).toBe("hashed:Password123");
  });

  test("rejects expired reset tokens", async () => {
    await requestPasswordReset(user, "public");
    const token = parseTokenFromResetLink();

    testState.tokenStore.set(user.id, {
      ...testState.tokenStore.get(user.id),
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    await expect(completePasswordReset(token, "Password123")).rejects.toMatchObject({
      name: "InvalidPasswordResetTokenError",
      reason: "expired",
      message: INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
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
      message: INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
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

    expect(testState.tokenStore.size).toBe(0);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "public",
        stage: "send",
        userId: user.id,
      }),
      "Password reset request failed"
    );
  });

  test("logs and suppresses token issuance failures for public requests", async () => {
    testState.mockUpsertActiveToken.mockRejectedValueOnce(new Error("Database unavailable"));

    await expect(requestPasswordReset(user, "public")).resolves.toBeUndefined();

    expect(sendPasswordResetLinkEmail).not.toHaveBeenCalled();
    expect(testState.mockDeleteByUserId).not.toHaveBeenCalled();
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

    await expect(requestPasswordReset(user, "profile")).rejects.toThrow("Password reset email was not sent");
    expect(testState.tokenStore.size).toBe(0);
  });

  test("does not roll back a successful password reset when the notification email fails", async () => {
    await requestPasswordReset(user, "public");
    const token = parseTokenFromResetLink();
    vi.mocked(sendPasswordResetNotifyEmail).mockResolvedValueOnce(false);

    const result = await completePasswordReset(token, "Password123");

    expect(result.userId).toBe(user.id);
    expect(testState.users.get(user.id).password).toBe("hashed:Password123");
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "notify_email",
        userId: user.id,
      }),
      "Failed to send password reset notification email"
    );
  });

  test("hashes the new password before opening the transaction", async () => {
    await requestPasswordReset(user, "public");
    const token = parseTokenFromResetLink();

    await completePasswordReset(token, "Password123");

    expect(hashPassword).toHaveBeenCalledBefore(prisma.$transaction as any);
    expect(hashString).toHaveBeenCalledWith(token);
  });
});
