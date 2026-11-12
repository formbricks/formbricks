import "server-only";
import { prisma } from "@formbricks/database";
import type { McpGrantAccess } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { isRelationMissingFromSchema } from "@/lib/authorization/schema-drift";
import { type TAuthzedRelationship, type TAuthzedRelationshipUpdate, getAuthzedClient } from "./client";
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

type TGrantSnapshot = ReadonlyArray<
  Readonly<{
    access: McpGrantAccess;
    id: string;
    organizationIds: ReadonlyArray<string>;
    workspaceIds: ReadonlyArray<string>;
  }>
>;

const readSnapshot = async (grantIds: ReadonlyArray<string>): Promise<TGrantSnapshot> => {
  const grants = await prisma.mcpGrant.findMany({
    where: { id: { in: [...grantIds] } },
    select: {
      id: true,
      access: true,
      organizations: { select: { organizationId: true }, orderBy: { organizationId: "asc" } },
      workspaces: { select: { workspaceId: true }, orderBy: { workspaceId: "asc" } },
    },
    orderBy: { id: "asc" },
  });
  return grants.map((grant) => ({
    access: grant.access,
    id: grant.id,
    organizationIds: grant.organizations.map(({ organizationId }) => organizationId),
    workspaceIds: grant.workspaces.map(({ workspaceId }) => workspaceId),
  }));
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
 * The relationships a grant's rows imply. Only the selection that matches the grant's mode counts: a row
 * left behind by a mode change (which the save path never leaves) grants nothing.
 */
export const expectedMcpGrantRelationships = (
  grant: TGrantSnapshot[number]
): ReadonlyArray<TAuthzedRelationship> => {
  switch (grant.access) {
    case "organizations":
      return grant.organizationIds.map((id) => relationshipTo("organization", id, grant.id));
    case "workspaces":
      return grant.workspaceIds.map((id) => relationshipTo("workspace", id, grant.id));
    case "all":
      return [];
  }
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
      const sourceSnapshot = await readSnapshot(grantIds);
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
        return pass;
      }
      if (snapshotsMatch(sourceSnapshot, await readSnapshot(grantIds))) return pass;
    }

    throw new AuthzedProjectionUnstableError();
  });
