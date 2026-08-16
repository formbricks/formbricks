import "server-only";
import { prisma } from "@formbricks/database";
import type { TAuthzedParentEdge, TAuthzedSourceRef } from "./backfill-diff";
import type { TAuthzedRelationship } from "./client";
import { AUTHZED_BACKFILL_ORGANIZATION_PAGE_SIZE, AUTHZED_BACKFILL_TARGET_CHUNK_SIZE } from "./constants";
import { getFeedbackDirectoryAssignmentObjectId } from "./feedback-directory-assignment-id";
import {
  ORGANIZATION_ACCESS_RELATIONS,
  ORGANIZATION_RELATIONS,
  TEAM_RELATIONS,
  WORKSPACE_API_KEY_RELATIONS,
  WORKSPACE_TEAM_RELATIONS,
  normalizeOrganizationAccess,
} from "./relationship-map";

/**
 * PostgreSQL enumeration for relationship backfill and repair.
 *
 * **Command-line use only. No route, server action, background job, or request-path module may import
 * this file or anything that consumes it.** These reads are deliberately not tenant-scoped — sweeping
 * every organization is the entire point — and the tooling built on them performs no authorization
 * check of its own, because it runs as an operator with the AuthZed system credential. Reachable from
 * an HTTP surface it would let a caller rewrite any tenant's permission graph by ID.
 *
 * This is the only file in the backfill that touches `prisma`, which keeps "what does the tooling read
 * from the database?" a single-file audit. Every query names its columns explicitly and reads only
 * identifiers, roles, permissions, and API-key organization access — never plaintext keys, key hashes,
 * lookup hashes, creator metadata, or usage timestamps.
 *
 * **Errors are never caught here.** Absence is what marks a relationship stale, so a failed query must
 * not be mistaken for "no source row": that would classify live access as orphaned and, under pruning,
 * revoke it at scale. A failure propagates, the unit is reported failed, and the run continues.
 */

export type TAuthzedMembershipTarget = Readonly<{ organizationId: string; userId: string }>;
export type TAuthzedTeamMembershipTarget = Readonly<{ teamId: string; userId: string }>;
export type TAuthzedWorkspaceTeamTarget = Readonly<{ teamId: string; workspaceId: string }>;
export type TAuthzedApiKeyWorkspaceTarget = Readonly<{ apiKeyId: string; workspaceId: string }>;
export type TAuthzedFeedbackDirectoryAssignmentTarget = Readonly<{
  feedbackDirectoryId: string;
  workspaceId: string;
}>;

/**
 * Every authorization-relevant record owned by one organization.
 *
 * The organization is a closed unit: each of these models reaches `Organization` in one hop or two, so
 * a complete set of targets for one organization can be enumerated without consulting any other.
 */
export type TAuthzedOrganizationSource = Readonly<{
  apiKeyIds: ReadonlyArray<string>;
  apiKeyWorkspaceGrants: ReadonlyArray<TAuthzedApiKeyWorkspaceTarget>;
  /** Exact managed relationship set derived from the same maps as the projectors. */
  expectedRelationships: ReadonlyArray<TAuthzedRelationship>;
  /** All valid pairs to observe/reconcile; archived pairs are targets but contribute no expected edges. */
  feedbackDirectoryAssignments: ReadonlyArray<TAuthzedFeedbackDirectoryAssignmentTarget>;
  feedbackDirectoryIds: ReadonlyArray<string>;
  /**
   * API-key workspace grants whose key and workspace belong to different organizations.
   *
   * Same treatment as `invalidWorkspaceTeamGrants`: reported, never projected, never pruned.
   */
  invalidApiKeyWorkspaceGrants: ReadonlyArray<TAuthzedApiKeyWorkspaceTarget>;
  invalidFeedbackDirectoryAssignments: ReadonlyArray<TAuthzedFeedbackDirectoryAssignmentTarget>;
  /**
   * Workspace-team grants whose team and workspace belong to different organizations.
   *
   * Formbricks never creates one, and it would break the closed-unit invariant, so these are reported
   * and then left strictly alone — neither projected nor pruned.
   */
  invalidWorkspaceTeamGrants: ReadonlyArray<TAuthzedWorkspaceTeamTarget>;
  memberships: ReadonlyArray<TAuthzedMembershipTarget>;
  teamIds: ReadonlyArray<string>;
  teamMemberships: ReadonlyArray<TAuthzedTeamMembershipTarget>;
  workspaceIds: ReadonlyArray<string>;
  workspaceTeamGrants: ReadonlyArray<TAuthzedWorkspaceTeamTarget>;
}>;

