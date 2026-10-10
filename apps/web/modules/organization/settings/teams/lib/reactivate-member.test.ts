import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { reactivateOrganizationMember } from "./reactivate-member";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { $transaction: vi.fn() } }));

/**
 * Reactivating against a real database (the user row lock ordering it against a deactivation or a new
 * membership, the notice cleared, the clock restarted) is proven in `reactivate-service.integration.test.ts`.
 * These pin who may reactivate whom, and when it does nothing.
 */
const statement = (args: unknown[]) => {
  const [strings, ...values] = args as [TemplateStringsArray, ...unknown[]];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql.replace(/\s+/g, " "), values: sql.values };
};

const ORG_ID = "clorg";
const DB_NOW = new Date("2030-01-10T00:00:00.123Z");

type TMembership = { organizationId: string; role: "owner" | "manager" | "member" | "billing" };
const transaction = ({
  user = { isActive: false } as { isActive: boolean } | null,
  memberships = [{ organizationId: ORG_ID, role: "member" }] as TMembership[],
  actorRole = "owner" as TMembership["role"] | null,
} = {}) => {
  const tx = {
    $queryRaw: vi.fn(async (...args: unknown[]) =>
      statement(args).text.includes("clock_timestamp()") ? [{ now: DB_NOW }] : user ? [user] : []
    ),
    membership: {
      findMany: vi.fn().mockResolvedValue(memberships),
      findUnique: vi.fn().mockResolvedValue(actorRole ? { role: actorRole } : null),
    },
    user: { update: vi.fn().mockResolvedValue({ reactivatedAt: DB_NOW }) },
    retentionNotice: { deleteMany: vi.fn() },
  };
  vi.mocked(prisma.$transaction).mockImplementation(((fn: (client: typeof tx) => unknown) =>
    fn(tx)) as never);
  return tx;
};

const reactivate = (actorUserId = "cladmin") =>
  reactivateOrganizationMember({ userId: "clmember", organizationId: ORG_ID, actorUserId });

describe("reactivateOrganizationMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("reactivates a member of this organisation alone, restarting their clock and clearing their notice", async () => {
    const tx = transaction();

    await expect(reactivate()).resolves.toEqual({ status: "reactivated", reactivatedAt: DB_NOW });

    const lock = statement(tx.$queryRaw.mock.calls[0]);
    expect(lock.text).toContain('FROM "User" WHERE "id" = ? FOR UPDATE');
    expect(lock.values).toEqual(["clmember"]);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "clmember" },
      data: { isActive: true, reactivatedAt: DB_NOW },
      select: { reactivatedAt: true },
    });
    // Their members notices go, so a later lapse gets a new notice and a full warning.
    expect(tx.retentionNotice.deleteMany).toHaveBeenCalledWith({
      where: { userId: "clmember", entity: "members" },
    });
  });

  test("returns the clock it read if the stored value comes back empty", async () => {
    const tx = transaction();
    tx.user.update.mockResolvedValue({ reactivatedAt: null });

    await expect(reactivate()).resolves.toEqual({ status: "reactivated", reactivatedAt: DB_NOW });
  });

  test.each([
    ["no such user", { user: null }],
    ["a user of another organisation only", { memberships: [{ organizationId: "other", role: "member" }] }],
  ] as const)("is not a member for %s", async (_case, setup) => {
    const tx = transaction(setup as Parameters<typeof transaction>[0]);

    await expect(reactivate()).resolves.toEqual({ status: "not_member" });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  test("lets only an owner reactivate another owner", async () => {
    const owner = [{ organizationId: ORG_ID, role: "owner" as const }];

    transaction({ memberships: owner, actorRole: "manager" });
    await expect(reactivate()).resolves.toEqual({ status: "owner_needs_owner" });

    transaction({ memberships: owner, actorRole: null });
    await expect(reactivate()).resolves.toEqual({ status: "owner_needs_owner" });

    const tx = transaction({ memberships: owner, actorRole: "owner" });
    await expect(reactivate()).resolves.toMatchObject({ status: "reactivated" });
    expect(tx.membership.findUnique).toHaveBeenCalledWith({
      where: { userId_organizationId: { userId: "cladmin", organizationId: ORG_ID } },
      select: { role: true },
    });
  });

  test("lets an owner reactivate themselves without checking another role", async () => {
    const tx = transaction({ memberships: [{ organizationId: ORG_ID, role: "owner" }], actorRole: null });

    await expect(reactivate("clmember")).resolves.toMatchObject({ status: "reactivated" });
    expect(tx.membership.findUnique).not.toHaveBeenCalled();
  });

  test("does nothing for someone already active, wherever else they belong", async () => {
    const tx = transaction({
      user: { isActive: true },
      memberships: [
        { organizationId: ORG_ID, role: "member" },
        { organizationId: "other", role: "member" },
      ],
    });

    await expect(reactivate()).resolves.toEqual({ status: "already_active" });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  test("never decides for the other organisations of someone who belongs to several", async () => {
    const tx = transaction({
      memberships: [
        { organizationId: ORG_ID, role: "member" },
        { organizationId: "other", role: "member" },
      ],
    });

    await expect(reactivate()).resolves.toEqual({ status: "in_other_organizations" });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.retentionNotice.deleteMany).not.toHaveBeenCalled();
  });
});
