import { getIsAIEnabled } from "@/app/lib/utils";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";

const Page = async ({ params }) => {
  const session = await getServerSession(authOptions);
  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!session) {
    return redirect(`/auth/login`);
  }

  if (!organization) {
    throw new Error("Organization not found");
  }

  const currentUserMembership = await getMembershipByUserIdOrganizationId(session?.user.id, organization.id);
  const { isBilling } = getAccessFlags(currentUserMembership?.organizationRole);

  if (isBilling) {
    return redirect(`/environments/${params.environmentId}/settings/billing`);
  }

  const isAIEnabled = await getIsAIEnabled(organization);

  if (isAIEnabled) {
    return redirect(`/environments/${params.environmentId}/experience`);
  }

  return redirect(`/environments/${params.environmentId}/surveys`);
};

export default Page;
