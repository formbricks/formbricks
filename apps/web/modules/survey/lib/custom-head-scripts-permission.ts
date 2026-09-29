import "server-only";
import { TAPIKeyWorkspacePermission } from "@formbricks/types/auth";
import { AuthorizationError, OperationNotAllowedError } from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";

type TCustomHeadScriptsFields = Partial<Pick<TSurvey, "customHeadScripts" | "customHeadScriptsMode">>;

export const CUSTOM_HEAD_SCRIPTS_PERMISSION_MESSAGE =
  "Only owners, managers and members with Manage access can change a survey's custom head scripts.";

// An empty script and no script render the same page; a missing mode is treated as "add" by the
// link-survey injector. Normalising both keeps an untouched survey from reading as a change.
const normalizeScripts = (value: string | null | undefined): string | null => value || null;
const normalizeMode = (value: TSurvey["customHeadScriptsMode"] | undefined) => value ?? "add";

/**
 * Whether a write would change a survey's custom head scripts or their mode. `existing` is null for
 * a create. A key the write leaves `undefined` is not written, so it never counts as a change.
 */
export const isCustomHeadScriptsChange = (
  incoming: TCustomHeadScriptsFields,
  existing: TCustomHeadScriptsFields | null
): boolean => {
  const isScriptsChange =
    incoming.customHeadScripts !== undefined &&
    normalizeScripts(incoming.customHeadScripts) !== normalizeScripts(existing?.customHeadScripts);
  const isModeChange =
    incoming.customHeadScriptsMode !== undefined &&
    normalizeMode(incoming.customHeadScriptsMode) !== normalizeMode(existing?.customHeadScriptsMode);

  return isScriptsChange || isModeChange;
};

/**
 * Survey head scripts run as arbitrary HTML on the published link survey, so setting them takes
 * Manage access — the same boundary as the workspace-level scripts — not the Read & write every
 * survey write path already checks. Writes that leave them untouched stay open to Read & write, so a
 * member can keep editing a survey a manager added scripts to.
 */
export const assertUserCanWriteCustomHeadScripts = async (
  actor: { userId: string; organizationId: string; workspaceId: string },
  incoming: TCustomHeadScriptsFields,
  existing: TCustomHeadScriptsFields | null
): Promise<void> => {
  if (!isCustomHeadScriptsChange(incoming, existing)) {
    return;
  }

  try {
    await checkAuthorizationUpdated({
      userId: actor.userId,
      organizationId: actor.organizationId,
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "workspaceTeam", workspaceId: actor.workspaceId, minPermission: "manage" },
      ],
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw new OperationNotAllowedError(CUSTOM_HEAD_SCRIPTS_PERMISSION_MESSAGE);
    }
    throw error;
  }
};

/** The API-key counterpart: a changed value needs the key's `manage` permission on the workspace. */
export const canApiKeyWriteCustomHeadScripts = (
  workspacePermissions: TAPIKeyWorkspacePermission[],
  workspaceId: string,
  incoming: TCustomHeadScriptsFields,
  existing: TCustomHeadScriptsFields | null
): boolean =>
  !isCustomHeadScriptsChange(incoming, existing) ||
  workspacePermissions.find((permission) => permission.workspaceId === workspaceId)?.permission === "manage";
