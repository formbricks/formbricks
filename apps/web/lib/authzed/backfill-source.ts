import "server-only";
import { prisma } from "@formbricks/database";
import type { TAuthzedParentEdge, TAuthzedSourceRef } from "./backfill-diff";
import { AUTHZED_BACKFILL_ORGANIZATION_PAGE_SIZE, AUTHZED_BACKFILL_TARGET_CHUNK_SIZE } from "./constants";

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

/**
 * Every authorization-relevant record owned by one organization.
 *
 * The organization is a closed unit: each of these models reaches `Organization` in one hop or two, so
 * a complete set of targets for one organization can be enumerated without consulting any other.
 */
export type TAuthzedOrganizationSource = Readonly<{
  apiKeyIds: ReadonlyArray<string>;
  apiKeyWorkspaceGrants: ReadonlyArray<TAuthzedApiKeyWorkspaceTarget>;
  /**
   * API-key workspace grants whose key and workspace belong to different organizations.
   *
   * Same treatment as `invalidWorkspaceTeamGrants`: reported, never projected, never pruned.
   */
  invalidApiKeyWorkspaceGrants: ReadonlyArray<TAuthzedApiKeyWorkspaceTarget>;
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
  const [workspace, workspaceTeams, apiKeyWorkspaces] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { organizationId: true } }),
    prisma.workspaceTeam.findMany({
      where: { workspaceId },
      select: { teamId: true, workspaceId: true },
      orderBy: { teamId: "asc" },
    }),
    prisma.apiKeyWorkspace.findMany({
      where: { workspaceId },
      select: { apiKeyId: true, workspaceId: true },
      orderBy: { apiKeyId: "asc" },
    }),
  ]);

  return {
    apiKeyWorkspaceGrants: apiKeyWorkspaces,
    organizationId: workspace?.organizationId ?? null,
    // Truthiness rather than `!== null`, so a row is required to claim existence rather than merely the
    // absence of one particular falsy value.
    workspaceExists: Boolean(workspace),
    workspaceTeamGrants: workspaceTeams,
  };
};

