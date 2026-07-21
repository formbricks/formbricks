import "server-only";
import { notFound, redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getIsWorkflowsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const getWorkflowsRouteAuth = async (workspaceId: string) => {
  const auth = await getWorkspaceAuth(workspaceId);

  if (auth.isBilling) {
    redirect(getBillingFallbackPath(workspaceId, IS_FORMBRICKS_CLOUD));
  }

  const hasWorkspaceAccess =
    auth.isOwner || auth.isManager || auth.hasReadAccess || auth.hasReadWriteAccess || auth.hasManageAccess;

  if (!hasWorkspaceAccess) {
    notFound();
  }

  // Workflows is an EE feature (Cloud plan entitlement / self-hosted EE license). Routes render an
  // upgrade prompt instead of the feature when the organization is not entitled.
  const isWorkflowsEnabled = await getIsWorkflowsEnabled(auth.organization.id);

  // Consumers only need these flags (plus the organization id for the upgrade prompt's billing
  // link); keep the contract narrow.
  return { isReadOnly: auth.isReadOnly, isWorkflowsEnabled, organizationId: auth.organization.id };
};
