import type { TTeamRole } from "@/modules/ee/teams/team-list/types/team";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import type { TV3TeamChanges } from "./schemas";

/** The team as `updateTeamDetails` stores it: what a change is computed from and applied to. */
export type TTeamState = {
  name: string;
  members: { userId: string; role: TTeamRole }[];
  workspaces: { workspaceId: string; permission: TTeamPermission }[];
};

const PERMISSION_RANK: Record<TTeamPermission, number> = { read: 0, readWrite: 1, manage: 2 };

/** What `next` changes about `current`, as ids. Pure, so the preview and the write cannot disagree. */
export function diffTeam(current: TTeamState, next: TTeamState): TV3TeamChanges {
  const currentMembers = new Map(current.members.map((member) => [member.userId, member.role]));
  const nextMembers = new Map(next.members.map((member) => [member.userId, member.role]));
  const currentGrants = new Map(current.workspaces.map((grant) => [grant.workspaceId, grant.permission]));
  const nextGrants = new Map(next.workspaces.map((grant) => [grant.workspaceId, grant.permission]));

  const memberRolesChanged: TV3TeamChanges["memberRolesChanged"] = [];
  for (const [userId, to] of nextMembers) {
    const from = currentMembers.get(userId);
    if (from !== undefined && from !== to) memberRolesChanged.push({ userId, from, to });
  }

  const workspacePermissionsChanged: TV3TeamChanges["workspacePermissionsChanged"] = [];
  for (const [workspaceId, to] of nextGrants) {
    const from = currentGrants.get(workspaceId);
    if (from !== undefined && from !== to) workspacePermissionsChanged.push({ workspaceId, from, to });
  }

  return {
    name: current.name === next.name ? null : { from: current.name, to: next.name },
    membersAdded: [...nextMembers.keys()].filter((userId) => !currentMembers.has(userId)),
    membersRemoved: [...currentMembers.keys()].filter((userId) => !nextMembers.has(userId)),
    memberRolesChanged,
    workspacesAdded: [...nextGrants.keys()].filter((workspaceId) => !currentGrants.has(workspaceId)),
    workspacesRemoved: [...currentGrants.keys()].filter((workspaceId) => !nextGrants.has(workspaceId)),
    workspacePermissionsChanged,
  };
}

export const hasTeamChanges = (changes: TV3TeamChanges): boolean =>
  changes.name !== null ||
  changes.membersAdded.length > 0 ||
  changes.membersRemoved.length > 0 ||
  changes.memberRolesChanged.length > 0 ||
  changes.workspacesAdded.length > 0 ||
  changes.workspacesRemoved.length > 0 ||
  changes.workspacePermissionsChanged.length > 0;

/**
 * True when the change takes access away from someone: a member removed or demoted from admin, a workspace
 * removed from the team or its permission lowered. Those need `confirm`; adding and widening do not.
 */
export const lowersTeamAccess = (changes: TV3TeamChanges): boolean =>
  changes.membersRemoved.length > 0 ||
  changes.workspacesRemoved.length > 0 ||
  changes.memberRolesChanged.some((change) => change.from === "admin" && change.to === "contributor") ||
  changes.workspacePermissionsChanged.some(
    (change) => PERMISSION_RANK[change.to] < PERMISSION_RANK[change.from]
  );
