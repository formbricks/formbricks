import { authOptions } from "@/modules/auth/lib/authOptions";
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";

const EnvironmentPage = async (props) => {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const t = await getTranslate();
  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!session) {
    return redirect(`/auth/login`);
  }

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isBilling } = getAccessFlags(currentUserMembership?.role);

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  return redirect(`/environments/${params.environmentId}/surveys`);
};

export default EnvironmentPage;
