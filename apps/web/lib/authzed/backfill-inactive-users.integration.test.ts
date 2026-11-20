import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { runAuthzedBackfill } from "./backfill";
import { createAuthzedBackfillApply, createAuthzedBackfillNoopApply } from "./backfill-apply";
import { getAuthzedClient } from "./client";
import { AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN } from "./constants";
import { reconcileOrganizationMembership } from "./organization-membership";
import { drainAuthzedOutbox } from "./outbox-processor";
import { readAllRelationships } from "./relationship-reads";
import { reconcileTeamWorkspaceRelationships } from "./team-workspace";

/**
 * A deactivated user holds no organization or team relationships in SpiceDB: the outbox removes them
 * when the user is deactivated (`reconcileUsers`). The backfill and the reconcilers it applies through
 * must agree, or an audit reports every deactivated member as drift and `--apply` gives them their
 * graph access back (ENG-3899). Against a real PostgreSQL and SpiceDB.
 */

const backfill = (organizationId: string, mode: "apply" | "dry_run") =>
  runAuthzedBackfill(
    {
      maxPrune: AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN,
      mode,
      prune: true,
      scope: { kind: "organization", organizationId },
    },
    {
      apply: mode === "apply" ? createAuthzedBackfillApply() : createAuthzedBackfillNoopApply(),
      client: getAuthzedClient(),
    }
  );

/** Every organization and team relationship SpiceDB holds for the user, as `type:id#relation`. */
const userRelationships = async (userId: string): Promise<string[]> => {
  const client = getAuthzedClient();
  const subject = { objectId: userId, objectType: "user" };
  const reads = await Promise.all(
    (["organization", "team"] as const).map((resourceType) =>
      readAllRelationships(client, { resourceType, subject })
    )
  );
  return reads
    .flatMap(({ relationships }) => relationships)
    .map(({ relation, resource }) => `${resource.objectType}:${resource.objectId}#${relation}`)
    .sort((a, b) => a.localeCompare(b));
};

const seedOrganization = async () => {
  const organization = await prisma.organization.create({ data: { name: "Inactive Members Org" } });
  const team = await prisma.team.create({ data: { name: "Team", organizationId: organization.id } });
  const [active, inactive] = await Promise.all(
    [
      { email: "active@backfill-inactive.test", isActive: true },
      { email: "inactive@backfill-inactive.test", isActive: false },
    ].map(({ email, isActive }) => prisma.user.create({ data: { email, name: email, isActive } }))
  );
  await prisma.membership.createMany({
    data: [
      { accepted: true, organizationId: organization.id, role: "owner", userId: active.id },
      { accepted: true, organizationId: organization.id, role: "member", userId: inactive.id },
    ],
  });
  await prisma.teamUser.createMany({
    data: [
      { role: "admin", teamId: team.id, userId: active.id },
      { role: "contributor", teamId: team.id, userId: inactive.id },
    ],
  });
  return { activeId: active.id, inactiveId: inactive.id, organizationId: organization.id, teamId: team.id };
};

beforeEach(async () => {
  await resetDb();
  await synchronizeAuthzedIntegrationFixture();
});

describe("deactivated users in the AuthZed backfill (real PostgreSQL and SpiceDB)", () => {
  test("an applying backfill writes no organization or team relationship for a deactivated member", async () => {
    const { activeId, inactiveId, organizationId, teamId } = await seedOrganization();

    const applied = await backfill(organizationId, "apply");

    expect(applied.counters.failed).toBe(0);
    expect(await userRelationships(inactiveId)).toEqual([]);
    // The active member in the same organization and team is still projected.
    expect(await userRelationships(activeId)).toEqual([
      `organization:${organizationId}#owner`,
      `team:${teamId}#admin`,
    ]);
  });

  test("an applying backfill removes the relationships a deactivated member still holds", async () => {
    const { inactiveId, organizationId, teamId } = await seedOrganization();
    // Everything else in the organization projected, so the audit below sees only the leftovers.
    expect(await drainAuthzedOutbox()).toMatchObject({ deadLettered: 0, failed: 0, status: "drained" });
    // As SpiceDB looked before the user was deactivated.
    await getAuthzedClient().writeRelationships([
      {
        operation: "touch",
        relationship: {
          relation: "member",
          resource: { objectId: organizationId, objectType: "organization" },
          subject: { objectId: inactiveId, objectType: "user" },
        },
      },
      {
        operation: "touch",
        relationship: {
          relation: "contributor",
          resource: { objectId: teamId, objectType: "team" },
          subject: { objectId: inactiveId, objectType: "user" },
        },
      },
    ]);

    // An audit reports them as relationships with no source, which a pruning apply removes.
    const audit = await backfill(organizationId, "dry_run");
    expect(audit.counters).toMatchObject({ failed: 0, missing: 0, orphaned: 2 });

    const applied = await backfill(organizationId, "apply");

    expect(applied.counters).toMatchObject({ failed: 0, pruned: 2 });
    expect(await userRelationships(inactiveId)).toEqual([]);
  });

  test("an audit after the outbox has projected the deactivation reports no drift", async () => {
    const { inactiveId, organizationId } = await seedOrganization();
    // The outbox's projection of the seeded rows, which removes the deactivated user's relationships.
    const drained = await drainAuthzedOutbox();
    expect(drained).toMatchObject({ deadLettered: 0, failed: 0, status: "drained" });
    expect(await userRelationships(inactiveId)).toEqual([]);

    const audit = await backfill(organizationId, "dry_run");

    expect(audit.counters).toMatchObject({ failed: 0, missing: 0, orphaned: 0 });
    expect(audit.status).toBe("reconciled");
  });

  test("reconciling a deactivated user's membership or team membership writes no relationship", async () => {
    // The outbox projects a Membership or TeamUser row change through these reconcilers too: a role
    // change on a deactivated member must not give the graph access back either.
    const { inactiveId, organizationId, teamId } = await seedOrganization();

    await expect(reconcileOrganizationMembership(organizationId, inactiveId)).resolves.toMatchObject({
      status: "projected",
    });
    await expect(
      reconcileTeamWorkspaceRelationships({ teamMemberships: [{ teamId, userId: inactiveId }] })
    ).resolves.toMatchObject({ status: "projected" });

    expect(await userRelationships(inactiveId)).toEqual([]);
  });
});
