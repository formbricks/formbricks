import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import {
  AUTHZED_OUTBOX_MAX_PERMANENT_FAILURES,
  hasStaleAuthzedRevocation,
  markAuthzedOutboxEventsFailed,
} from "@/lib/authzed/outbox-repository";

/**
 * The durable outbox against a real PostgreSQL (ENG-2408).
 *
 * Three things in this feature are implemented in SQL and are therefore invisible to a unit test: the
 * trigger's grant/revocation classifier, the backoff and dead-letter arithmetic in the failure
 * release, and whether the indexes are actually the partial ones the hot paths need. The
 * string-matching contract test next door can see that the SQL *says* something; only this can see
 * that it *does* it.
 *
 * The classifier is the load-bearing one. `isRevocation` has a single reader — the fail-closed
 * freshness guard — and a guard armed by a pure grant denies every enforced authorization check in
 * the deployment, so a mass invite acceptance would be an outage. The transition table below is the
 * evidence that it is not.
 */

type TOutboxRow = Readonly<{
  isRevocation: boolean;
  primaryId: string;
  secondaryId: string | null;
  targetType: string;
}>;

const outboxRows = (): Promise<ReadonlyArray<TOutboxRow>> =>
  prisma.$queryRaw<TOutboxRow[]>`
    SELECT "targetType", "primaryId", "secondaryId", "isRevocation"
    FROM "AuthzedProjectionOutbox"
    ORDER BY "isRevocation" DESC, "createdAt" ASC
  `;

/** Source setup fires the triggers too, so clear what it produced before the mutation under test. */
const clearOutbox = (): Promise<unknown> => prisma.$executeRawUnsafe('TRUNCATE "AuthzedProjectionOutbox";');

const seedUser = (email: string, isActive = true) =>
  prisma.user.create({ data: { email, name: email, isActive } });

const seedOrganization = (name: string) => prisma.organization.create({ data: { name } });

beforeEach(async () => {
  await resetDb();
});

