import { describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { lockUserActiveState, reactivateLockedUser } from "./reactivation";

const DB_NOW = new Date("2030-01-10T00:00:00.123Z");

const statement = (args: unknown[]) => {
  const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " ").trim(), values: sql.values };
};

const makeTx = (rows: unknown[] = []) => ({
  $queryRaw: vi.fn(async (...args: unknown[]) =>
    statement(args).text.includes("clock_timestamp()") ? [{ now: DB_NOW }] : rows
  ),
  user: { update: vi.fn().mockResolvedValue({ reactivatedAt: DB_NOW }) },
  retentionNotice: { deleteMany: vi.fn() },
});

describe("lockUserActiveState", () => {
  test("locks the user row FOR UPDATE and reads whether the account is active", async () => {
    const tx = makeTx([{ isActive: false }]);

    await expect(lockUserActiveState(tx as never, "clusr")).resolves.toEqual({ isActive: false });

    const { text, values } = statement(tx.$queryRaw.mock.calls[0]);
    expect(text).toBe('SELECT "isActive" FROM "User" WHERE "id" = ? FOR UPDATE');
    expect(values).toEqual(["clusr"]);
  });

  test("answers null for a user that doesn't exist", async () => {
    await expect(lockUserActiveState(makeTx([]) as never, "clgone")).resolves.toBeNull();
  });
});

describe("reactivateLockedUser", () => {
  test("turns the account on, restarts the retention clock on the database clock and clears the notices", async () => {
    const tx = makeTx();

    await expect(reactivateLockedUser(tx as never, "clusr")).resolves.toBe(DB_NOW);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "clusr" },
      data: { isActive: true, reactivatedAt: DB_NOW },
      select: { reactivatedAt: true },
    });
    // Every members notice of the account: its clock restarted in every organisation.
    expect(tx.retentionNotice.deleteMany).toHaveBeenCalledWith({
      where: { userId: "clusr", entity: "members" },
    });
  });

  test("returns the clock it read if the stored value comes back empty", async () => {
    const tx = makeTx();
    tx.user.update.mockResolvedValue({ reactivatedAt: null });

    await expect(reactivateLockedUser(tx as never, "clusr")).resolves.toBe(DB_NOW);
  });
});
