import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { deleteSessionBySessionToken } from "./auth-session-repository";

vi.mock("@formbricks/database", () => ({
  prisma: {
    session: {
      deleteMany: vi.fn(),
    },
  },
}));

describe("auth-session-repository", () => {
  const sessionToken = "session-token-cm8z6bn2q000008l34h8g7k9m";

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("deletes the session matching the given token", async () => {
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 1 });

    const result = await deleteSessionBySessionToken(sessionToken);

    expect(result).toBe(1);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { sessionToken },
    });
  });

  test("returns zero when no session matches the token", async () => {
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 0 });

    const result = await deleteSessionBySessionToken(sessionToken);

    expect(result).toBe(0);
  });

  test("uses the provided transaction client when available", async () => {
    const txDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      session: {
        deleteMany: txDeleteMany,
      },
    } as unknown as Prisma.TransactionClient;

    const result = await deleteSessionBySessionToken(sessionToken, tx);

    expect(result).toBe(1);
    expect(txDeleteMany).toHaveBeenCalledWith({
      where: { sessionToken },
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

    await expect(deleteSessionBySessionToken(sessionToken)).rejects.toThrow(DatabaseError);
  });
});
