import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import {
  AUTHZED_OUTBOX_MAX_PERMANENT_FAILURES,
  AUTHZED_OUTBOX_MAX_RETRY_DELAY_MS,
  hasStaleAuthzedRevocation,
  markAuthzedOutboxEventsFailed,
} from "@/lib/authzed/outbox-repository";

const readMigration = (name: string): string =>
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      `../../../../packages/database/migration/${name}/migration.sql`
    ),
    "utf8"
  );

const migration = readMigration("20260818120000_add_authzed_projection_outbox");
// Re-declares both trigger functions with the survey case (ENG-3282). Replaying the outbox migration
// alone would roll them back to the pre-survey classifier, so the convergence test replays both.
const surveyMigration = readMigration("20260928120002_add_survey_projection_trigger");

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
  test("the migration converges when applied repeatedly", async () => {
    for (let run = 0; run < 2; run++) {
      await prisma.$executeRawUnsafe(migration);
      await prisma.$executeRawUnsafe(surveyMigration);
    }

    const [catalog] = await prisma.$queryRaw<Array<{ indexes: bigint; triggers: bigint }>>`
      SELECT
        (SELECT COUNT(*) FROM pg_indexes
         WHERE tablename = 'AuthzedProjectionOutbox'
           AND indexname <> 'AuthzedProjectionOutbox_pkey') AS indexes,
        (SELECT COUNT(*) FROM pg_trigger
         WHERE tgname LIKE 'authzed_projection_%'
           AND NOT tgisinternal) AS triggers
    `;
    expect(Number(catalog?.indexes)).toBe(3);
    expect(Number(catalog?.triggers)).toBe(12);
  });

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

    // Reconciliation clears every previous parent before restoring the current one. Treat the move as
    // a revocation so the freshness guard remains active until that exact replacement is delivered.
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

const seedSurvey = async (label: string) => {
  const [owner, organization] = await Promise.all([
    seedUser(`${label}@integration.test`),
    seedOrganization(label),
  ]);
  const workspace = await prisma.workspace.create({
    data: { name: `${label} Workspace`, organizationId: organization.id },
  });
  return { owner, organization, workspace };
};

const surveyEvents = async () => (await outboxRows()).filter((row) => row.targetType === "survey");

