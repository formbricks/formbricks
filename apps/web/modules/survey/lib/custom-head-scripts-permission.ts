import "server-only";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { type TAuthorizationActor, can } from "@/lib/authorization";

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
 * `workspace.manage` — the same boundary as the workspace-level scripts — not the `workspace.write`
 * every survey write path already checks. Writes that leave them untouched stay open to
 * `workspace.write`, so a Read & write member can keep editing a survey a manager added scripts to.
 */
export const canWriteCustomHeadScripts = async (
  actor: TAuthorizationActor,
  workspaceId: string,
  incoming: TCustomHeadScriptsFields,
  existing: TCustomHeadScriptsFields | null
): Promise<boolean> => {
  if (!isCustomHeadScriptsChange(incoming, existing)) {
    return true;
  }

  return can(actor, "workspace.manage", { type: "workspace", id: workspaceId });
};

/** {@link canWriteCustomHeadScripts}, throwing `OperationNotAllowedError` on denial. */
export const assertCanWriteCustomHeadScripts = async (
  actor: TAuthorizationActor,
  workspaceId: string,
  incoming: TCustomHeadScriptsFields,
  existing: TCustomHeadScriptsFields | null
): Promise<void> => {
  if (!(await canWriteCustomHeadScripts(actor, workspaceId, incoming, existing))) {
    throw new OperationNotAllowedError(CUSTOM_HEAD_SCRIPTS_PERMISSION_MESSAGE);
  }
};