/** The grants attached to one workspace, for the narrower workspace repair scope. */
export type TAuthzedWorkspaceSource = Readonly<{
  apiKeyWorkspaceGrants: ReadonlyArray<TAuthzedApiKeyWorkspaceTarget>;
  /** Exact managed relationship set for this workspace and its valid grants. */
  expectedRelationships: ReadonlyArray<TAuthzedRelationship>;
  /** All valid pairs to observe/reconcile; archived pairs are targets but contribute no expected edges. */
  feedbackDirectoryAssignments: ReadonlyArray<TAuthzedFeedbackDirectoryAssignmentTarget>;
  /**
   * Grants whose principal belongs to a different organization than the workspace.
   *
   * The join tables carry independent foreign keys and no same-organization constraint, so a
   * cross-tenant row is representable. The organization scope already partitions these out; this scope
   * has to as well, or `--workspace-id` would *write* a cross-tenant grant that `--organization-id`
   * refuses to write. Reported, never projected, never pruned.
   */
  invalidApiKeyWorkspaceGrants: ReadonlyArray<TAuthzedApiKeyWorkspaceTarget>;
  invalidFeedbackDirectoryAssignments: ReadonlyArray<TAuthzedFeedbackDirectoryAssignmentTarget>;
  invalidWorkspaceTeamGrants: ReadonlyArray<TAuthzedWorkspaceTeamTarget>;
  /**
   * The owning organization, or `null` when the workspace has no row.
   *
   * Read so a failure in this scope can be attributed to a tenant. Without it every workspace-scoped
   * failure reports the empty string, which is also the sweep's marker for a genuinely unattributable
   * orphan — leaving the two indistinguishable in the output.
   */
  organizationId: string | null;
  /** Reported rather than enforced: a missing workspace is a valid repair target, not an error. */
  workspaceExists: boolean;
  workspaceTeamGrants: ReadonlyArray<TAuthzedWorkspaceTeamTarget>;
}>;

type TOrganizationWorkspaceTeamGrant = Readonly<{
  permission: keyof typeof WORKSPACE_TEAM_RELATIONS;
  team: Readonly<{ organizationId: string }>;
  teamId: string;
  workspaceId: string;
}>;

type TOrganizationApiKeyWorkspaceGrant = Readonly<{
  apiKeyId: string;
  permission: keyof typeof WORKSPACE_API_KEY_RELATIONS;
  workspace: Readonly<{ organizationId: string }>;
  workspaceId: string;
}>;

type TOrganizationFeedbackDirectory = Readonly<{
  id: string;
  isArchived: boolean;
  organizationId: string;
  workspaces: ReadonlyArray<
    Readonly<{ workspace: Readonly<{ organizationId: string }>; workspaceId: string }>
  >;
}>;
const partitionByOrganization = <TGrant>(
  grants: ReadonlyArray<TGrant>,
  organizationId: string | null,
  getOrganizationId: (grant: TGrant) => string
): Readonly<{ invalid: TGrant[]; valid: TGrant[] }> => {
  if (organizationId === null) {
    return { invalid: [], valid: [...grants] };
  }

  const valid: TGrant[] = [];
  const invalid: TGrant[] = [];
  for (const grant of grants) {
    (getOrganizationId(grant) === organizationId ? valid : invalid).push(grant);
  }

  return { invalid, valid };
};

const toWorkspaceTeamTarget = ({
  teamId,
  workspaceId,
}: Pick<TOrganizationWorkspaceTeamGrant, "teamId" | "workspaceId">): TAuthzedWorkspaceTeamTarget => ({
  teamId,
  workspaceId,
});

const toApiKeyWorkspaceTarget = ({
  apiKeyId,
  workspaceId,
}: Pick<TOrganizationApiKeyWorkspaceGrant, "apiKeyId" | "workspaceId">): TAuthzedApiKeyWorkspaceTarget => ({
  apiKeyId,
  workspaceId,
});

