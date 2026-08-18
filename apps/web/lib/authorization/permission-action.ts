import "server-only";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import type { TAuthorizationAction } from "./contract";

type TWorkspaceAction = Extract<TAuthorizationAction, `workspace.${string}`>;
type TFeedbackDirectoryAction = Extract<TAuthorizationAction, `feedbackDirectory.${string}`>;
type TFeedbackDirectoryAssignmentAction = Extract<
  TAuthorizationAction,
  `feedbackDirectoryAssignment.${string}`
>;

export type TFeedbackDirectoryPermission = "read" | "write" | "manage";
export type TAuthorizationHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Maps the current WorkspaceTeam permission ladder to the central vocabulary.
 *
 * This is intentionally not exported from the public authorization barrel. It translates persisted
 * source permission enums into the engine-independent authorization vocabulary at service boundaries.
 */
export const getWorkspaceAuthorizationAction = (minPermission?: TTeamPermission): TWorkspaceAction => {
  if (minPermission === "manage") return "workspace.manage";
  if (minPermission === "readWrite") return "workspace.write";
  return "workspace.read";
};

export const getWorkspaceAuthorizationActionForMethod = (
  method: TAuthorizationHttpMethod
): TWorkspaceAction => {
  if (method === "DELETE") return "workspace.manage";
  if (method === "GET") return "workspace.read";
  return "workspace.write";
};

export const getOrganizationAuthorizationActionForAccessType = (
  accessType: OrganizationAccessType
): Extract<TAuthorizationAction, `organization.${string}`> =>
  accessType === OrganizationAccessType.Write ? "organization.manage_access" : "organization.read_access";

export const getFeedbackDirectoryAuthorizationAction = (
  permission: TFeedbackDirectoryPermission
): TFeedbackDirectoryAction => `feedbackDirectory.${permission}`;

export const getFeedbackDirectoryAssignmentAuthorizationAction = (
  minPermission?: TTeamPermission
): TFeedbackDirectoryAssignmentAction => {
  if (minPermission === "manage") return "feedbackDirectoryAssignment.manage";
  if (minPermission === "readWrite") return "feedbackDirectoryAssignment.write";
  return "feedbackDirectoryAssignment.read";
};