describe("AuthZed projection outbox triggers", () => {
  test("does not classify an accepted invite as a revocation", async () => {
    const [user, organization] = await Promise.all([
      seedUser("accept@integration.test"),
      seedOrganization("Accept"),
    ]);
    await prisma.membership.create({
      data: { organizationId: organization.id, userId: user.id, accepted: false, role: "member" },
    });
    await clearOutbox();

    await prisma.membership.update({
      where: { userId_organizationId: { organizationId: organization.id, userId: user.id } },
      data: { accepted: true },
    });

    // The projected snapshot ignores `accepted` entirely, so this writes byte-identical relationships.
    expect(await outboxRows()).toEqual([
      {
        isRevocation: false,
        primaryId: organization.id,
        secondaryId: user.id,
        targetType: "membership",
      },
    ]);
  });

  test("classifies any role move as a revocation, promotions included", async () => {
    const [user, organization] = await Promise.all([
      seedUser("promote@integration.test"),
      seedOrganization("Promote"),
    ]);
    await prisma.membership.create({
      data: { organizationId: organization.id, userId: user.id, accepted: true, role: "member" },
    });
    await clearOutbox();

    await prisma.membership.update({
      where: { userId_organizationId: { organizationId: organization.id, userId: user.id } },
      data: { role: "owner" },
    });

    // Deny by default: a role move deletes the relation for the old role, and the permission ladder is
    // deliberately not encoded in SQL where nothing would catch it drifting from authzed/schema.zed.
    expect(await outboxRows()).toEqual([
      { isRevocation: true, primaryId: organization.id, secondaryId: user.id, targetType: "membership" },
    ]);
  });

  test("enqueues the abandoned pair as a revocation when a membership moves organization", async () => {
    const [user, from, to] = await Promise.all([
      seedUser("move@integration.test"),
      seedOrganization("Move from"),
      seedOrganization("Move to"),
    ]);
    await prisma.membership.create({
      data: { organizationId: from.id, userId: user.id, accepted: true, role: "member" },
    });
    await clearOutbox();

    await prisma.$executeRaw`
      UPDATE "Membership" SET "organizationId" = ${to.id}
      WHERE "userId" = ${user.id} AND "organizationId" = ${from.id}
    `;

    expect(await outboxRows()).toEqual([
      { isRevocation: true, primaryId: from.id, secondaryId: user.id, targetType: "membership" },
      { isRevocation: false, primaryId: to.id, secondaryId: user.id, targetType: "membership" },
    ]);
  });

  test("classifies reactivation as a grant and deactivation as a revocation", async () => {
    const user = await seedUser("toggle@integration.test", false);
    await clearOutbox();

    await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
    // Every relationship is deleted while a user is inactive, so the pre-state is empty by construction.
    expect(await outboxRows()).toEqual([
      { isRevocation: false, primaryId: user.id, secondaryId: null, targetType: "user" },
    ]);

    await clearOutbox();
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    expect(await outboxRows()).toEqual([
      { isRevocation: true, primaryId: user.id, secondaryId: null, targetType: "user" },
    ]);
  });

  test("classifies unarchiving a directory as a grant unless it also changes organization", async () => {
    const [organization, other] = await Promise.all([
      seedOrganization("Directory home"),
      seedOrganization("Directory elsewhere"),
    ]);
    const directory = await prisma.feedbackDirectory.create({
      data: { name: "Archived", organizationId: organization.id, isArchived: true },
    });
    await clearOutbox();

    await prisma.feedbackDirectory.update({ where: { id: directory.id }, data: { isArchived: false } });
    expect(await outboxRows()).toEqual([
      { isRevocation: false, primaryId: directory.id, secondaryId: null, targetType: "feedback_directory" },
    ]);

    await prisma.feedbackDirectory.update({ where: { id: directory.id }, data: { isArchived: true } });
    // Cleared AFTER the re-archive, not before: that setup step enqueues a revocation of its own, and
    // `outboxRows` sorts revocations first, so asserting on `.at(0)` would have read the setup row and
    // passed even with the organizationId clause deleted from the classifier.
    await clearOutbox();

    await prisma.feedbackDirectory.update({
      where: { id: directory.id },
      data: { isArchived: false, organizationId: other.id },
    });

    // The parent edge is only ever touched, never re-pointed, so the old organization's administrators
    // keep access until reconciliation. A widening that moves tenants is still a revocation.
    expect(await outboxRows()).toEqual([
      { isRevocation: true, primaryId: directory.id, secondaryId: null, targetType: "feedback_directory" },
    ]);
  });

  test("classifies an unmapped enum move as a revocation", async () => {
    const [user, organization] = await Promise.all([
      seedUser("team@integration.test"),
      seedOrganization("Team owner"),
    ]);
    const team = await prisma.team.create({ data: { name: "Team", organizationId: organization.id } });
    await prisma.teamUser.create({ data: { teamId: team.id, userId: user.id, role: "contributor" } });
    await clearOutbox();

    await prisma.teamUser.update({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
      data: { role: "admin" },
    });

    expect(await outboxRows()).toEqual([
      { isRevocation: true, primaryId: team.id, secondaryId: user.id, targetType: "team_membership" },
    ]);
  });

  test("classifies a delete as a revocation", async () => {
    const [user, organization] = await Promise.all([
      seedUser("delete@integration.test"),
      seedOrganization("Delete"),
    ]);
    await prisma.membership.create({
      data: { organizationId: organization.id, userId: user.id, accepted: true, role: "member" },
    });
    await clearOutbox();

    await prisma.membership.delete({
      where: { userId_organizationId: { organizationId: organization.id, userId: user.id } },
    });

    expect(await outboxRows()).toEqual([
      { isRevocation: true, primaryId: organization.id, secondaryId: user.id, targetType: "membership" },
    ]);
  });
});

type TReleaseState = Readonly<{ availableAt: Date; deadLetteredAt: Date | null; permanentFailures: number }>;

const insertClaimedEvent = async (
  id: string,
  overrides: Readonly<{
    attempts?: number;
    isRevocation?: boolean;
    permanentFailures?: number;
    processedAt?: Date;
  }> = {}
): Promise<void> => {
  await prisma.$executeRaw`
    INSERT INTO "AuthzedProjectionOutbox"
      ("id", "targetType", "primaryId", "isRevocation", "attempts", "permanentFailures", "processedAt",
       "leaseOwner", "updatedAt")
    VALUES (
      ${id}, 'membership', 'organization-id', ${overrides.isRevocation ?? false},
      ${overrides.attempts ?? 1}, ${overrides.permanentFailures ?? 0}, ${overrides.processedAt ?? null},
      'lease', NOW()
    )
  `;
};

