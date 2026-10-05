import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import type {
  TAuthzedClient,
  TAuthzedRelationship,
  TAuthzedRelationshipFilter,
  TAuthzedRelationshipUpdate,
} from "./client";
import { getAuthzedClient } from "./client";
import {
  AUTHZED_MAX_RECONCILIATION_PASSES,
  AuthzedProjectionUnstableError,
  type TAuthzedProjectionResult,
  runBestEffortProjection,
} from "./projection";
import { runChunked } from "./projection-chunks";
import { packRelationshipUpdateGroups } from "./relationship-batches";
import { readAllRelationships } from "./relationship-reads";
import { type TSurveyProjectionRow, expectedSurveyRelationships } from "./survey-relationships";

export { expectedSurveyRelationships, type TSurveyProjectionRow } from "./survey-relationships";

/**
 * Survey ownership and visibility, projected from PostgreSQL into SpiceDB (ENG-3282).
 *
 * PostgreSQL is the durable source: `Survey.workspaceId`, `ownerId` and `visibility`. The graph never
 * holds a fact on its own, so a rebuild from an empty graph restores everything.
 *
 * Each survey is reconciled inside a transaction holding a per-survey advisory lock — the same lock
 * the visibility endpoint takes to write a change. So a projector that read the row before a newer
 * change cannot write after it: it either finishes first, or waits and then reads the newer row.
 * The acknowledgement (`visibilityProjectedVersion`) is written under that lock too, and only for the
 * exact version that was projected, so a 200 for a grant means the graph holds that version.
 */

/** Advisory lock key prefix. The visibility endpoint MUST take `hashtext(prefix || id)` identically. */
export const SURVEY_VISIBILITY_LOCK_PREFIX = "survey-visibility:";

/**
 * Upper bound on one survey's reconcile transaction. It spans SpiceDB round trips, each with its own
 * retry budget, so Prisma's five-second default would abort a healthy but slow reconcile.
 */
const SURVEY_PROJECTION_TRANSACTION_TIMEOUT_MS = 30_000;
const SURVEY_PROJECTION_TRANSACTION_MAX_WAIT_MS = 10_000;

const surveyProjectionSelect = {
  id: true,
  ownerId: true,
  visibility: true,
  visibilityVersion: true,
  workspaceId: true,
} as const satisfies Prisma.SurveySelect;

const relationshipKey = ({ relation, resource, subject }: TAuthzedRelationship): string =>
  JSON.stringify([
    relation,
    resource.objectType,
    resource.objectId,
    subject.objectType,
    subject.objectId,
    subject.relation ?? "",
  ]);

/**
 * Updates that turn `current` into exactly `expected`: touch everything expected, delete everything
 * else observed on the survey. Pure so the diff is testable without a graph.
 */
export const diffSurveyRelationships = (
  current: ReadonlyArray<TAuthzedRelationship>,
  expected: ReadonlyArray<TAuthzedRelationship>
): TAuthzedRelationshipUpdate[] => {
  const expectedKeys = new Set(expected.map(relationshipKey));

  return [
    ...expected.map((relationship): TAuthzedRelationshipUpdate => ({ operation: "touch", relationship })),
    ...current
      .filter((relationship) => !expectedKeys.has(relationshipKey(relationship)))
      .map((relationship): TAuthzedRelationshipUpdate => ({ operation: "delete", relationship })),
  ];
};

const sameFacts = (left: TSurveyProjectionRow | null, right: TSurveyProjectionRow | null): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

type TTransaction = Prisma.TransactionClient;

