import { type TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

type TWorkspaceGrant = {
  workspaceId: string;
  permission: TTeamPermission;
};

/**
 * True when a team-settings submission would add, remove, or re-scope any of the team's workspace
 * grants.
 *
 * `updateTeamDetailsAction` is reachable by an org owner/manager *or* a team admin, and a team admin
 * may be a plain org `member`. Its input carries the team's whole workspace grant list, so without
 * this check a team admin could grant their own team `manage` on every workspace in the organization —
 * i.e. read/write on all surveys, responses, and contacts — while the UI only ever offered them the
 * members section (workspace selects are disabled for non-owners in `workspace-row.tsx`).
 *
 * Comparing the submitted list against the stored one lets the member-management path keep working
 * (it round-trips the existing grants unchanged) while any actual access change requires owner/manager.
 */
export const hasWorkspaceAccessChanges = (
  current: readonly TWorkspaceGrant[],
  submitted: readonly TWorkspaceGrant[]
): boolean => {
  const currentByWorkspace = new Map(current.map(({ workspaceId, permission }) => [workspaceId, permission]));

  const submittedByWorkspace = new Map(
    submitted.map(({ workspaceId, permission }) => [workspaceId, permission])
  );

  // A repeated workspaceId is treated as a change so the owner/manager gate applies. `Map` keeps the
  // last entry for a duplicate, so `[{ws1, manage}, {ws1, read}]` would otherwise compare equal to a
  // stored `read` grant and skip the gate. `updateTeamDetails` already rejects duplicates (it counts
  // the submitted ids against a distinct `in` query, so the lengths disagree), which is why this was
  // not exploitable — but that makes the outcome depend on a check in a different module. Deciding it
  // here keeps this function correct on its own terms. Raised by CodeRabbit on #8680.
  if (submittedByWorkspace.size !== submitted.length) {
    return true;
  }

  if (currentByWorkspace.size !== submittedByWorkspace.size) {
    return true;
  }

  for (const [workspaceId, permission] of submittedByWorkspace) {
    if (currentByWorkspace.get(workspaceId) !== permission) {
      return true;
    }
  }

  return false;
};