/** Releasing clears the lease, so the next failure has to be preceded by a fresh claim. */
const reclaim = (id: string): Promise<unknown> =>
  prisma.$executeRaw`UPDATE "AuthzedProjectionOutbox" SET "leaseOwner" = 'lease' WHERE "id" = ${id}`;

const releaseState = async (id: string): Promise<TReleaseState> => {
  const [row] = await prisma.$queryRaw<TReleaseState[]>`
    SELECT "availableAt", "deadLetteredAt", "permanentFailures"
    FROM "AuthzedProjectionOutbox" WHERE "id" = ${id}
  `;
  return row;
};

describe("AuthZed projection outbox failure release", () => {
  test("dead-letters only after enough failures attributable to one event", async () => {
    await insertClaimedEvent("solo", { permanentFailures: AUTHZED_OUTBOX_MAX_PERMANENT_FAILURES - 2 });

    await expect(
      markAuthzedOutboxEventsFailed("lease", ["solo"], "authzed_invalid_request", {
        attributable: true,
        retryable: false,
      })
    ).resolves.toBe(0);
    expect((await releaseState("solo")).permanentFailures).toBe(AUTHZED_OUTBOX_MAX_PERMANENT_FAILURES - 1);

    await reclaim("solo");
    await expect(
      markAuthzedOutboxEventsFailed("lease", ["solo"], "authzed_invalid_request", {
        attributable: true,
        retryable: false,
      })
    ).resolves.toBe(1);
    expect((await releaseState("solo")).deadLetteredAt).toBeInstanceOf(Date);
  });

  test("never dead-letters a retryable failure, however long the outage runs", async () => {
    // The reported failure mode: SpiceDB down for an hour dead-letters two hundred healthy events, and
    // a dead-lettered revocation denies every enforced check until an operator replays it by hand.
    await insertClaimedEvent("outage", { attempts: 60, permanentFailures: 0 });

    for (let attempt = 0; attempt < AUTHZED_OUTBOX_MAX_PERMANENT_FAILURES + 5; attempt++) {
      await reclaim("outage");
      await expect(
        markAuthzedOutboxEventsFailed("lease", ["outage"], "authzed_unavailable", {
          attributable: true,
          retryable: true,
        })
      ).resolves.toBe(0);
    }

    expect(await releaseState("outage")).toMatchObject({ deadLetteredAt: null, permanentFailures: 0 });
  });

  test("never dead-letters an event a group failure could not attribute", async () => {
    await insertClaimedEvent("bystander", { permanentFailures: AUTHZED_OUTBOX_MAX_PERMANENT_FAILURES - 1 });

    await expect(
      markAuthzedOutboxEventsFailed("lease", ["bystander", "other"], "authzed_projection_invalid_source", {
        attributable: false,
        retryable: false,
      })
    ).resolves.toBe(0);

    expect(await releaseState("bystander")).toMatchObject({
      deadLetteredAt: null,
      permanentFailures: AUTHZED_OUTBOX_MAX_PERMANENT_FAILURES - 1,
    });
  });

  test("backs off further for a later attempt and stops growing at the ceiling", async () => {
    await Promise.all([
      insertClaimedEvent("early", { attempts: 3 }),
      insertClaimedEvent("late", { attempts: 40 }),
    ]);

    await markAuthzedOutboxEventsFailed("lease", ["early", "late"], "authzed_unavailable", {
      attributable: false,
      retryable: true,
    });

    const [early, late] = await Promise.all([releaseState("early"), releaseState("late")]);
    expect(early.availableAt.getTime()).toBeLessThan(late.availableAt.getTime());
    // Capped rather than overflowed: 2 ^ 40 milliseconds is thirty-five thousand years.
    expect(late.availableAt.getTime() - Date.now()).toBeLessThanOrEqual(5 * 60_000 + 5_000);
  });

  test("leaves an event released by a lease it no longer owns untouched", async () => {
    await insertClaimedEvent("stolen");
    await prisma.$executeRaw`UPDATE "AuthzedProjectionOutbox" SET "leaseOwner" = 'other' WHERE "id" = 'stolen'`;

    await expect(
      markAuthzedOutboxEventsFailed("lease", ["stolen"], "authzed_internal", {
        attributable: true,
        retryable: false,
      })
    ).resolves.toBe(0);

    expect((await releaseState("stolen")).permanentFailures).toBe(0);
  });
});

