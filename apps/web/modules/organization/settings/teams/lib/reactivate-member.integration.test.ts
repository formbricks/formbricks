import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { reactivateOrganizationMember } from "./reactivate-member";

describe("reactivate a member (real Postgres)", () => {
  let organizationId: string;
  let otherOrganizationId: string;
  let ownerId: string;
  let managerId: string;

  const createMember = async (
    email: string,
    organizationIds: string[],
    isActive = false,
    role: "owner" | "manager" | "member" = "member"
  ) => {
    const user = await prisma.user.create({ data: { name: email, email, isActive } });
    await prisma.membership.createMany({
      data: organizationIds.map((id) => ({ userId: user.id, organizationId: id, role, accepted: true })),
    });
    return user.id;
  };

  const reactivate = (userId: string, actorUserId = ownerId) =>
    reactivateOrganizationMember({ userId, organizationId, actorUserId });

  const userOutbox = (userId: string) =>
    prisma.$queryRaw<{ isRevocation: boolean }[]>`
      SELECT "isRevocation" FROM "AuthzedProjectionOutbox"
      WHERE "targetType" = 'user' AND "primaryId" = ${userId}
      ORDER BY "createdAt"
    `;

  beforeEach(async () => {
    await resetDb();
    organizationId = (await prisma.organization.create({ data: { name: "Retention Org" } })).id;
    otherOrganizationId = (await prisma.organization.create({ data: { name: "Other Org" } })).id;
    ownerId = await createMember("owner@example.com", [organizationId], true, "owner");
    managerId = await createMember("manager@example.com", [organizationId], true, "manager");
  });

  test("reactivates, restarts the clock, clears their members notices and queues the projection", async () => {
    const userId = await createMember("anna@example.com", [organizationId]);
    await prisma.retentionNotice.createMany({
      data: [
        { organizationId, userId, entity: "members" },
        { organizationId: otherOrganizationId, userId, entity: "members" },
      ],
    });
    const before = (await userOutbox(userId)).length;

    const result = await reactivate(userId);

    expect(result.status).toBe("reactivated");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.isActive).toBe(true);
    expect(user.reactivatedAt).toEqual(result.status === "reactivated" ? result.reactivatedAt : null);
    // The account's clock restarted everywhere, so every members notice of theirs goes, including one
    // left behind by an organisation they no longer belong to.
    expect(await prisma.retentionNotice.count({ where: { userId } })).toBe(0);
    // The trigger on User.isActive enqueues a grant, so SpiceDB stops treating the account as disabled.
    expect((await userOutbox(userId)).slice(before)).toEqual([{ isRevocation: false }]);
  });

  test("refuses a member of another organisation too, and changes nothing", async () => {
    const userId = await createMember("tom@example.com", [organizationId, otherOrganizationId]);

    expect(await reactivate(userId)).toEqual({
      status: "in_other_organizations",
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).isActive).toBe(false);
  });

  test("tells a non-member and a missing user apart from nobody", async () => {
    const outsider = await createMember("eve@example.com", [otherOrganizationId]);

    expect(await reactivate(outsider)).toEqual({
      status: "not_member",
    });
    expect(await reactivate("clmissingmissingmissingmi")).toEqual({
      status: "not_member",
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: outsider } })).isActive).toBe(false);
  });

  test("lets only an owner reactivate an owner", async () => {
    const inactiveOwner = await createMember("former@example.com", [organizationId], false, "owner");

    expect(await reactivate(inactiveOwner, managerId)).toEqual({ status: "owner_needs_owner" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: inactiveOwner } })).isActive).toBe(false);

    expect((await reactivate(inactiveOwner, ownerId)).status).toBe("reactivated");
  });

  test("lets a manager reactivate a member", async () => {
    const userId = await createMember("mia@example.com", [organizationId]);

    expect((await reactivate(userId, managerId)).status).toBe("reactivated");
  });

  test("leaves an active member alone, wherever else they belong", async () => {
    const userId = await createMember("ben@example.com", [organizationId, otherOrganizationId], true);

    expect(await reactivate(userId)).toEqual({ status: "already_active" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).reactivatedAt).toBeNull();
  });
});
