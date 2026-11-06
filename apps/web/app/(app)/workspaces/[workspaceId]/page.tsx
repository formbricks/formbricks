import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getWorkspaceHomePath } from "@/modules/settings/lib/organization-switch";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

const WorkspacePage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  // `getWorkspaceAuth` already sends a Dashboard viewer to its dashboards and a Billing member to billing;
  // the redirects below name each role's home explicitly so this route never depends on that ordering.
  const { organization, currentUserMembership, isBilling } = await getWorkspaceAuth(params.workspaceId);

  if (isBilling) {
    return redirect(getBillingFallbackPath(organization.id, IS_FORMBRICKS_CLOUD));
  }

  return redirect(getWorkspaceHomePath(currentUserMembership.role, params.workspaceId));
};

export default WorkspacePage;
