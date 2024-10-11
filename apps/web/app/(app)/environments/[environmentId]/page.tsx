import { getIsAIEnabled } from "@/app/lib/utils";
import { redirect } from "next/navigation";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";

const Page = async ({ params }) => {
  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const isAIEnabled = await getIsAIEnabled(organization.billing.plan);

  if (isAIEnabled) {
    return redirect(`/environments/${params.environmentId}/experience`);
  }

  return redirect(`/environments/${params.environmentId}/surveys`);
};

export default Page;
