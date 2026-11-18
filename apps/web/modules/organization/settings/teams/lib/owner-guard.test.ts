import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { LastActiveOwnerError, lockOwnersAndCheckRemoval, runOwnerGuardedTransaction } from "./owner-guard";

const organizationId = "org1";
const userId = "user1";

/**
 * A transaction client holding the target's membership (or none) and an active-owner count. The lock is the
 * only raw statement, so its calls are the lock calls.
 */
const transactionClient = (target: { role: string; isActive: boolean } | null, activeOwners = 1) => ({
  $queryRaw: vi.fn(),
  membership: {
    findUnique: vi
      .fn()
      .mockResolvedValue(target && { role: target.role, user: { isActive: target.isActive } }),
    count: vi.fn().mockResolvedValue(activeOwners),
  },
});
type TClient = ReturnType<typeof transactionClient>;

const lockStatement = (tx: TClient) => {
  const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
  return { text: strings.join("?").replace(/\s+/g, " ").trim(), values };
};

const runIn = (tx: TClient) =>
  vi
    .mocked(prisma.$transaction)
    .mockImplementation(((callback: (client: TClient) => unknown) => callback(tx)) as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("lockOwnersAndCheckRemoval", () => {
  test("locks the organization's owner memberships in a fixed order before it reads the member", async () => {
    const tx = transactionClient({ role: "owner", isActive: true }, 2);

    await lockOwnersAndCheckRemoval(tx as never, organizationId, userId);

    // The contract, not the exact SQL: this organization's owner rows, locked, in a fixed order.
    const { text, values } = lockStatement(tx);
    expect(values).toEqual([organizationId]);
    expect(text).toMatch(/FROM "Membership"/);
    expect(text).toMatch(/"organizationId" = \?/);
    expect(text).toMatch(/"role" = 'owner'/);
    expect(text).toMatch(/ORDER BY "userId"/);
    expect(text).toMatch(/FOR UPDATE$/);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.membership.findUnique.mock.invocationCallOrder[0]
    );
    expect(tx.membership.findUnique).toHaveBeenCalledWith({
      where: { userId_organizationId: { organizationId, userId } },
      select: { role: true, user: { select: { isActive: true } } },
    });
  });

  test("is true for the only active owner, counting active owners only", async () => {
    const tx = transactionClient({ role: "owner", isActive: true }, 1);

    await expect(lockOwnersAndCheckRemoval(tx as never, organizationId, userId)).resolves.toBe(true);
    expect(tx.membership.count).toHaveBeenCalledWith({
      where: { organizationId, role: "owner", user: { isActive: true } },
    });
  });

  test("is false while another active owner remains", async () => {
    const tx = transactionClient({ role: "owner", isActive: true }, 2);

    await expect(lockOwnersAndCheckRemoval(tx as never, organizationId, userId)).resolves.toBe(false);
  });

  test.each([
    ["an owner who is already inactive", { role: "owner", isActive: false }],
    ["a member who is not an owner", { role: "manager", isActive: true }],
    ["someone with no membership", null],
  ])("is false for %s, without counting", async (_label, target) => {
    // A count of 0 would read as "last owner" if it were consulted.
    const tx = transactionClient(target, 0);

    await expect(lockOwnersAndCheckRemoval(tx as never, organizationId, userId)).resolves.toBe(false);
    expect(tx.membership.count).not.toHaveBeenCalled();
  });
});

describe("runOwnerGuardedTransaction", () => {
  test("refuses before running the change when it would remove the last active owner", async () => {
    const tx = transactionClient({ role: "owner", isActive: true }, 1);
    runIn(tx);
    const change = vi.fn();

    await expect(runOwnerGuardedTransaction(organizationId, userId, change)).rejects.toBeInstanceOf(
      LastActiveOwnerError
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(change).not.toHaveBeenCalled();
  });

  test("runs the change in the same transaction, after the lock, while another owner remains", async () => {
    const tx = transactionClient({ role: "owner", isActive: true }, 2);
    runIn(tx);
    const change = vi.fn().mockResolvedValue("done");

    await expect(runOwnerGuardedTransaction(organizationId, userId, change)).resolves.toBe("done");
    expect(change).toHaveBeenCalledWith(tx);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(change.mock.invocationCallOrder[0]);
  });

  test("takes no lock and reads nothing when the change cannot remove an owner", async () => {
    const tx = transactionClient({ role: "owner", isActive: true }, 1);
    runIn(tx);
    const change = vi.fn().mockResolvedValue("done");

    await expect(runOwnerGuardedTransaction(organizationId, null, change)).resolves.toBe("done");
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.membership.findUnique).not.toHaveBeenCalled();
  });

  test("runs the whole transaction again after a conflict, lock and check included", async () => {
    // The first attempt locks and checks, then Postgres aborts it; the second must lock and check again.
    const first = transactionClient({ role: "owner", isActive: true }, 2);
    const second = transactionClient({ role: "owner", isActive: true }, 2);
    const conflict = new Prisma.PrismaClientKnownRequestError("deadlock", {
      code: PrismaErrorType.TransactionConflict,
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.$transaction)
      .mockImplementationOnce((async (callback: (client: TClient) => Promise<unknown>) => {
        await callback(first);
        throw conflict;
      }) as never)
      .mockImplementationOnce(((callback: (client: TClient) => unknown) => callback(second)) as never);
    const change = vi.fn().mockResolvedValue("done");

    await expect(runOwnerGuardedTransaction(organizationId, userId, change)).resolves.toBe("done");
    for (const tx of [first, second]) {
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.membership.findUnique).toHaveBeenCalledTimes(1);
    }
    expect(change.mock.calls.map(([tx]) => tx)).toEqual([first, second]);
  });
});