const getApiKeyRelationships = (
  apiKey: Readonly<{ id: string; organizationAccess: unknown; organizationId: string }>
): ReadonlyArray<TAuthzedRelationship> => {
  const relationships: TAuthzedRelationship[] = [
    {
      relation: "organization",
      resource: { objectId: apiKey.id, objectType: "api_key" },
      subject: { objectId: apiKey.organizationId, objectType: "organization" },
    },
  ];
  const access = normalizeOrganizationAccess(apiKey.organizationAccess);
  for (const permission of Object.keys(ORGANIZATION_ACCESS_RELATIONS) as ReadonlyArray<
    keyof typeof ORGANIZATION_ACCESS_RELATIONS
  >) {
    if (access[permission]) {
      relationships.push({
        relation: ORGANIZATION_ACCESS_RELATIONS[permission],
        resource: { objectId: apiKey.organizationId, objectType: "organization" },
        subject: { objectId: apiKey.id, objectType: "api_key" },
      });
    }
  }

  return relationships;
};

const getFeedbackDirectorySource = (
  directories: ReadonlyArray<TOrganizationFeedbackDirectory>,
  organizationId: string
): Readonly<{
  assignments: TAuthzedFeedbackDirectoryAssignmentTarget[];
  invalidAssignments: TAuthzedFeedbackDirectoryAssignmentTarget[];
  relationships: TAuthzedRelationship[];
}> => {
  const assignments: TAuthzedFeedbackDirectoryAssignmentTarget[] = [];
  const invalidAssignments: TAuthzedFeedbackDirectoryAssignmentTarget[] = [];
  const relationships: TAuthzedRelationship[] = [];

  for (const directory of directories) {
    relationships.push({
      relation: "organization",
      resource: { objectId: directory.id, objectType: "feedback_directory" },
      subject: { objectId: directory.organizationId, objectType: "organization" },
    });
    for (const workspace of directory.workspaces) {
      const target = { feedbackDirectoryId: directory.id, workspaceId: workspace.workspaceId };
      if (workspace.workspace.organizationId !== organizationId) {
        invalidAssignments.push(target);
        continue;
      }

      assignments.push(target);
      if (directory.isArchived) {
        continue;
      }

      const assignmentId = getFeedbackDirectoryAssignmentObjectId(directory.id, workspace.workspaceId);
      relationships.push(
        {
          relation: "assignment",
          resource: { objectId: directory.id, objectType: "feedback_directory" },
          subject: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
        },
        {
          relation: "directory",
          resource: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
          subject: { objectId: directory.id, objectType: "feedback_directory" },
        },
        {
          relation: "workspace",
          resource: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
          subject: { objectId: workspace.workspaceId, objectType: "workspace" },
        }
      );
    }
  }

  return { assignments, invalidAssignments, relationships };
};
/**
 * One keyset page of organization IDs.
 *
 * Keyset rather than offset so the sweep is stable while organizations are created and deleted, and so
 * an interrupted run resumes from the last ID it reported instead of restarting.
 */
export const readOrganizationIdPage = async (
  page: Readonly<{ afterOrganizationId?: string; limit?: number }> = {}
): Promise<ReadonlyArray<string>> => {
  const organizations = await prisma.organization.findMany({
    where: page.afterOrganizationId ? { id: { gt: page.afterOrganizationId } } : undefined,
    select: { id: true },
    orderBy: { id: "asc" },
    take: page.limit ?? AUTHZED_BACKFILL_ORGANIZATION_PAGE_SIZE,
  });

  return organizations.map(({ id }) => id);
};

export const organizationExists = async (organizationId: string): Promise<boolean> =>
  (await prisma.organization.count({ where: { id: organizationId } })) > 0;

/**
 * Enumerate the authorization-relevant records attached to one workspace.
 *
 * A narrower unit than the organization, for repairing a single workspace's grants without touching the
 * rest of the tenant.
 *
 * Deliberately does **not** require the workspace to exist. A workspace whose row is already gone is
 * the case most worth repairing — its relationships are exactly what should be removed — and an
 * organization ID is not needed to reach them, because the caller supplies the workspace ID directly.
 */
