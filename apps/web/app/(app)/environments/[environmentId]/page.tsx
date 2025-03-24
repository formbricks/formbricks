import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { redirect } from "next/navigation";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";

const EnvironmentPage = async (props) => {
  const params = await props.params;
  const { session, organization } = await getEnvironmentAuth(params.environmentId);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isBilling } = getAccessFlags(currentUserMembership?.role);

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  return redirect(`/environments/${params.environmentId}/surveys`);
};

export default EnvironmentPage;
