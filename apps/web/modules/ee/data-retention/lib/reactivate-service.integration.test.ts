import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { reactivateRetentionMember } from "./reactivate-service";

describe("reactivate a member (real Postgres)", () => {
  let organizationId: string;
  let otherOrganizationId: string;

  const createMember = async (email: string, organizationIds: string[], isActive = false) => {
    const user = await prisma.user.create({ data: { name: email, email, isActive } });
    await prisma.membership.createMany({
      data: organizationIds.map((id) => ({
        userId: user.id,
        organizationId: id,
        role: "member" as const,
        accepted: true,
      })),
    });
    return user.id;
  };

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
  });

  test("reactivates, restarts the clock, clears this organisation's notice and queues the projection", async () => {
    const userId = await createMember("anna@example.com", [organizationId]);
    await prisma.retentionNotice.createMany({
      data: [
        { organizationId, userId, entity: "members" },
        { organizationId: otherOrganizationId, userId, entity: "members" },
      ],
    });
    const before = (await userOutbox(userId)).length;

    const result = await reactivateRetentionMember({ userId, organizationId });

    expect(result.status).toBe("reactivated");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.isActive).toBe(true);
    expect(user.reactivatedAt).toEqual(result.status === "reactivated" ? result.reactivatedAt : null);
    expect(
      await prisma.retentionNotice.findMany({ where: { userId }, select: { organizationId: true } })
    ).toEqual([{ organizationId: otherOrganizationId }]);
    // The trigger on User.isActive enqueues a grant, so SpiceDB stops treating the account as disabled.
    expect((await userOutbox(userId)).slice(before)).toEqual([{ isRevocation: false }]);
  });

  test("refuses a member of another organisation too, and changes nothing", async () => {
    const userId = await createMember("tom@example.com", [organizationId, otherOrganizationId]);

    expect(await reactivateRetentionMember({ userId, organizationId })).toEqual({
      status: "in_other_organizations",
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).isActive).toBe(false);
  });

  test("tells a non-member and a missing user apart from nobody", async () => {
    const outsider = await createMember("eve@example.com", [otherOrganizationId]);

    expect(await reactivateRetentionMember({ userId: outsider, organizationId })).toEqual({
      status: "not_member",
    });
    expect(await reactivateRetentionMember({ userId: "clmissingmissingmissingmi", organizationId })).toEqual({
      status: "not_member",
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: outsider } })).isActive).toBe(false);
  });

  test("leaves an active member alone, wherever else they belong", async () => {
    const userId = await createMember("ben@example.com", [organizationId, otherOrganizationId], true);

    expect(await reactivateRetentionMember({ userId, organizationId })).toEqual({ status: "already_active" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).reactivatedAt).toBeNull();
  });
});
