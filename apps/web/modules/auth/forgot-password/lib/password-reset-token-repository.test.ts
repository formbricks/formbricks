import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import {
  consumeActiveToken,
  deleteByTokenHash,
  findByTokenHash,
  upsertActiveToken,
} from "./password-reset-token-repository";

vi.mock("@formbricks/database", () => ({
  prisma: {
    passwordResetToken: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

describe("password-reset-token-repository", () => {
  const userId = "cm8z6bn2q000008l34h8g7k9m";
  const mockTokenRecord = {
    id: "prt_123",
    userId,
    tokenHash: "hashed-token",
    expiresAt: new Date("2026-03-30T12:30:00.000Z"),
    createdAt: new Date("2026-03-30T12:00:00.000Z"),
    updatedAt: new Date("2026-03-30T12:00:00.000Z"),
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("upserts the active token for a user", async () => {
    vi.mocked(prisma.passwordResetToken.upsert).mockResolvedValue(mockTokenRecord as any);

    const result = await upsertActiveToken(userId, "hashed-token", mockTokenRecord.expiresAt);

    expect(result).toEqual(mockTokenRecord);
    expect(prisma.passwordResetToken.upsert).toHaveBeenCalledWith({
      where: { userId },
      create: {
        userId,
        tokenHash: "hashed-token",
        expiresAt: mockTokenRecord.expiresAt,
      },
      update: {
        tokenHash: "hashed-token",
        expiresAt: mockTokenRecord.expiresAt,
      },
      select: expect.any(Object),
    });
  });

  test("finds a token by hash", async () => {
    vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValue(mockTokenRecord as any);

    const result = await findByTokenHash("hashed-token");

    expect(result).toEqual(mockTokenRecord);
    expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: "hashed-token" },
      select: expect.any(Object),
    });
  });

  test("deletes by token hash", async () => {
    vi.mocked(prisma.passwordResetToken.deleteMany).mockResolvedValue({ count: 1 } as any);

    const result = await deleteByTokenHash("hashed-token");

    expect(result).toBe(1);
    expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: "hashed-token" },
    });
  });

  test("consumes only a non-expired token inside a transaction", async () => {
    const tx = {
      passwordResetToken: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;
    const now = new Date("2026-03-30T12:10:00.000Z");

    const result = await consumeActiveToken("hashed-token", now, tx);

    expect(result).toBe(1);
    expect(tx.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: {
        tokenHash: "hashed-token",
        expiresAt: {
          gt: now,
        },
      },
    });
  });

  test("wraps prisma known errors in DatabaseError", async () => {
    vi.mocked(prisma.passwordResetToken.upsert).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("database failed", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    await expect(upsertActiveToken(userId, "hashed-token", mockTokenRecord.expiresAt)).rejects.toThrow(
      DatabaseError
    );
  });
});
