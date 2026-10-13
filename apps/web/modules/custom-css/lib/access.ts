import "server-only";
import { type TAuthorizationActor, can } from "@/lib/authorization";
import { getCustomCssPermission } from "@/modules/ee/license-check/lib/utils";

export const WORKSPACE_CUSTOM_CSS_PERMISSION_MESSAGE =
  "Only organization owners and managers can change workspace custom CSS. API keys need manage access to the workspace.";

export const CUSTOM_CSS_PLAN_REQUIRED_MESSAGE =
  "Adding or editing custom CSS requires the Scale plan. Existing custom CSS keeps applying, and you can still remove it.";

/**
 * Whether the organization's plan allows custom CSS additions and edits (ENG-2949, D15). Cloud: the
 * Scale entitlement `custom-css`. Self-hosted: every plan, no license. Removal never consults this, and
 * neither does an unrelated save that leaves the CSS untouched.
 */
export const getCustomCssPlanAllowed = async (organizationId: string): Promise<boolean> =>
  getCustomCssPermission(organizationId);

/**
 * Workspace CSS reaches every survey in the workspace, so writing it is narrower than writing a survey:
 * organization owners and managers for a signed-in user (session or OAuth), and a `manage` grant on that
 * workspace for an API key — a Read & write grant is not enough.
 *
 * `organizationId` must be the workspace's own organization, resolved server-side from the workspace,
 * never taken from a request.
 */
export const canWriteWorkspaceCustomCss = async (
  actor: TAuthorizationActor | null,
  workspace: Readonly<{ workspaceId: string; organizationId: string }>
): Promise<boolean> => {
  if (!actor) {
    return false;
  }

  if (actor.type === "user") {
    return can(actor, "organization.manage", { type: "organization", id: workspace.organizationId });
  }

  return can(actor, "workspace.manage", { type: "workspace", id: workspace.workspaceId });
};