describe("AuthZed projection outbox triggers: survey (ENG-3282)", () => {
  test("classifies each survey transition by whether it can take access away", async () => {
    const { owner, organization, workspace } = await seedSurvey("survey-transitions");
    const other = await seedUser("survey-transitions-other@integration.test");
    const otherWorkspace = await prisma.workspace.create({
      data: { name: "Other Workspace", organizationId: organization.id },
    });
    await clearOutbox();

    // INSERT → grant. Also proves the `visibilityPending` trigger, not Prisma, decides the column: the
    // row starts in its initial projection (version 0, never acknowledged) until the projector runs.
    const survey = await prisma.survey.create({
      data: { name: "Transitions", workspaceId: workspace.id, ownerId: owner.id, createdBy: owner.id },
    });
    expect(survey).toMatchObject({
      visibilityPending: true,
      visibilityProjectedVersion: -1,
      visibilityVersion: 0,
    });
    expect(await surveyEvents()).toEqual([
      { isRevocation: false, primaryId: survey.id, secondaryId: null, targetType: "survey" },
    ]);

    const expectNext = async (
      data: Parameters<typeof prisma.survey.update>[0]["data"],
      isRevocation: boolean
    ) => {
      await clearOutbox();
      await prisma.survey.update({ where: { id: survey.id }, data });
      expect(await surveyEvents()).toEqual([
        { isRevocation, primaryId: survey.id, secondaryId: null, targetType: "survey" },
      ]);
    };

    await expectNext({ visibility: "restricted" }, true); // workspace → restricted drops the shared edge
    await expectNext({ visibility: "workspace" }, false); // restricted → workspace only adds
    await expectNext({ visibility: "workspace" }, false); // unchanged facts project identical edges
    await expectNext({ ownerId: other.id }, true); // the previous owner loses change_visibility
    await expectNext({ workspaceId: otherWorkspace.id }, true); // the previous workspace loses read

    // Content writes are not authorization facts: the trigger does not fire at all.
    await clearOutbox();
    await prisma.survey.update({ where: { id: survey.id }, data: { blocks: [], name: "Renamed" } });
    await prisma.survey.update({ where: { id: survey.id }, data: { visibilityVersion: { increment: 1 } } });
    expect(await surveyEvents()).toEqual([]);

    // DELETE is not a revocation: every survey decision resolves the row first and denies once it is
    // gone, and counting it would let a workspace delete with many surveys arm the freshness guard.
    await clearOutbox();
    await prisma.survey.delete({ where: { id: survey.id } });
    expect(await surveyEvents()).toEqual([
      { isRevocation: false, primaryId: survey.id, secondaryId: null, targetType: "survey" },
    ]);
  });

  test("keeps visibilityPending in step with the two versions", async () => {
    const { workspace } = await seedSurvey("survey-pending");
    // Whatever pair the insert supplies, it starts in its initial projection.
    const survey = await prisma.survey.create({
      data: {
        name: "Pending",
        visibilityProjectedVersion: 3,
        visibilityVersion: 3,
        workspaceId: workspace.id,
      },
    });
    expect(survey).toMatchObject({
      visibilityPending: true,
      visibilityProjectedVersion: -1,
      visibilityVersion: 0,
    });

    const acked = await prisma.survey.update({
      where: { id: survey.id },
      data: { visibilityProjectedVersion: survey.visibilityVersion },
    });
    expect(acked.visibilityPending).toBe(false);

    // Only an insert is rewritten: an update that leaves the versions equal stays settled.
    const touched = await prisma.survey.update({
      where: { id: survey.id },
      data: { visibilityPending: true },
    });
    expect(touched).toMatchObject({ visibilityPending: false, visibilityVersion: 0 });

    const bumped = await prisma.survey.update({
      where: { id: survey.id },
      data: { visibilityVersion: { increment: 1 } },
    });
    expect(bumped.visibilityPending).toBe(true);
  });

  test("sets the owner to null when the owning user is deleted, without a survey revocation", async () => {
    const { owner, workspace } = await seedSurvey("survey-owner-delete");
    const surveys = await Promise.all(
      ["Orphan 1", "Orphan 2", "Orphan 3"].map((name) =>
        prisma.survey.create({ data: { name, workspaceId: workspace.id, ownerId: owner.id } })
      )
    );
    const restricted = await prisma.survey.create({
      data: {
        name: "Orphan restricted",
        workspaceId: workspace.id,
        ownerId: owner.id,
        visibility: "restricted",
      },
    });
    await clearOutbox();

    await prisma.user.delete({ where: { id: owner.id } });

    for (const survey of [...surveys, restricted]) {
      await expect(
        prisma.survey.findUniqueOrThrow({ where: { id: survey.id }, select: { ownerId: true } })
      ).resolves.toEqual({ ownerId: null });
    }
    // One reconcile per survey, none of them a revocation: both owner arms intersect workspace read,
    // which the user's own revocation (below) already takes away.
    const events = await surveyEvents();
    expect(events).toHaveLength(4);
    expect(events.every((event) => !event.isRevocation)).toBe(true);
    expect((await outboxRows()).some((row) => row.targetType === "user" && row.isRevocation)).toBe(true);
  });

  test("still counts an owner cleared together with a revoking change as a revocation", async () => {
    const { owner, workspace } = await seedSurvey("survey-owner-null-restrict");
    const survey = await prisma.survey.create({
      data: { name: "Restrict", workspaceId: workspace.id, ownerId: owner.id },
    });
    const otherWorkspace = await prisma.workspace.create({
      data: { name: "Moved", organizationId: workspace.organizationId },
    });

    await clearOutbox();
    await prisma.survey.update({
      where: { id: survey.id },
      data: { ownerId: null, visibility: "restricted" },
    });
    expect(await surveyEvents()).toEqual([
      { isRevocation: true, primaryId: survey.id, secondaryId: null, targetType: "survey" },
    ]);

    await clearOutbox();
    await prisma.survey.update({ where: { id: survey.id }, data: { visibility: "workspace" } });
    await prisma.survey.update({ where: { id: survey.id }, data: { ownerId: owner.id } });
    await clearOutbox();
    await prisma.survey.update({
      where: { id: survey.id },
      data: { ownerId: null, workspaceId: otherWorkspace.id },
    });
    expect(await surveyEvents()).toEqual([
      { isRevocation: true, primaryId: survey.id, secondaryId: null, targetType: "survey" },
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

  test("never clears an existing dead letter even if a lease invariant is violated", async () => {
    await insertClaimedEvent("dead-letter", {
      permanentFailures: AUTHZED_OUTBOX_MAX_PERMANENT_FAILURES - 1,
    });
    await markAuthzedOutboxEventsFailed("lease", ["dead-letter"], "authzed_invalid_request", {
      attributable: true,
      retryable: false,
    });

    await reclaim("dead-letter");
    await expect(
      markAuthzedOutboxEventsFailed("lease", ["dead-letter"], "authzed_unavailable", {
        attributable: false,
        retryable: true,
      })
    ).resolves.toBe(0);
    expect((await releaseState("dead-letter")).deadLetteredAt).toBeInstanceOf(Date);
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
    const cappedDelayMs = late.availableAt.getTime() - Date.now();
    expect(cappedDelayMs).toBeGreaterThanOrEqual(AUTHZED_OUTBOX_MAX_RETRY_DELAY_MS - 5_000);
    expect(cappedDelayMs).toBeLessThanOrEqual(AUTHZED_OUTBOX_MAX_RETRY_DELAY_MS + 5_000);
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
