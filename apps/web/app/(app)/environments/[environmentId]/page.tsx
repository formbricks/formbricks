import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { redirect } from "next/navigation";

const EnvironmentPage = async (props) => {
  const params = await props.params;
  const { session, organization } = await getEnvironmentAuth(params.environmentId);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isBilling } = getAccessFlags(currentUserMembership?.role);

  if (isBilling) {
    if (IS_FORMBRICKS_CLOUD) {
      return redirect(`/environments/${params.environmentId}/settings/billing`);
    } else {
      return redirect(`/environments/${params.environmentId}/settings/enterprise`);
    }
  }

  return redirect(`/environments/${params.environmentId}/surveys`);
};

export default EnvironmentPage;
