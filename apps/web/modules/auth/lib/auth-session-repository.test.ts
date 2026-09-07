import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { getSessionTokensByUserId } from "./auth-session-repository";

vi.mock("@formbricks/database", () => ({
  prisma: {
    session: {
      findMany: vi.fn(),
    },
  },
}));

describe("auth-session-repository", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("lists a user's unexpired session tokens", async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValue([
      { sessionToken: "token-a" },
      { sessionToken: "token-b" },
    ] as never);

    await expect(getSessionTokensByUserId("user_1")).resolves.toEqual(["token-a", "token-b"]);
    // Expired rows are excluded on purpose: the count feeds the SSO-recovery audit event, where it is
    // read as "how many sessions the squatter was holding".
    expect(prisma.session.findMany).toHaveBeenCalledWith({
      where: { userId: "user_1", expires: { gt: expect.any(Date) } },
      select: { sessionToken: true },
    });
  });

  test("returns an empty list for a user with no sessions", async () => {
    vi.mocked(prisma.session.findMany).mockResolvedValue([] as never);

    await expect(getSessionTokensByUserId("user_1")).resolves.toEqual([]);
  });

  test("wraps prisma known errors in DatabaseError", async () => {
    vi.mocked(prisma.session.findMany).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("boom", { code: "P2024", clientVersion: "7.x" })
    );

    await expect(getSessionTokensByUserId("user_1")).rejects.toThrow(DatabaseError);
  });
});
