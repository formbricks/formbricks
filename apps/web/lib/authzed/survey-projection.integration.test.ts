import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { synchronizeAuthzedIntegrationFixture } from "@/integration/authzed";
import { resetDb } from "@/integration/reset-db";
import { runAuthzedBackfill } from "./backfill";
import { createAuthzedBackfillApply, createAuthzedBackfillNoopApply } from "./backfill-apply";
import { getAuthzedClient } from "./client";
import { AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN } from "./constants";
import { drainAuthzedOutbox } from "./outbox-processor";
import { hasStaleAuthzedRevocation } from "./outbox-repository";
import { readAllRelationships } from "./relationship-reads";
import {
  clearProjectionScopeReady,
  isSurveyVisibilityReady,
  resetSurveyVisibilityReadinessMemo,
  setProjectionScopeReady,
} from "./scope-readiness";

/**
 * ENG-3282: the survey projection against a real PostgreSQL and SpiceDB — trigger → outbox → projector
 * → graph, plus the `survey` backfill scope and the readiness marker it gates.
 */

const client = () => getAuthzedClient();

const surveyEdges = async (surveyId: string): Promise<ReadonlyArray<string>> => {
  const { relationships } = await readAllRelationships(client(), {
    resourceId: surveyId,
    resourceType: "survey",
  });
  return relationships
    .map(({ relation, subject }) => `${relation}@${subject.objectType}:${subject.objectId}`)
    .sort();
};

const drain = async (): Promise<void> => {
  const result = await drainAuthzedOutbox();
  expect(result).toMatchObject({ deadLettered: 0, failed: 0, status: "drained" });
};

const seedWorkspace = async (label: string) => {
  const owner = await prisma.user.create({ data: { email: `${label}@survey-projection.test`, name: label } });
  const organization = await prisma.organization.create({ data: { name: `${label} Org` } });
  await prisma.membership.create({
    data: { accepted: true, organizationId: organization.id, role: "member", userId: owner.id },
  });
  const workspace = await prisma.workspace.create({
    data: { name: `${label} Workspace`, organizationId: organization.id },
  });
  return { organization, owner, workspace };
};

const surveyRequest = (mode: "apply" | "dry_run") =>
  ({
    maxPrune: AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN,
    mode,
    prune: true,
    scope: { kind: "survey" },
  }) as const;

beforeEach(async () => {
  await resetDb();
  resetSurveyVisibilityReadinessMemo();
  await synchronizeAuthzedIntegrationFixture();
});

describe("survey projection through the outbox", () => {
  test("follows a survey from creation through a visibility flip to deletion", async () => {
    const { owner, workspace } = await seedWorkspace("lifecycle");
    const survey = await prisma.survey.create({
      data: { name: "Lifecycle", ownerId: owner.id, workspaceId: workspace.id },
    });
    await drain();

    expect(await surveyEdges(survey.id)).toEqual([
      `owner@user:${owner.id}`,
      `shared_workspace@workspace:${workspace.id}`,
      `workspace@workspace:${workspace.id}`,
    ]);

    // What the visibility endpoint writes: the flag and a new version, together.
    await prisma.survey.update({
      where: { id: survey.id },
      data: { visibility: "restricted", visibilityVersion: { increment: 1 } },
    });
    await drain();

    expect(await surveyEdges(survey.id)).toEqual([
      `owner@user:${owner.id}`,
      `private_owner@user:${owner.id}`,
      `workspace@workspace:${workspace.id}`,
    ]);
    await expect(
      prisma.survey.findUniqueOrThrow({
        where: { id: survey.id },
        select: { visibilityPending: true, visibilityProjectedVersion: true },
      })
    ).resolves.toEqual({ visibilityPending: false, visibilityProjectedVersion: 1 });

    await prisma.survey.delete({ where: { id: survey.id } });
    await drain();

    expect(await surveyEdges(survey.id)).toEqual([]);
  });

  test("never acknowledges while an older version is still what the graph holds", async () => {
    const { owner, workspace } = await seedWorkspace("fence");
    const survey = await prisma.survey.create({
      data: { name: "Fence", ownerId: owner.id, workspaceId: workspace.id },
    });
    await drain();

    // A version bump with no change to the watched facts enqueues nothing: nobody has projected it.
    await prisma.survey.update({ where: { id: survey.id }, data: { visibilityVersion: { increment: 1 } } });
    await drain();

    await expect(
      prisma.survey.findUniqueOrThrow({ where: { id: survey.id }, select: { visibilityPending: true } })
    ).resolves.toEqual({ visibilityPending: true });
  });

  test("deleting a workspace full of surveys enqueues no revocation and leaves the guard unarmed", async () => {
    const { owner, workspace } = await seedWorkspace("workspace-delete");
    await prisma.survey.createMany({
      data: Array.from({ length: 50 }, (_unused, index) => ({
        name: `Survey ${index.toString()}`,
        ownerId: owner.id,
        workspaceId: workspace.id,
      })),
    });
    await drain();
    await prisma.$executeRawUnsafe('TRUNCATE "AuthzedProjectionOutbox";');

    await prisma.workspace.delete({ where: { id: workspace.id } });

    const [counts] = await prisma.$queryRaw<Array<{ revocations: bigint; surveys: bigint }>>`
      SELECT
        COUNT(*) FILTER (WHERE "targetType" = 'survey') AS surveys,
        COUNT(*) FILTER (WHERE "targetType" = 'survey' AND "isRevocation") AS revocations
      FROM "AuthzedProjectionOutbox"
    `;
    expect(Number(counts.surveys)).toBe(50);
    expect(Number(counts.revocations)).toBe(0);
    await expect(hasStaleAuthzedRevocation()).resolves.toBe(false);

    await drain();
    const { relationships } = await readAllRelationships(client(), {
      resourceType: "survey",
      subject: { objectId: workspace.id, objectType: "workspace" },
    });
    expect(relationships).toEqual([]);
  });
});