/** Enumerate every authorization-relevant record owned by one organization. */
export const readOrganizationSource = async (organizationId: string): Promise<TAuthzedOrganizationSource> => {
  const [memberships, teams, workspaces, apiKeys, teamMemberships, workspaceTeams, apiKeyWorkspaces] =
    await Promise.all([
      prisma.membership.findMany({
        where: { organizationId },
        select: { userId: true },
        orderBy: { userId: "asc" },
      }),
      prisma.team.findMany({
        where: { organizationId },
        select: { id: true },
        orderBy: { id: "asc" },
      }),
      prisma.workspace.findMany({
        where: { organizationId },
        select: { id: true },
        orderBy: { id: "asc" },
      }),
      prisma.apiKey.findMany({
        where: { organizationId },
        select: { id: true },
        orderBy: { id: "asc" },
      }),
      prisma.teamUser.findMany({
        where: { team: { organizationId } },
        select: { teamId: true, userId: true },
        orderBy: [{ teamId: "asc" }, { userId: "asc" }],
      }),
      prisma.workspaceTeam.findMany({
        where: { workspace: { organizationId } },
        // The team's organization is read so a cross-organization grant can be detected rather than
        // silently projected as if the unit were closed.
        select: { team: { select: { organizationId: true } }, teamId: true, workspaceId: true },
        orderBy: [{ workspaceId: "asc" }, { teamId: "asc" }],
      }),
      prisma.apiKeyWorkspace.findMany({
        where: { apiKey: { organizationId } },
        // Keyed off the *key's* organization, so the workspace's is read to detect a grant that crosses
        // organizations — the same check `workspaceTeam` above performs, and for the same reason.
        select: {
          apiKeyId: true,
          workspace: { select: { organizationId: true } },
          workspaceId: true,
        },
        orderBy: [{ apiKeyId: "asc" }, { workspaceId: "asc" }],
      }),
    ]);

  const workspaceTeamGrants: TAuthzedWorkspaceTeamTarget[] = [];
  const invalidWorkspaceTeamGrants: TAuthzedWorkspaceTeamTarget[] = [];
  for (const grant of workspaceTeams) {
    const target = { teamId: grant.teamId, workspaceId: grant.workspaceId };
    if (grant.team.organizationId === organizationId) {
      workspaceTeamGrants.push(target);
    } else {
      invalidWorkspaceTeamGrants.push(target);
    }
  }

  // A grant whose workspace belongs to another organization is unreachable from this one: the
  // observation only reads workspaces this organization owns, so an expected relationship naming a
  // foreign workspace could never be seen and the unit would report drift that no run can converge.
  // Excluded from the targets for the same reason as the workspace-team case — never projected, never
  // pruned, only reported.
  const apiKeyWorkspaceGrants: TAuthzedApiKeyWorkspaceTarget[] = [];
  const invalidApiKeyWorkspaceGrants: TAuthzedApiKeyWorkspaceTarget[] = [];
  for (const grant of apiKeyWorkspaces) {
    const target = { apiKeyId: grant.apiKeyId, workspaceId: grant.workspaceId };
    if (grant.workspace.organizationId === organizationId) {
      apiKeyWorkspaceGrants.push(target);
    } else {
      invalidApiKeyWorkspaceGrants.push(target);
    }
  }

  return {
    apiKeyIds: apiKeys.map(({ id }) => id),
    apiKeyWorkspaceGrants,
    invalidApiKeyWorkspaceGrants,
    invalidWorkspaceTeamGrants,
    memberships: memberships.map(({ userId }) => ({ organizationId, userId })),
    teamIds: teams.map(({ id }) => id),
    teamMemberships,
    workspaceIds: workspaces.map(({ id }) => id),
    workspaceTeamGrants,
  };
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
    const mismatched: TAuthzedParentEdge[] = [];
    for (let start = 0; start < edges.length; start += AUTHZED_BACKFILL_TARGET_CHUNK_SIZE) {
      mismatched.push(
        ...(await findMismatchedParentEdges(edges.slice(start, start + AUTHZED_BACKFILL_TARGET_CHUNK_SIZE)))
      );
    }
    return mismatched;
  }

  const idsFor = (childType: TAuthzedParentEdge["childType"]): ReadonlyArray<string> => [
    ...new Set(edges.filter((edge) => edge.childType === childType).map((edge) => edge.childId)),
  ];
  const teamIds = idsFor("team");
  const workspaceIds = idsFor("workspace");
  const apiKeyIds = idsFor("api_key");

  const [teams, workspaces, apiKeys] = await Promise.all([
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
  ]);

  const trueParents = new Map<string, string>([
    ...teams.map(({ id, organizationId }): [string, string] => [`team:${id}`, organizationId]),
    ...workspaces.map(({ id, organizationId }): [string, string] => [`workspace:${id}`, organizationId]),
    ...apiKeys.map(({ id, organizationId }): [string, string] => [`api_key:${id}`, organizationId]),
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
    const missing: TAuthzedSourceRef[] = [];
    for (let start = 0; start < refs.length; start += AUTHZED_BACKFILL_TARGET_CHUNK_SIZE) {
      missing.push(
        ...(await findMissingSourceRefs(refs.slice(start, start + AUTHZED_BACKFILL_TARGET_CHUNK_SIZE)))
      );
    }
    return missing;
  }

  const apiKeyRefs = byKind(refs, "apiKey");
  const membershipRefs = byKind(refs, "membership");
  const teamRefs = byKind(refs, "team");
  const teamMembershipRefs = byKind(refs, "teamMembership");
  const workspaceRefs = byKind(refs, "workspace");
  const workspaceTeamGrantRefs = byKind(refs, "workspaceTeamGrant");
  const apiKeyWorkspaceGrantRefs = byKind(refs, "apiKeyWorkspaceGrant");

  const [apiKeys, memberships, teams, teamMemberships, workspaces, workspaceTeams, apiKeyWorkspaces] =
    await Promise.all([
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

  const isPresent = (ref: TAuthzedSourceRef): boolean => {
    switch (ref.kind) {
      case "apiKey":
        return existingApiKeyIds.has(ref.apiKeyId);
      case "apiKeyWorkspaceGrant":
        return existingApiKeyWorkspaces.has(pairKey(ref.apiKeyId, ref.workspaceId));
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
