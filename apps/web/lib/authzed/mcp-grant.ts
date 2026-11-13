import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { isRelationMissingFromSchema } from "@/lib/authorization/schema-drift";
import {
  MCP_GRANT_ACCESS_SELECT,
  type TMcpGrantAccessSelection,
  readMcpGrantAccessSelection,
} from "@/modules/mcp/grant";
import { getMcpGrantSelectedIds } from "@/modules/mcp/grant-access";
import { type TAuthzedRelationship, type TAuthzedRelationshipUpdate, getAuthzedClient } from "./client";
import { isAuthzedEnabled } from "./config";
import { AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES } from "./constants";
import {
  AUTHZED_MAX_RECONCILIATION_PASSES,
  AuthzedProjectionUnstableError,
  type TAuthzedProjectionResult,
  runBestEffortProjection,
} from "./projection";
import { packRelationshipUpdateGroups } from "./relationship-batches";
import { MCP_GRANT_RELATION, MCP_GRANT_SUBJECT_TYPE } from "./relationship-map";
import { readAllRelationships } from "./relationship-reads";

/**
 * Projects an MCP grant's organization & workspace access into SpiceDB (ENG-7153, ADR-0042):
 * `organization:<id>#mcp_grant@mcp_grant:<grant>` for each organization a grant with Only selected
 * organizations selects, `workspace:<id>#mcp_grant@mcp_grant:<grant>` for each workspace a grant with
 * Only selected workspaces selects, and nothing for All access or a grant that no longer exists.
 *
 * Fed by the outbox (`McpGrant`, `McpGrantOrganization`, `McpGrantWorkspace` triggers, target type
 * `mcp_grant`, keyed by grant id) and by the backfill's repair. Each pass reads the grant's rows,
 * observes the relationships SpiceDB holds for it, and writes one batch that touches the expected ones
 * and deletes the rest, so a narrowing never passes through an empty state and a widening never through
 * a wider one. A selection removed from PostgreSQL is found by the observation, not the snapshot.
 */

export type TMcpGrantProjectionTargets = Readonly<{ grantIds?: ReadonlyArray<string> }>;

/** What a grant's relationships follow from: its id and its organization & workspace access. */
export type TProjectedMcpGrant = Readonly<{ id: string } & TMcpGrantAccessSelection>;

type TGrantSnapshot = ReadonlyArray<TProjectedMcpGrant>;

/** How long one reconciling pass may hold its grants' row locks, SpiceDB round trips included. */
const MCP_GRANT_PROJECTION_TRANSACTION_TIMEOUT_MS = 30_000;
const MCP_GRANT_PROJECTION_TRANSACTION_MAX_WAIT_MS = 10_000;

/**
 * Reads the grants' access in the reconciling transaction, after locking their rows `FOR SHARE` in id
 * order. A narrowing (consent re-approval, Edit) holds its grant's row `FOR UPDATE` from before it deletes
 * relationships in SpiceDB until it commits, so a reconcile either finishes its write before the narrowing
 * starts, or reads the narrowed rows once it has committed. Without the lock, a reconcile that read the
 * grant before the narrowing could write the old relationships back after the narrowing deleted them.
 */
const readSnapshot = async (
  tx: Prisma.TransactionClient,
  grantIds: ReadonlyArray<string>
): Promise<TGrantSnapshot> => {
  await tx.$queryRaw`
    SELECT "id" FROM "McpGrant" WHERE "id" = ANY(${[...grantIds]}::text[]) ORDER BY "id" FOR SHARE`;
  const grants = await tx.mcpGrant.findMany({
    where: { id: { in: [...grantIds] } },
    select: { id: true, ...MCP_GRANT_ACCESS_SELECT },
    orderBy: { id: "asc" },
  });
  return grants.map((grant) => ({ id: grant.id, ...readMcpGrantAccessSelection(grant) }));
};