export const readWorkspaceSource = async (workspaceId: string): Promise<TAuthzedWorkspaceSource> => {
  const [workspace, workspaceTeams, apiKeyWorkspaces, directoryAssignments] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { organizationId: true } }),
    prisma.workspaceTeam.findMany({
      where: { workspaceId },
      // The principal's organization is read so a cross-organization grant can be partitioned out
      // rather than projected, matching what the organization scope already does.
      select: {
        permission: true,
        team: { select: { organizationId: true } },
        teamId: true,
        workspaceId: true,
      },
      orderBy: { teamId: "asc" },
    }),
    prisma.apiKeyWorkspace.findMany({
      where: { workspaceId },
      select: {
        apiKey: { select: { organizationId: true } },
        apiKeyId: true,
        permission: true,
        workspaceId: true,
      },
      orderBy: { apiKeyId: "asc" },
    }),
    prisma.feedbackDirectoryWorkspace.findMany({
      where: { workspaceId },
      select: {
        feedbackDirectory: { select: { isArchived: true, organizationId: true } },
        feedbackDirectoryId: true,
        workspaceId: true,
      },
      orderBy: { feedbackDirectoryId: "asc" },
    }),
  ]);

  const organizationId = workspace?.organizationId ?? null;

  // Only decidable when the workspace still has a row. With no row there is no organization to compare
  // against, and its grants are stale by construction — the prune path is what deals with them.
  const teamGrants = partitionByOrganization(
    workspaceTeams,
    organizationId,
    (grant) => grant.team.organizationId
  );
  const keyGrants = partitionByOrganization(
    apiKeyWorkspaces,
    organizationId,
    (grant) => grant.apiKey.organizationId
  );
  const directoryGrants = partitionByOrganization(
    directoryAssignments,
    organizationId,
    (grant) => grant.feedbackDirectory.organizationId
  );

  const expectedRelationships: TAuthzedRelationship[] = [];
  if (organizationId !== null) {
    expectedRelationships.push({
      relation: "organization",
      resource: { objectId: workspaceId, objectType: "workspace" },
      subject: { objectId: organizationId, objectType: "organization" },
    });
  }
  for (const grant of teamGrants.valid) {
    expectedRelationships.push({
      relation: WORKSPACE_TEAM_RELATIONS[grant.permission],
      resource: { objectId: workspaceId, objectType: "workspace" },
      subject: { objectId: grant.teamId, objectType: "team", relation: "member" },
    });
  }
  for (const grant of keyGrants.valid) {
    expectedRelationships.push({
      relation: WORKSPACE_API_KEY_RELATIONS[grant.permission],
      resource: { objectId: workspaceId, objectType: "workspace" },
      subject: { objectId: grant.apiKeyId, objectType: "api_key" },
    });
  }
  const feedbackDirectoryAssignments = directoryGrants.valid.map(({ feedbackDirectoryId }) => ({
    feedbackDirectoryId,
    workspaceId,
  }));
  for (const grant of directoryGrants.valid) {
    if (grant.feedbackDirectory.isArchived) {
      continue;
    }
    const assignment = { feedbackDirectoryId: grant.feedbackDirectoryId, workspaceId };
    const assignmentId = getFeedbackDirectoryAssignmentObjectId(
      assignment.feedbackDirectoryId,
      assignment.workspaceId
    );
    expectedRelationships.push(
      {
        relation: "assignment",
        resource: { objectId: assignment.feedbackDirectoryId, objectType: "feedback_directory" },
        subject: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
      },
      {
        relation: "directory",
        resource: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
        subject: { objectId: assignment.feedbackDirectoryId, objectType: "feedback_directory" },
      },
      {
        relation: "workspace",
        resource: { objectId: assignmentId, objectType: "feedback_directory_assignment" },
        subject: { objectId: assignment.workspaceId, objectType: "workspace" },
      }
    );
  }

  return {
    apiKeyWorkspaceGrants: keyGrants.valid.map(toApiKeyWorkspaceTarget),
    expectedRelationships,
    feedbackDirectoryAssignments,
    invalidApiKeyWorkspaceGrants: keyGrants.invalid.map(toApiKeyWorkspaceTarget),
    invalidFeedbackDirectoryAssignments: directoryGrants.invalid.map(({ feedbackDirectoryId }) => ({
      feedbackDirectoryId,
      workspaceId,
    })),
    invalidWorkspaceTeamGrants: teamGrants.invalid.map(toWorkspaceTeamTarget),
    organizationId,
    // Truthiness rather than `!== null`, so a row is required to claim existence rather than merely the
    // absence of one particular falsy value.
    workspaceExists: Boolean(workspace),
    workspaceTeamGrants: teamGrants.valid.map(toWorkspaceTeamTarget),
  };
};

