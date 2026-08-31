import "server-only";
import { prisma } from "@formbricks/database";
import type { TeamUserRole, WorkspaceTeamPermission } from "@formbricks/database/prisma";
import {
  type TAuthzedClient,
  type TAuthzedRelationshipFilter,
  type TAuthzedRelationshipUpdate,
  getAuthzedClient,
} from "./client";
import {
  AUTHZED_MAX_RECONCILIATION_PASSES,
  AuthzedProjectionUnstableError,
  type TAuthzedProjectionResult,
  runBestEffortProjection,
} from "./projection";
import { deleteRelationshipsInBoundedBatches, packRelationshipUpdateGroups } from "./relationship-batches";
import { TEAM_RELATIONS, WORKSPACE_TEAM_RELATIONS } from "./relationship-map";

const TEAM_RELATION_NAMES = Object.values(TEAM_RELATIONS);
const WORKSPACE_TEAM_RELATION_NAMES = Object.values(WORKSPACE_TEAM_RELATIONS);

export type TTeamMembershipProjectionTarget = Readonly<{
  teamId: string;
  userId: string;
}>;

export type TWorkspaceTeamProjectionTarget = Readonly<{
  teamId: string;
  workspaceId: string;
}>;

export type TTeamWorkspaceProjectionTargets = Readonly<{
  teamIds?: ReadonlyArray<string>;
  teamMemberships?: ReadonlyArray<TTeamMembershipProjectionTarget>;
  workspaceIds?: ReadonlyArray<string>;
  workspaceTeamGrants?: ReadonlyArray<TWorkspaceTeamProjectionTarget>;
}>;

type TNormalizedTargets = Readonly<{
  teamIds: ReadonlyArray<string>;
  teamMemberships: ReadonlyArray<TTeamMembershipProjectionTarget>;
  workspaceIds: ReadonlyArray<string>;
  workspaceTeamGrants: ReadonlyArray<TWorkspaceTeamProjectionTarget>;
}>;

type TTeamWorkspaceSnapshot = Readonly<{
  teamMemberships: ReadonlyArray<Readonly<{ role: TeamUserRole; teamId: string; userId: string }>>;
  teams: ReadonlyArray<Readonly<{ id: string; organizationId: string }>>;
  workspaceTeamGrants: ReadonlyArray<
    Readonly<{ permission: WorkspaceTeamPermission; teamId: string; workspaceId: string }>
  >;
  workspaces: ReadonlyArray<Readonly<{ id: string; organizationId: string }>>;
}>;

const pairKey = (first: string, second: string): string => `${first.length}:${first}${second}`;

const deduplicatePairs = <TPair extends Readonly<Record<TKey, string>>, TKey extends string>(
  pairs: ReadonlyArray<TPair>,
  firstKey: TKey,
  secondKey: TKey
): ReadonlyArray<TPair> => {
  const uniquePairs = new Map<string, TPair>();

  for (const pair of pairs) {
    uniquePairs.set(pairKey(pair[firstKey], pair[secondKey]), pair);
  }

  return [...uniquePairs.values()].sort((left, right) =>
    pairKey(left[firstKey], left[secondKey]).localeCompare(pairKey(right[firstKey], right[secondKey]))
  );
};

const normalizeTargets = (targets: TTeamWorkspaceProjectionTargets): TNormalizedTargets => {
  const teamMemberships = deduplicatePairs(targets.teamMemberships ?? [], "teamId", "userId");
  const workspaceTeamGrants = deduplicatePairs(targets.workspaceTeamGrants ?? [], "workspaceId", "teamId");
  const teamIds = new Set(targets.teamIds ?? []);
  const workspaceIds = new Set(targets.workspaceIds ?? []);

  for (const membership of teamMemberships) {
    teamIds.add(membership.teamId);
  }
  for (const grant of workspaceTeamGrants) {
    teamIds.add(grant.teamId);
    workspaceIds.add(grant.workspaceId);
  }

  return {
    teamIds: [...teamIds].sort((left, right) => left.localeCompare(right)),
    teamMemberships,
    workspaceIds: [...workspaceIds].sort((left, right) => left.localeCompare(right)),
    workspaceTeamGrants,
  };
};

const isEmptyTargetSet = (targets: TNormalizedTargets): boolean =>
  targets.teamIds.length === 0 &&
  targets.workspaceIds.length === 0 &&
  targets.teamMemberships.length === 0 &&
  targets.workspaceTeamGrants.length === 0;

const readSnapshot = async (targets: TNormalizedTargets): Promise<TTeamWorkspaceSnapshot> => {
  const [teams, workspaces, teamMemberships, workspaceTeamGrants] = await Promise.all([
    targets.teamIds.length === 0
      ? []
      : prisma.team.findMany({
          where: { id: { in: [...targets.teamIds] } },
          select: { id: true, organizationId: true },
          orderBy: { id: "asc" },
        }),
    targets.workspaceIds.length === 0
      ? []
      : prisma.workspace.findMany({
          where: { id: { in: [...targets.workspaceIds] } },
          select: { id: true, organizationId: true },
          orderBy: { id: "asc" },
        }),
    targets.teamMemberships.length === 0
      ? []
      : prisma.teamUser.findMany({
          where: {
            OR: targets.teamMemberships.map(({ teamId, userId }) => ({ teamId, userId })),
          },
          select: { role: true, teamId: true, userId: true },
          orderBy: [{ teamId: "asc" }, { userId: "asc" }],
        }),
    targets.workspaceTeamGrants.length === 0
      ? []
      : prisma.workspaceTeam.findMany({
          where: {
            OR: targets.workspaceTeamGrants.map(({ teamId, workspaceId }) => ({
              teamId,
              workspaceId,
            })),
          },
          select: { permission: true, teamId: true, workspaceId: true },
          orderBy: [{ workspaceId: "asc" }, { teamId: "asc" }],
        }),
  ]);

  return { teamMemberships, teams, workspaceTeamGrants, workspaces };
};