const relationshipTo = (
  resourceType: "organization" | "workspace",
  resourceId: string,
  grantId: string
): TAuthzedRelationship => ({
  relation: MCP_GRANT_RELATION,
  resource: { objectId: resourceId, objectType: resourceType },
  subject: { objectId: grantId, objectType: MCP_GRANT_SUBJECT_TYPE },
});

/**
 * The relationships a grant's access implies: one per organization of Only selected organizations, one per
 * workspace of Only selected workspaces, none for All access.
 */
export const expectedMcpGrantRelationships = (
  grant: TProjectedMcpGrant
): ReadonlyArray<TAuthzedRelationship> => {
  const { organizationIds, workspaceIds } = getMcpGrantSelectedIds(grant);
  return [
    ...organizationIds.map((id) => relationshipTo("organization", id, grant.id)),
    ...workspaceIds.map((id) => relationshipTo("workspace", id, grant.id)),
  ];
};

const relationshipKey = ({ resource }: TAuthzedRelationship): string =>
  `${resource.objectType}:${resource.objectId}`;

const observeGrant = async (grantId: string): Promise<ReadonlyArray<TAuthzedRelationship>> => {
  const client = getAuthzedClient();
  const subject = { objectId: grantId, objectType: MCP_GRANT_SUBJECT_TYPE };
  const [organizations, workspaces] = await Promise.all(
    (["organization", "workspace"] as const).map((resourceType) =>
      readAllRelationships(client, { relation: MCP_GRANT_RELATION, resourceType, subject })
    )
  );
  return [...organizations.relationships, ...workspaces.relationships];
};

const observeGrants = async (
  grantIds: ReadonlyArray<string>
): Promise<ReadonlyMap<string, ReadonlyArray<TAuthzedRelationship>>> => {
  const observed = new Map<string, ReadonlyArray<TAuthzedRelationship>>();
  for (let start = 0; start < grantIds.length; start += AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES) {
    const page = grantIds.slice(start, start + AUTHZED_MAX_PARALLEL_RELATIONSHIP_DELETES);
    const results = await Promise.all(page.map(observeGrant));
    page.forEach((grantId, index) => observed.set(grantId, results[index]));
  }
  return observed;
};

const writeSnapshot = async (grantIds: ReadonlyArray<string>, snapshot: TGrantSnapshot): Promise<void> => {
  const expectedByGrant = new Map(snapshot.map((grant) => [grant.id, expectedMcpGrantRelationships(grant)]));
  const observedByGrant = await observeGrants(grantIds);

  const groups: TAuthzedRelationshipUpdate[][] = [];
  for (const grantId of grantIds) {
    const expected = expectedByGrant.get(grantId) ?? [];
    const expectedKeys = new Set(expected.map(relationshipKey));
    const stale = (observedByGrant.get(grantId) ?? []).filter(
      (relationship) => !expectedKeys.has(relationshipKey(relationship))
    );
    for (const relationship of expected) groups.push([{ operation: "touch", relationship }]);
    for (const relationship of stale) groups.push([{ operation: "delete", relationship }]);
  }

  const client = getAuthzedClient();
  for (const batch of packRelationshipUpdateGroups(groups)) {
    await client.writeRelationships(batch);
  }
};

