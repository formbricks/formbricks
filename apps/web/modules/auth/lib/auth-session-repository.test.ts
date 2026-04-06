import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { deleteSessionsByUserId } from "./auth-session-repository";

vi.mock("@formbricks/database", () => ({
  prisma: {
    session: {
      deleteMany: vi.fn(),
    },
  },
}));

describe("auth-session-repository", () => {
  const userId = "cm8z6bn2q000008l34h8g7k9m";

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("deletes all sessions for the target user", async () => {
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 2 });

    const result = await deleteSessionsByUserId(userId);

    expect(result).toBe(2);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { userId },
    });
  });

  test("returns zero when the user has no sessions", async () => {
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 0 });

    const result = await deleteSessionsByUserId(userId);

    expect(result).toBe(0);
  });

  test("uses the provided transaction client when available", async () => {
    const txDeleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const tx = {
      session: {
        deleteMany: txDeleteMany,
      },
    } as unknown as Prisma.TransactionClient;

    const result = await deleteSessionsByUserId(userId, tx);

    expect(result).toBe(3);
    expect(txDeleteMany).toHaveBeenCalledWith({
      where: { userId },
    });
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });

  test("wraps prisma known errors in DatabaseError", async () => {
    vi.mocked(prisma.session.deleteMany).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("database failed", {
        code: "P2021",
        clientVersion: "test",
      })
    );

    await expect(deleteSessionsByUserId(userId)).rejects.toThrow(DatabaseError);
  });
});
