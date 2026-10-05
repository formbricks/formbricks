import "server-only";
import {
  CUSTOM_CSS_PROCESSOR_VERSION,
  type TCustomCss,
  type TCustomCssScope,
} from "@formbricks/types/custom-css";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { type TAuthorizationActor, assertCan } from "@/lib/authorization";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getCustomCssPermission } from "@/modules/ee/license-check/lib/utils";
import { recompileCustomCss } from "./custom-css";

export const isCustomCssChange = (
  incoming: TCustomCss | null | undefined,
  existing: TCustomCss | null | undefined
) =>
  incoming !== undefined &&
  ((incoming?.light?.source ?? "") !== (existing?.light?.source ?? "") ||
    (incoming?.dark?.source ?? "") !== (existing?.dark?.source ?? ""));

export const assertCustomCssAccess = async (
  actor: TAuthorizationActor,
  workspaceId: string,
  scope: TCustomCssScope
) => {
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  if (scope === "workspace") {
    // workspace.manage also admits team managers. D15's CSS permission is explicitly org-level.
    await assertCan(actor, "organization.manage", { type: "organization", id: organizationId });
  } else {
    await assertCan(actor, "workspace.write", { type: "workspace", id: workspaceId });
  }
  if (!(await getCustomCssPermission(organizationId))) {
    throw new OperationNotAllowedError("Custom CSS requires the Scale plan on Formbricks Cloud");
  }
};

/**
 * Called at every persistence boundary. Unchanged source omits the column entirely, so a forged
 * compiled field never persists and an unrelated save cannot restore CSS from a stale editor.
 */
export const prepareCustomCssForSave = async (
  incoming: TCustomCss | null | undefined,
  existing: TCustomCss | null | undefined,
  workspaceId: string,
  scope: TCustomCssScope
): Promise<TCustomCss | null | undefined> => {
  if (incoming === undefined) return undefined;
  if (!isCustomCssChange(incoming, existing)) {
    return existing && existing.processorVersion !== CUSTOM_CSS_PROCESSOR_VERSION
      ? recompileCustomCss(existing, scope)
      : undefined;
  }
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  if (!(await getCustomCssPermission(organizationId))) {
    throw new OperationNotAllowedError("Custom CSS requires the Scale plan on Formbricks Cloud");
  }
  return recompileCustomCss(incoming, scope);
};
