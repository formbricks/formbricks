import "server-only";
import { notFound, redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
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

  return auth;
};
