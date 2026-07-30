import "server-only";
import { prisma } from "@formbricks/database";
import type { TAuthzedSourceRef } from "./backfill-diff";
import { AUTHZED_BACKFILL_ORGANIZATION_PAGE_SIZE } from "./constants";

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
        select: { apiKeyId: true, workspaceId: true },
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

  return {
    apiKeyIds: apiKeys.map(({ id }) => id),
    apiKeyWorkspaceGrants: apiKeyWorkspaces,
    invalidWorkspaceTeamGrants,
    memberships: memberships.map(({ userId }) => ({ organizationId, userId })),
    teamIds: teams.map(({ id }) => id),
    teamMemberships,
    workspaceIds: workspaces.map(({ id }) => id),
    workspaceTeamGrants,
  };
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