describe("survey backfill scope and readiness marker", () => {
  test("rebuilds an empty survey graph, audits clean, and only then may be marked ready", async () => {
    const { owner, workspace } = await seedWorkspace("backfill");
    const [visible, hidden] = await Promise.all([
      prisma.survey.create({ data: { name: "Visible", ownerId: owner.id, workspaceId: workspace.id } }),
      prisma.survey.create({
        data: { name: "Hidden", ownerId: owner.id, visibility: "restricted", workspaceId: workspace.id },
      }),
    ]);
    // Discard what the trigger enqueued, and the edges: the state right after an upgrade.
    await prisma.$executeRawUnsafe('TRUNCATE "AuthzedProjectionOutbox";');
    for (const { id } of [visible, hidden]) {
      await client().deleteRelationships({ resourceId: id, resourceType: "survey" });
    }

    const before = await runAuthzedBackfill(surveyRequest("dry_run"), {
      apply: createAuthzedBackfillNoopApply(),
      client: client(),
    });
    expect(before).toMatchObject({ counters: { missing: 2 }, status: "drifted" });
    await expect(isSurveyVisibilityReady()).resolves.toBe(false);

    const applied = await runAuthzedBackfill(surveyRequest("apply"), {
      apply: createAuthzedBackfillApply(),
      client: client(),
    });
    expect(applied.counters.failed).toBe(0);

    const after = await runAuthzedBackfill(surveyRequest("dry_run"), {
      apply: createAuthzedBackfillNoopApply(),
      client: client(),
    });
    expect(after.status).toBe("reconciled");
    expect(await surveyEdges(hidden.id)).toEqual([
      `owner@user:${owner.id}`,
      `private_owner@user:${owner.id}`,
      `workspace@workspace:${workspace.id}`,
    ]);

    await setProjectionScopeReady("survey", "integration");
    resetSurveyVisibilityReadinessMemo();
    await expect(isSurveyVisibilityReady()).resolves.toBe(true);

    await clearProjectionScopeReady("survey");
    resetSurveyVisibilityReadinessMemo();
    await expect(isSurveyVisibilityReady()).resolves.toBe(false);
  });

  test("reports a forged cross-workspace shared edge as a mismatched parent", async () => {
    const { owner, workspace } = await seedWorkspace("forged");
    const foreign = await seedWorkspace("forged-foreign");
    const survey = await prisma.survey.create({
      data: { name: "Forged", ownerId: owner.id, workspaceId: workspace.id },
    });
    await drain();
    await client().writeRelationships([
      {
        operation: "touch",
        relationship: {
          relation: "shared_workspace",
          resource: { objectId: survey.id, objectType: "survey" },
          subject: { objectId: foreign.workspace.id, objectType: "workspace" },
        },
      },
    ]);

    const audit = await runAuthzedBackfill(surveyRequest("dry_run"), {
      apply: createAuthzedBackfillNoopApply(),
      client: client(),
    });

    expect(audit.status).toBe("drifted");
    expect(audit.mismatchedParents).toEqual([
      {
        childId: survey.id,
        childType: "survey",
        relation: "shared_workspace",
        workspaceId: foreign.workspace.id,
      },
    ]);
  });
});
