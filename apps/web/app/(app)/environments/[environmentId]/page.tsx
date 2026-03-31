import { redirect } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getBillingFallbackPath } from "@/lib/membership/navigation";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";

const EnvironmentPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const { session, organization } = await getEnvironmentAuth(params.environmentId);

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isBilling } = getAccessFlags(currentUserMembership?.role);

  if (isBilling) {
    return redirect(getBillingFallbackPath(params.environmentId, IS_FORMBRICKS_CLOUD));
  }

  return redirect(`/environments/${params.environmentId}/surveys`);
};

export default EnvironmentPage;