/** Enumerate every authorization-relevant record owned by one organization. */
export const readOrganizationSource = async (organizationId: string): Promise<TAuthzedOrganizationSource> => {
  const [
    memberships,
    teams,
    workspaces,
    apiKeys,
    teamMemberships,
    workspaceTeams,
    apiKeyWorkspaces,
    feedbackDirectories,
  ] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId },
      select: { role: true, userId: true },
      orderBy: { userId: "asc" },
    }),
    prisma.team.findMany({
      where: { organizationId },
      select: { id: true, organizationId: true },
      orderBy: { id: "asc" },
    }),
    prisma.workspace.findMany({
      where: { organizationId },
      select: { id: true, organizationId: true },
      orderBy: { id: "asc" },
    }),
    prisma.apiKey.findMany({
      where: { organizationId },
      select: { id: true, organizationAccess: true, organizationId: true },
      orderBy: { id: "asc" },
    }),
    prisma.teamUser.findMany({
      where: { team: { organizationId } },
      select: { role: true, teamId: true, userId: true },
      orderBy: [{ teamId: "asc" }, { userId: "asc" }],
    }),
    prisma.workspaceTeam.findMany({
      where: { workspace: { organizationId } },
      // The team's organization is read so a cross-organization grant can be detected rather than
      // silently projected as if the unit were closed.
      select: {
        permission: true,
        team: { select: { organizationId: true } },
        teamId: true,
        workspaceId: true,
      },
      orderBy: [{ workspaceId: "asc" }, { teamId: "asc" }],
    }),
    prisma.apiKeyWorkspace.findMany({
      where: { apiKey: { organizationId } },
      // Keyed off the *key's* organization, so the workspace's is read to detect a grant that crosses
      // organizations — the same check `workspaceTeam` above performs, and for the same reason.
      select: {
        apiKeyId: true,
        permission: true,
        workspace: { select: { organizationId: true } },
        workspaceId: true,
      },
      orderBy: [{ apiKeyId: "asc" }, { workspaceId: "asc" }],
    }),
    prisma.feedbackDirectory.findMany({
      where: { organizationId },
      select: {
        id: true,
        isArchived: true,
        organizationId: true,
        workspaces: {
          select: { workspace: { select: { organizationId: true } }, workspaceId: true },
          orderBy: { workspaceId: "asc" },
        },
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const teamGrants = partitionByOrganization(
    workspaceTeams,
    organizationId,
    (grant) => grant.team.organizationId
  );
  // A grant whose workspace belongs to another organization is unreachable from this one: the
  // observation only reads workspaces this organization owns, so an expected relationship naming a
  // foreign workspace could never be seen and the unit would report drift that no run can converge.
  // Excluded from the targets for the same reason as the workspace-team case — never projected, never
  // pruned, only reported.
  const keyGrants = partitionByOrganization(
    apiKeyWorkspaces,
    organizationId,
    (grant) => grant.workspace.organizationId
  );
  const directorySource = getFeedbackDirectorySource(feedbackDirectories, organizationId);

  const expectedRelationships: TAuthzedRelationship[] = [
    ...memberships.map(({ role, userId }) => ({
      relation: ORGANIZATION_RELATIONS[role],
      resource: { objectId: organizationId, objectType: "organization" },
      subject: { objectId: userId, objectType: "user" },
    })),
    ...teams.map(({ id, organizationId: teamOrganizationId }) => ({
      relation: "organization",
      resource: { objectId: id, objectType: "team" },
      subject: { objectId: teamOrganizationId, objectType: "organization" },
    })),
    ...teamMemberships.map(({ role, teamId, userId }) => ({
      relation: TEAM_RELATIONS[role],
      resource: { objectId: teamId, objectType: "team" },
      subject: { objectId: userId, objectType: "user" },
    })),
    ...workspaces.map(({ id, organizationId: workspaceOrganizationId }) => ({
      relation: "organization",
      resource: { objectId: id, objectType: "workspace" },
      subject: { objectId: workspaceOrganizationId, objectType: "organization" },
    })),
    ...teamGrants.valid.map(({ permission, teamId, workspaceId }) => ({
      relation: WORKSPACE_TEAM_RELATIONS[permission],
      resource: { objectId: workspaceId, objectType: "workspace" },
      subject: { objectId: teamId, objectType: "team", relation: "member" },
    })),
    ...apiKeys.flatMap(getApiKeyRelationships),
    ...keyGrants.valid.map(({ apiKeyId, permission, workspaceId }) => ({
      relation: WORKSPACE_API_KEY_RELATIONS[permission],
      resource: { objectId: workspaceId, objectType: "workspace" },
      subject: { objectId: apiKeyId, objectType: "api_key" },
    })),
    ...directorySource.relationships,
  ];

  return {
    apiKeyIds: apiKeys.map(({ id }) => id),
    apiKeyWorkspaceGrants: keyGrants.valid.map(toApiKeyWorkspaceTarget),
    expectedRelationships,
    feedbackDirectoryAssignments: directorySource.assignments,
    feedbackDirectoryIds: feedbackDirectories.map(({ id }) => id),
    invalidApiKeyWorkspaceGrants: keyGrants.invalid.map(toApiKeyWorkspaceTarget),
    invalidFeedbackDirectoryAssignments: directorySource.invalidAssignments,
    invalidWorkspaceTeamGrants: teamGrants.invalid.map(toWorkspaceTeamTarget),
    memberships: memberships.map(({ userId }) => ({ organizationId, userId })),
    teamIds: teams.map(({ id }) => id),
    teamMemberships: teamMemberships.map(({ teamId, userId }) => ({ teamId, userId })),
    workspaceIds: workspaces.map(({ id }) => id),
    workspaceTeamGrants: teamGrants.valid.map(toWorkspaceTeamTarget),
  };
};

/**
 * Run a reader over one chunk at a time, concatenating the results.
 *
 * Both readers below build a `where: { OR: [...] }` from their input, which is unbounded by
 * construction — so both need the same chunking, and it lives here once rather than being re-derived
 * per reader. Sequential rather than parallel: these run inside a sweep that already bounds its own
 * concurrency, and a fan-out here would multiply it.
 */
const inChunks = async <TItem>(
  items: ReadonlyArray<TItem>,
  read: (chunk: ReadonlyArray<TItem>) => Promise<ReadonlyArray<TItem>>
): Promise<ReadonlyArray<TItem>> => {
  const collected: TItem[] = [];
  for (let start = 0; start < items.length; start += AUTHZED_BACKFILL_TARGET_CHUNK_SIZE) {
    collected.push(...(await read(items.slice(start, start + AUTHZED_BACKFILL_TARGET_CHUNK_SIZE))));
  }

  return collected;
};

/**
 * Of the observed parent edges, report those PostgreSQL contradicts.
 *
 * An edge is only correct when the resource exists *and* belongs to the organization the edge names. An
 * existence check alone cannot tell the difference, which is why this is separate — and it is the check
 * that catches a cross-tenant parent edge, where a resource is additionally attached to an organization
 * that does not own it and every owner and manager of that organization silently gains access.
 *
 * Errors propagate, for the same reason as everywhere else in this module: a failed lookup must never be
 * read as "PostgreSQL disagrees".
 */
export const findMismatchedParentEdges = async (
  edges: ReadonlyArray<TAuthzedParentEdge>
): Promise<ReadonlyArray<TAuthzedParentEdge>> => {
  if (edges.length > AUTHZED_BACKFILL_TARGET_CHUNK_SIZE) {
    return inChunks(edges, findMismatchedParentEdges);
  }

  const idsFor = (childType: TAuthzedParentEdge["childType"]): ReadonlyArray<string> => [
    ...new Set(edges.filter((edge) => edge.childType === childType).map((edge) => edge.childId)),
  ];
  const teamIds = idsFor("team");
  const workspaceIds = idsFor("workspace");
  const apiKeyIds = idsFor("api_key");
  const feedbackDirectoryIds = idsFor("feedback_directory");

  const [teams, workspaces, apiKeys, feedbackDirectories] = await Promise.all([
    teamIds.length === 0
      ? []
      : prisma.team.findMany({
          where: { id: { in: [...teamIds] } },
          select: { id: true, organizationId: true },
        }),
    workspaceIds.length === 0
      ? []
      : prisma.workspace.findMany({
          where: { id: { in: [...workspaceIds] } },
          select: { id: true, organizationId: true },
        }),
    apiKeyIds.length === 0
      ? []
      : prisma.apiKey.findMany({
          where: { id: { in: [...apiKeyIds] } },
          select: { id: true, organizationId: true },
        }),
    feedbackDirectoryIds.length === 0
      ? []
      : prisma.feedbackDirectory.findMany({
          where: { id: { in: [...feedbackDirectoryIds] } },
          select: { id: true, organizationId: true },
        }),
  ]);

  const trueParents = new Map<string, string>([
    ...teams.map(({ id, organizationId }): [string, string] => [`team:${id}`, organizationId]),
    ...workspaces.map(({ id, organizationId }): [string, string] => [`workspace:${id}`, organizationId]),
    ...apiKeys.map(({ id, organizationId }): [string, string] => [`api_key:${id}`, organizationId]),
    ...feedbackDirectories.map(({ id, organizationId }): [string, string] => [
      `feedback_directory:${id}`,
      organizationId,
    ]),
  ]);

  // A resource with no row at all is not reported here — that is an orphan, handled by the existence
  // check, and it has a working repair path. This is only about a resource that exists under a different
  // organization than the edge claims.
  return edges.filter((edge) => {
    const trueParent = trueParents.get(`${edge.childType}:${edge.childId}`);
    return trueParent !== undefined && trueParent !== edge.organizationId;
  });
};

const byKind = <TKind extends TAuthzedSourceRef["kind"]>(
  refs: ReadonlyArray<TAuthzedSourceRef>,
  kind: TKind
): ReadonlyArray<Extract<TAuthzedSourceRef, { kind: TKind }>> =>
  refs.filter((ref): ref is Extract<TAuthzedSourceRef, { kind: TKind }> => ref.kind === kind);

const pairKey = (first: string, second: string): string => `${first.length}:${first}${second}`;

/**
 * Of the supplied source records, report those PostgreSQL does not hold.
 *
 * One batched query per record kind, so the cost is bounded by the number of kinds rather than by the
 * number of records. A query failure propagates untouched — see the note on this module: treating a
 * failure as absence is the one mistake that turns this tooling destructive.
 */
export const findMissingSourceRefs = async (
  refs: ReadonlyArray<TAuthzedSourceRef>
): Promise<ReadonlyArray<TAuthzedSourceRef>> => {
  // Chunked for the same reason reconciler targets are: the composite-key kinds contribute two bind
  // parameters per record, so an unchunked list would approach PostgreSQL's parameter ceiling and give
  // the planner an `OR` list it cannot use an index for. One query per kind *per chunk* still keeps the
  // cost proportional to the number of kinds rather than the number of records.
  if (refs.length > AUTHZED_BACKFILL_TARGET_CHUNK_SIZE) {
    return inChunks(refs, findMissingSourceRefs);
  }

  const apiKeyRefs = byKind(refs, "apiKey");
  const membershipRefs = byKind(refs, "membership");
  const teamRefs = byKind(refs, "team");
  const teamMembershipRefs = byKind(refs, "teamMembership");
  const workspaceRefs = byKind(refs, "workspace");
  const workspaceTeamGrantRefs = byKind(refs, "workspaceTeamGrant");
  const apiKeyWorkspaceGrantRefs = byKind(refs, "apiKeyWorkspaceGrant");
  const feedbackDirectoryRefs = byKind(refs, "feedbackDirectory");
  const feedbackDirectoryAssignmentRefs = byKind(refs, "feedbackDirectoryAssignment");

  const [
    apiKeys,
    memberships,
    teams,
    teamMemberships,
    workspaces,
    workspaceTeams,
    apiKeyWorkspaces,
    feedbackDirectories,
    feedbackDirectoryAssignments,
  ] = await Promise.all([
    apiKeyRefs.length === 0
      ? []
      : prisma.apiKey.findMany({
          where: { id: { in: apiKeyRefs.map(({ apiKeyId }) => apiKeyId) } },
          select: { id: true },
        }),
    membershipRefs.length === 0
      ? []
      : prisma.membership.findMany({
          where: {
            OR: membershipRefs.map(({ organizationId, userId }) => ({ organizationId, userId })),
          },
          select: { organizationId: true, userId: true },
        }),
    teamRefs.length === 0
      ? []
      : prisma.team.findMany({
          where: { id: { in: teamRefs.map(({ teamId }) => teamId) } },
          select: { id: true },
        }),
    teamMembershipRefs.length === 0
      ? []
      : prisma.teamUser.findMany({
          where: { OR: teamMembershipRefs.map(({ teamId, userId }) => ({ teamId, userId })) },
          select: { teamId: true, userId: true },
        }),
    workspaceRefs.length === 0
      ? []
      : prisma.workspace.findMany({
          where: { id: { in: workspaceRefs.map(({ workspaceId }) => workspaceId) } },
          select: { id: true },
        }),
    workspaceTeamGrantRefs.length === 0
      ? []
      : prisma.workspaceTeam.findMany({
          where: {
            OR: workspaceTeamGrantRefs.map(({ teamId, workspaceId }) => ({ teamId, workspaceId })),
          },
          select: { teamId: true, workspaceId: true },
        }),
    apiKeyWorkspaceGrantRefs.length === 0
      ? []
      : prisma.apiKeyWorkspace.findMany({
          where: {
            OR: apiKeyWorkspaceGrantRefs.map(({ apiKeyId, workspaceId }) => ({ apiKeyId, workspaceId })),
          },
          select: { apiKeyId: true, workspaceId: true },
        }),
    feedbackDirectoryRefs.length === 0
      ? []
      : prisma.feedbackDirectory.findMany({
          where: { id: { in: feedbackDirectoryRefs.map(({ feedbackDirectoryId }) => feedbackDirectoryId) } },
          select: { id: true },
        }),
    feedbackDirectoryAssignmentRefs.length === 0
      ? []
      : prisma.feedbackDirectoryWorkspace.findMany({
          where: {
            feedbackDirectory: { isArchived: false },
            OR: feedbackDirectoryAssignmentRefs.flatMap(({ feedbackDirectoryId, workspaceId }) => [
              ...(feedbackDirectoryId === undefined ? [] : [{ feedbackDirectoryId }]),
              ...(workspaceId === undefined ? [] : [{ workspaceId }]),
            ]),
          },
          select: { feedbackDirectoryId: true, workspaceId: true },
        }),
  ]);

  const existingApiKeyIds = new Set(apiKeys.map(({ id }) => id));
  const existingTeamIds = new Set(teams.map(({ id }) => id));
  const existingWorkspaceIds = new Set(workspaces.map(({ id }) => id));
  const existingMemberships = new Set(
    memberships.map(({ organizationId, userId }) => pairKey(organizationId, userId))
  );
  const existingTeamMemberships = new Set(
    teamMemberships.map(({ teamId, userId }) => pairKey(teamId, userId))
  );
  const existingWorkspaceTeams = new Set(
    workspaceTeams.map(({ teamId, workspaceId }) => pairKey(workspaceId, teamId))
  );
  const existingApiKeyWorkspaces = new Set(
    apiKeyWorkspaces.map(({ apiKeyId, workspaceId }) => pairKey(apiKeyId, workspaceId))
  );
  const existingFeedbackDirectoryIds = new Set(feedbackDirectories.map(({ id }) => id));
  const existingFeedbackDirectoryAssignments = new Set(
    feedbackDirectoryAssignments.map(({ feedbackDirectoryId, workspaceId }) =>
      getFeedbackDirectoryAssignmentObjectId(feedbackDirectoryId, workspaceId)
    )
  );

  const isPresent = (ref: TAuthzedSourceRef): boolean => {
    switch (ref.kind) {
      case "apiKey":
        return existingApiKeyIds.has(ref.apiKeyId);
      case "apiKeyWorkspaceGrant":
        return existingApiKeyWorkspaces.has(pairKey(ref.apiKeyId, ref.workspaceId));
      case "feedbackDirectory":
        return existingFeedbackDirectoryIds.has(ref.feedbackDirectoryId);
      case "feedbackDirectoryAssignment":
        return existingFeedbackDirectoryAssignments.has(ref.assignmentId);
      case "membership":
        return existingMemberships.has(pairKey(ref.organizationId, ref.userId));
      case "team":
        return existingTeamIds.has(ref.teamId);
      case "teamMembership":
        return existingTeamMemberships.has(pairKey(ref.teamId, ref.userId));
      case "workspace":
        return existingWorkspaceIds.has(ref.workspaceId);
      case "workspaceTeamGrant":
        return existingWorkspaceTeams.has(pairKey(ref.workspaceId, ref.teamId));
    }
  };

  return refs.filter((ref) => !isPresent(ref));
};
