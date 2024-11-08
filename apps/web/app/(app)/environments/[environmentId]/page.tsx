import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getIsAIEnabled } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipByUserIdOrganizationId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";

const Page = async ({ params }) => {
  const session = await getServerSession(authOptions);
  const t = await getTranslations();
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

  const isAIEnabled = await getIsAIEnabled(organization);

  if (isAIEnabled) {
    return redirect(`/environments/${params.environmentId}/experience`);
  }

  return redirect(`/environments/${params.environmentId}/surveys`);
};

export default Page;
