import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getWorkspaceAuth } from "@/modules/environments/lib/utils";

const WorkspacePage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const { session, organization } = await getWorkspaceAuth(params.workspaceId);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isBilling } = getAccessFlags(currentUserMembership?.role);

  if (isBilling) {
    if (IS_FORMBRICKS_CLOUD) {
      return redirect(`/workspaces/${params.workspaceId}/settings/billing`);
    } else {
      return redirect(`/workspaces/${params.workspaceId}/settings/enterprise`);
    }
  }

  return redirect(`/workspaces/${params.workspaceId}/surveys`);
};

export default WorkspacePage;
