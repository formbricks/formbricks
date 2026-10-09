import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { readDatabaseClock } from "@/lib/utils/database-clock";
import {
  recordActivityOnSessionCreate,
  recordActivityOnSessionUpdate,
  recordUserActivity,
} from "./better-auth-last-active";

const { mockError } = vi.hoisted(() => ({ mockError: vi.fn() }));

vi.mock("@formbricks/database", () => ({ prisma: { $executeRaw: vi.fn() } }));
vi.mock("@formbricks/logger", () => ({ logger: { withContext: vi.fn(() => ({ error: mockError })) } }));
vi.mock("@/lib/utils/database-clock", () => ({ readDatabaseClock: vi.fn() }));

/**
 * The hooks against the real Better Auth instance and Postgres (a renewal recorded, a sign-out keeping
 * it) are proven in `members-sweeper.integration.test.ts`. These pin the statement and the fail-safe.
 */
const DB_NOW = new Date("2030-01-10T00:00:00.123Z");
const statement = (args: unknown[]) => {
  const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " ").trim(), values: sql.values };
};
const session = (userId: string) =>
  ({ id: "clses", userId, token: "t", expiresAt: DB_NOW, createdAt: DB_NOW, updatedAt: DB_NOW }) as never;

describe("recordUserActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readDatabaseClock).mockResolvedValue(DB_NOW);
    vi.mocked(prisma.$executeRaw).mockResolvedValue(1);
  });

  test("moves lastActiveAt forward only, to the database's clock", async () => {
    await recordUserActivity("clusr");

    expect(readDatabaseClock).toHaveBeenCalledWith(prisma);
    const { text, values } = statement(vi.mocked(prisma.$executeRaw).mock.calls[0]);
    expect(text).toBe('UPDATE "User" SET "lastActiveAt" = GREATEST("lastActiveAt", ?) WHERE "id" = ?');
    expect(values).toEqual([DB_NOW, "clusr"]);
  });

  test("never throws, so a failed write can't break a sign-in: it logs instead", async () => {
    const failure = new Error("connection lost");
    vi.mocked(prisma.$executeRaw).mockRejectedValue(failure);

    await expect(recordUserActivity("clusr")).resolves.toBeUndefined();
    expect(logger.withContext).toHaveBeenCalledWith({ source: "better-auth" });
    expect(mockError).toHaveBeenCalledWith(
      { err: failure, userId: "clusr" },
      "Failed to record user activity"
    );
  });

  test("records a new session and a renewed one as activity of their user", async () => {
    await recordActivityOnSessionCreate(session("clnew"), null);
    await recordActivityOnSessionUpdate(session("clrenewed"), null);

    expect(vi.mocked(prisma.$executeRaw).mock.calls.map((call) => statement(call).values[1])).toEqual([
      "clnew",
      "clrenewed",
    ]);
  });

  test("records nothing for a renewal whose session was deleted meanwhile", async () => {
    await recordActivityOnSessionUpdate(null as never, null);

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
