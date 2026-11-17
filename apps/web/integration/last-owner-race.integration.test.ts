import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { ValidationError } from "@formbricks/types/errors";
import { resetDb } from "@/integration/reset-db";
import { updateMembership } from "@/modules/ee/role-management/lib/membership";
import { deleteMembership } from "@/modules/organization/settings/teams/lib/membership";
import {
  LastActiveOwnerError,
  runOwnerGuardedTransaction,
} from "@/modules/organization/settings/teams/lib/owner-guard";

/**
 * The last-owner guard on member removal against real Postgres.
 *
 * The guard used to be a cached owner count read in the server action, before `deleteMembership`'s
 * transaction, so two owners removed at the same moment both read "another owner is left" and the
 * organization ended up with none. Only a real database with both deletes in flight can tell a guard
 * inside the serializable transaction from one read before it.
 */

const ROUNDS = 5;

const seedOrganizationWithOwners = async (
  round: number
): Promise<{ organizationId: string; ownerIds: string[] }> => {
  const organization = await prisma.organization.create({ data: { name: `Owners ${round}` } });
  const ownerIds: string[] = [];
  for (const index of [0, 1]) {
    const user = await prisma.user.create({
      data: { name: `Owner ${index}`, email: `owner-${round}-${index}@example.com` },
    });
    await prisma.membership.create({
      data: { userId: user.id, organizationId: organization.id, role: "owner", accepted: true },
    });
    ownerIds.push(user.id);
  }
  return { organizationId: organization.id, ownerIds };
};

const countOwners = (organizationId: string) =>
  prisma.membership.count({ where: { organizationId, role: "owner" } });

beforeEach(async () => {
  await resetDb();
});

describe("deleteMembership last-owner guard (real Postgres)", () => {
  test("removing both owners of an organization at once leaves one of them", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const { organizationId, ownerIds } = await seedOrganizationWithOwners(round);

      const outcomes = await Promise.allSettled(
        ownerIds.map((userId) => deleteMembership(userId, organizationId))
      );

      expect(await countOwners(organizationId)).toBe(1);
      const rejections = outcomes.flatMap((outcome) =>
        outcome.status === "rejected" ? [outcome.reason] : []
      );
      expect(rejections).toHaveLength(1);
      expect(rejections[0]).toBeInstanceOf(ValidationError);
    }
  });

  test("demoting one owner while the other is removed leaves one of them", async () => {
    // The demotion runs as the member list's role change does: under the owners' lock. Without it (a
    // Serializable transaction alone), the demotion counts two owners while the removal commits.
    for (let round = 0; round < ROUNDS; round++) {
      const { organizationId, ownerIds } = await seedOrganizationWithOwners(round);

      const outcomes = await Promise.allSettled([
        runOwnerGuardedTransaction(organizationId, ownerIds[0], (tx) =>
          updateMembership(ownerIds[0], organizationId, { role: "member" }, tx)
        ),
        deleteMembership(ownerIds[1], organizationId),
      ]);

      expect(await countOwners(organizationId)).toBe(1);
      const rejections = outcomes.flatMap((outcome) =>
        outcome.status === "rejected" ? [outcome.reason] : []
      );
      expect(rejections).toHaveLength(1);
      expect(rejections[0]).toSatisfy(
        (reason: unknown) => reason instanceof LastActiveOwnerError || reason instanceof ValidationError
      );
    }
  });

  test("refuses to remove the only owner", async () => {
    const { organizationId, ownerIds } = await seedOrganizationWithOwners(0);
    await deleteMembership(ownerIds[0], organizationId);

    await expect(deleteMembership(ownerIds[1], organizationId)).rejects.toThrow(ValidationError);
    expect(await countOwners(organizationId)).toBe(1);
  });
});