const snapshotsMatch = (left: TTeamWorkspaceSnapshot, right: TTeamWorkspaceSnapshot): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const createParentUpdate = (
  resourceType: "team" | "workspace",
  resourceId: string,
  organizationId: string
): TAuthzedRelationshipUpdate => ({
  operation: "touch",
  relationship: {
    relation: "organization",
    resource: { objectId: resourceId, objectType: resourceType },
    subject: { objectId: organizationId, objectType: "organization" },
  },
});

const createTeamMembershipUpdates = (
  target: TTeamMembershipProjectionTarget,
  role: TeamUserRole | null
): ReadonlyArray<TAuthzedRelationshipUpdate> =>
  TEAM_RELATION_NAMES.map((relation) => ({
    operation: role !== null && relation === TEAM_RELATIONS[role] ? "touch" : "delete",
    relationship: {
      relation,
      resource: { objectId: target.teamId, objectType: "team" },
      subject: { objectId: target.userId, objectType: "user" },
    },
  }));

const createWorkspaceTeamUpdates = (
  target: TWorkspaceTeamProjectionTarget,
  permission: WorkspaceTeamPermission | null
): ReadonlyArray<TAuthzedRelationshipUpdate> =>
  WORKSPACE_TEAM_RELATION_NAMES.map((relation) => ({
    operation: permission !== null && relation === WORKSPACE_TEAM_RELATIONS[permission] ? "touch" : "delete",
    relationship: {
      relation,
      resource: { objectId: target.workspaceId, objectType: "workspace" },
      subject: { objectId: target.teamId, objectType: "team", relation: "member" },
    },
  }));

const writeSnapshot = async (
  client: TAuthzedClient,
  targets: TNormalizedTargets,
  snapshot: TTeamWorkspaceSnapshot
): Promise<void> => {
  const teamsById = new Map(snapshot.teams.map((team) => [team.id, team]));
  const workspacesById = new Map(snapshot.workspaces.map((workspace) => [workspace.id, workspace]));
  const membershipsByPair = new Map(
    snapshot.teamMemberships.map((membership) => [pairKey(membership.teamId, membership.userId), membership])
  );
  const grantsByPair = new Map(
    snapshot.workspaceTeamGrants.map((grant) => [pairKey(grant.workspaceId, grant.teamId), grant])
  );
  const updateGroups: TAuthzedRelationshipUpdate[][] = [];

  for (const team of snapshot.teams) {
    updateGroups.push([createParentUpdate("team", team.id, team.organizationId)]);
  }
  for (const workspace of snapshot.workspaces) {
    updateGroups.push([createParentUpdate("workspace", workspace.id, workspace.organizationId)]);
  }
  for (const target of targets.teamMemberships) {
    const membership = membershipsByPair.get(pairKey(target.teamId, target.userId));
    updateGroups.push([...createTeamMembershipUpdates(target, membership?.role ?? null)]);
  }
  for (const target of targets.workspaceTeamGrants) {
    const grant = grantsByPair.get(pairKey(target.workspaceId, target.teamId));
    updateGroups.push([...createWorkspaceTeamUpdates(target, grant?.permission ?? null)]);
  }

  for (const batch of packRelationshipUpdateGroups(updateGroups)) {
    await client.writeRelationships(batch);
  }

  const deletionFilters: TAuthzedRelationshipFilter[] = [];
  for (const teamId of targets.teamIds) {
    if (!teamsById.has(teamId)) {
      deletionFilters.push({ resourceId: teamId, resourceType: "team" });
      deletionFilters.push({
        resourceType: "workspace",
        subject: { objectId: teamId, objectType: "team", relation: "member" },
      });
    }
  }
  for (const workspaceId of targets.workspaceIds) {
    if (!workspacesById.has(workspaceId)) {
      deletionFilters.push({ resourceId: workspaceId, resourceType: "workspace" });
    }
  }
  await deleteRelationshipsInBoundedBatches(client, deletionFilters);
};

export const reconcileTeamWorkspaceRelationships = async (
  targets: TTeamWorkspaceProjectionTargets
): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("reconcile_team_workspace_relationships", "team_workspace", async () => {
    const normalizedTargets = normalizeTargets(targets);
    if (isEmptyTargetSet(normalizedTargets)) {
      return 0;
    }

    const client = getAuthzedClient();
    for (let pass = 1; pass <= AUTHZED_MAX_RECONCILIATION_PASSES; pass++) {
      const sourceSnapshot = await readSnapshot(normalizedTargets);
      await writeSnapshot(client, normalizedTargets, sourceSnapshot);

      const verifiedSnapshot = await readSnapshot(normalizedTargets);
      if (snapshotsMatch(sourceSnapshot, verifiedSnapshot)) {
        return pass;
      }
    }

    throw new AuthzedProjectionUnstableError();
  });

export const deleteUserTeamRelationships = async (userId: string): Promise<TAuthzedProjectionResult> =>
  runBestEffortProjection("delete_user_team_relationships", "team_workspace", async () => {
    await getAuthzedClient().deleteRelationships({
      resourceType: "team",
      subject: {
        objectId: userId,
        objectType: "user",
      },
    });
    return 1;
  });