/** Take the per-survey lock for the rest of `tx`. Shared with the visibility endpoint. */
export const lockSurveyVisibility = async (tx: TTransaction, surveyId: string): Promise<void> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${SURVEY_VISIBILITY_LOCK_PREFIX + surveyId}))`;
};

const readProjectionRow = (tx: TTransaction, surveyId: string): Promise<TSurveyProjectionRow | null> =>
  tx.survey.findUnique({ where: { id: surveyId }, select: surveyProjectionSelect });

/**
 * Record that the graph holds `version`. Raw SQL on purpose: a Prisma `update` would bump the
 * `@updatedAt` column, reordering every survey list on each projection. Guarded on the version so a
 * newer change stored meanwhile is never acknowledged by this older projection.
 */
const acknowledgeVersion = (tx: TTransaction, surveyId: string, version: number): Promise<number> =>
  tx.$executeRaw`
    UPDATE "Survey" SET "visibilityProjectedVersion" = ${version}
    WHERE id = ${surveyId}
      AND "visibilityVersion" = ${version}
      AND "visibilityProjectedVersion" <> ${version}
  `;

const reconcileSurvey = async (client: TAuthzedClient, surveyId: string): Promise<number> =>
  prisma.$transaction(
    async (tx) => {
      await lockSurveyVisibility(tx, surveyId);

      for (let pass = 1; pass <= AUTHZED_MAX_RECONCILIATION_PASSES; pass++) {
        const row = await readProjectionRow(tx, surveyId);
        if (!row) {
          // A deleted survey is not a revocation (see the trigger migration): every survey decision
          // resolves the row first and denies once it is gone. Removing the edges is hygiene.
          await client.deleteRelationships({ resourceId: surveyId, resourceType: "survey" });
          return pass;
        }

        const { relationships: current } = await readAllRelationships(client, {
          resourceId: surveyId,
          resourceType: "survey",
        });
        const updates = diffSurveyRelationships(current, expectedSurveyRelationships(row));
        for (const batch of packRelationshipUpdateGroups(updates.map((update) => [update]))) {
          // One write in flight per survey, inside its advisory lock, like the other projectors.
          await client.writeRelationships(batch); // NOSONAR
        }

        // The lock fences visibility changes, but not every fact: deleting the owner's account sets
        // `ownerId` to null without it. Re-read, and only acknowledge a row that held still.
        if (sameFacts(row, await readProjectionRow(tx, surveyId))) {
          await acknowledgeVersion(tx, surveyId, row.visibilityVersion);
          return pass;
        }
      }

      throw new AuthzedProjectionUnstableError();
    },
    { maxWait: SURVEY_PROJECTION_TRANSACTION_MAX_WAIT_MS, timeout: SURVEY_PROJECTION_TRANSACTION_TIMEOUT_MS }
  );

const reconcileSurveyChunk = ({
  surveyIds,
}: Readonly<{ surveyIds: ReadonlyArray<string> }>): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("reconcile_survey_relationships", "survey", async () => {
    const client = getAuthzedClient();
    let passes = 0;
    // Sequential: each survey holds a pooled connection for the length of its SpiceDB round trips.
    for (const surveyId of surveyIds) {
      passes = Math.max(passes, await reconcileSurvey(client, surveyId)); // NOSONAR
    }
    return passes;
  });

/**
 * Converge each survey's relationships to what its row implies, acknowledging the projected version.
 * Never throws: failures come back as `{ status: "failed" }`, so callers must inspect the result.
 */
export const reconcileSurveyRelationships = async (
  surveyIds: ReadonlyArray<string>
): Promise<TAuthzedProjectionResult> => {
  // One fixed order for every caller, so concurrent reconciles take the per-survey locks in one order.
  const unique = [...new Set(surveyIds)].sort((left, right) => left.localeCompare(right));
  return (
    (await runChunked(reconcileSurveyChunk, { surveyIds: unique })) ?? { passes: 0, status: "projected" }
  );
};

/**
 * Every survey's workspace edges onto one workspace, by subject — for a deleted workspace. Owner edges
 * left behind grant nothing: both owner arms of the schema intersect with `workspace->…`, now empty.
 */
export const surveyRelationshipsOnWorkspaceFilter = (workspaceId: string): TAuthzedRelationshipFilter => ({
  resourceType: "survey",
  subject: { objectId: workspaceId, objectType: "workspace" },
});
