import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { getOrganizationBillingPath } from "@/modules/settings/lib/routes";

// Org-scoped equivalent of redirectBillingRoleFromRestrictedSettings (the workspace-scoped guard).
// Bounces a billing-role member away from a restricted org settings page to their billing/enterprise
// home. getOrganizationAuth is React-cached, so calling it here in addition to the page is free.
export const redirectBillingRoleFromRestrictedOrgSettings = async (organizationId: string): Promise<void> => {
  const { isBilling } = await getOrganizationAuth(organizationId);

  if (isBilling) {
    redirect(getOrganizationBillingPath(organizationId, IS_FORMBRICKS_CLOUD));
  }
};