describe("AuthZed projection freshness guard", () => {
  test("stays disarmed for a grant that has been pending far past the window", async () => {
    // The whole point of the classifier: a bulk invite acceptance must not deny the deployment.
    await insertClaimedEvent("aged-grant", { isRevocation: false });
    await prisma.$executeRaw`UPDATE "AuthzedProjectionOutbox" SET "createdAt" = NOW() - INTERVAL '1 hour' WHERE "id" = 'aged-grant'`;

    await expect(hasStaleAuthzedRevocation()).resolves.toBe(false);
  });

  test("stays disarmed for a revocation that was actually delivered", async () => {
    // Delivered rows are retained for seven days, so a healthy deployment permanently holds thousands
    // of processed revocations far older than the window. Dropping `processedAt IS NULL` from either
    // EXISTS would therefore deny the whole deployment forever, and nothing else in the suite writes a
    // delivered row to notice.
    await insertClaimedEvent("delivered-revocation", { isRevocation: true, processedAt: new Date() });
    await prisma.$executeRaw`UPDATE "AuthzedProjectionOutbox" SET "createdAt" = NOW() - INTERVAL '1 hour' WHERE "id" = 'delivered-revocation'`;

    await expect(hasStaleAuthzedRevocation()).resolves.toBe(false);
  });

  test("arms for an overdue revocation and for a dead-lettered one of any age", async () => {
    await insertClaimedEvent("aged-revocation", { isRevocation: true });
    await prisma.$executeRaw`UPDATE "AuthzedProjectionOutbox" SET "createdAt" = NOW() - INTERVAL '1 hour' WHERE "id" = 'aged-revocation'`;
    await expect(hasStaleAuthzedRevocation()).resolves.toBe(true);

    await prisma.$executeRaw`TRUNCATE "AuthzedProjectionOutbox"`;
    await insertClaimedEvent("fresh-dead-letter", { isRevocation: true });
    await prisma.$executeRaw`UPDATE "AuthzedProjectionOutbox" SET "deadLetteredAt" = NOW() WHERE "id" = 'fresh-dead-letter'`;
    // No age bound on dead letters is deliberate: an old one is more dangerous than a fresh one.
    await expect(hasStaleAuthzedRevocation()).resolves.toBe(true);
  });
});

describe("AuthZed projection outbox indexes", () => {
  test("keeps every hot-path index off the retained delivery history", async () => {
    const indexes = await prisma.$queryRaw<ReadonlyArray<{ indexdef: string; indexname: string }>>`
      SELECT "indexname", "indexdef" FROM pg_indexes
      WHERE "tablename" = 'AuthzedProjectionOutbox' AND "indexname" <> 'AuthzedProjectionOutbox_pkey'
      ORDER BY "indexname"
    `;

    expect(indexes.map(({ indexname }) => indexname)).toEqual([
      "AuthzedProjectionOutbox_claim_idx",
      "AuthzedProjectionOutbox_processed_idx",
      "AuthzedProjectionOutbox_undelivered_idx",
    ]);
    for (const { indexdef } of indexes) {
      expect(indexdef).toMatch(/WHERE /);
    }
  });

  test("serves the claim in index order rather than sorting the backlog", async () => {
    // Seeded and analyzed on purpose: on an empty table the planner prefers a sequential scan whatever
    // indexes exist, so asserting the plan without a backlog and real statistics measures nothing.
    await prisma.$executeRaw`
      INSERT INTO "AuthzedProjectionOutbox"
        ("id", "targetType", "primaryId", "isRevocation", "createdAt", "updatedAt")
      SELECT
        'plan-' || generated::text, 'membership', 'organization-id', generated % 2 = 0,
        NOW() - (generated * INTERVAL '1 second'), NOW()
      FROM generate_series(1, 2000) AS generated
    `;
    await prisma.$executeRawUnsafe('ANALYZE "AuthzedProjectionOutbox";');

    const plan = await prisma.$queryRaw<ReadonlyArray<{ "QUERY PLAN": string }>>`
      EXPLAIN SELECT "id" FROM "AuthzedProjectionOutbox"
      WHERE "processedAt" IS NULL AND "deadLetteredAt" IS NULL AND "availableAt" <= NOW()
        AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= NOW())
      ORDER BY "isRevocation" DESC, "createdAt" ASC
      LIMIT 200
    `;
    const rendered = plan.map((line) => line["QUERY PLAN"]).join("\n");

    expect(rendered).toContain("AuthzedProjectionOutbox_claim_idx");
    expect(rendered).not.toContain("Sort");
  });
});