const snapshotsMatch = (left: TGrantSnapshot, right: TGrantSnapshot): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const reconcileMcpGrantRelationships = async (
  targets: TMcpGrantProjectionTargets
): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("reconcile_mcp_grant_relationships", "mcp_grant", async () => {
    const grantIds = [...new Set(targets.grantIds ?? [])].sort((left, right) => left.localeCompare(right));
    if (grantIds.length === 0) return 0;

    for (let pass = 1; pass <= AUTHZED_MAX_RECONCILIATION_PASSES; pass++) {
      const outcome = await prisma.$transaction(
        async (tx) => {
          const sourceSnapshot = await readSnapshot(tx, grantIds);
          try {
            await writeSnapshot(grantIds, sourceSnapshot);
          } catch (error) {
            // The previous release's schema has no `mcp_grant`. Nothing can be projected yet, and nothing
            // needs removing: `mcp_reach` is missing too, so a grant that selects reaches nothing (denied,
            // never widened). Carry on rather than dead-letter the event; applying the schema runs the
            // backfill, which projects every selection.
            if (!isRelationMissingFromSchema(error, MCP_GRANT_RELATION)) throw error;
            logger.warn(
              { relation: MCP_GRANT_RELATION, grants: grantIds.length },
              "AuthZed schema predates MCP grants; apply the release's schema to project their selections"
            );
            return "settled";
          }
          // The row locks fence every save, but not a cascade: deleting a selected workspace or
          // organization drops its selection row without touching the grant's. Re-read before settling.
          return snapshotsMatch(sourceSnapshot, await readSnapshot(tx, grantIds)) ? "settled" : "moved";
        },
        {
          maxWait: MCP_GRANT_PROJECTION_TRANSACTION_MAX_WAIT_MS,
          timeout: MCP_GRANT_PROJECTION_TRANSACTION_TIMEOUT_MS,
        }
      );
      if (outcome === "settled") return pass;
    }

    throw new AuthzedProjectionUnstableError();
  });

/**
 * Deletes, now, the relationships a grant being narrowed loses: those `before` implies and `after` doesn't
 * (ENG-7153). Only for narrowing a grant that stays (consent re-approval, Authorized apps' Edit), inside
 * the transaction that holds the grant's row `FOR UPDATE`, before it commits: the narrowing then applies
 * in SpiceDB first or not at all, and a failure throws, which rolls the change back and fails the request
 * rather than leaving the client its old access until the outbox delivers. Additions are never made here:
 * they go after the commit, best-effort (`projectMcpGrants`), with the outbox as the repair, so a widening
 * never shows before it is saved. A deleted grant needs none of this: `/api/mcp` refuses a connection
 * without a grant row, so {@link removeDeletedMcpGrantRelationships} cleans up after the commit.
 *
 * Nothing to do for a grant whose access is All access before (it holds no relationships), or with AuthZed
 * off. On the previous release's schema, which has no `mcp_grant` relation, nothing was ever projected.
 * Should the transaction then fail to commit, the grant reaches less than its rows say until it is next
 * reconciled: the safe direction.
 */
export const deleteMcpGrantRelationshipsBeforeCommit = async (
  before: TProjectedMcpGrant,
  after: TMcpGrantAccessSelection
): Promise<void> => {
  if (!isAuthzedEnabled()) return;
  const kept = new Set(expectedMcpGrantRelationships({ ...after, id: before.id }).map(relationshipKey));
  await deleteRelationships(
    expectedMcpGrantRelationships(before).filter((relationship) => !kept.has(relationshipKey(relationship)))
  );
};

const deleteRelationships = async (relationships: ReadonlyArray<TAuthzedRelationship>): Promise<void> => {
  if (relationships.length === 0) return;
  const client = getAuthzedClient();
  try {
    for (const batch of packRelationshipUpdateGroups(
      relationships.map((relationship) => [{ operation: "delete", relationship }])
    )) {
      await client.writeRelationships(batch);
    }
  } catch (error) {
    if (isRelationMissingFromSchema(error, MCP_GRANT_RELATION)) return;
    throw error;
  }
};

/**
 * Removes the relationships of grants whose rows a committed transaction deleted (revoke, member removal,
 * the switch to Dashboard viewer, the retention sweep, SSO recovery). Call it after the commit: the deleted
 * row already ends the client's access (`/api/mcp` answers 401 without a grant), so this is hygiene, and
 * best-effort. The delete's outbox event (the grant row's trigger for a grant that selected, and its
 * selection rows' cascade) is the repair. Never throws: failures come back as `{ status: "failed" }`.
 */
export const removeDeletedMcpGrantRelationships = (
  grants: ReadonlyArray<TProjectedMcpGrant>
): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("remove_deleted_mcp_grant_relationships", "mcp_grant", async () => {
    await deleteRelationships(grants.flatMap(expectedMcpGrantRelationships));
    return 1;
  });
