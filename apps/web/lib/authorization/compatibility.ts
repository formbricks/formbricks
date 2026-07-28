import "server-only";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import type { TAuthorizationAction } from "./contract";

type TWorkspaceAction = Extract<TAuthorizationAction, `workspace.${string}`>;

/**
 * Maps the current WorkspaceTeam permission ladder to the central vocabulary.
 *
 * This is intentionally not exported from the public authorization barrel;
 * it exists only while legacy signatures are migrated.
 */
export const getWorkspaceActionForPermission = (minPermission?: TTeamPermission): TWorkspaceAction => {
  if (minPermission === "manage") return "workspace.manage";
  if (minPermission === "readWrite") return "workspace.write";
  return "workspace.read";
};
