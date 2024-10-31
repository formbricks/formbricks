import { getIsAIEnabled } from "@/app/lib/utils";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";

const Page = async ({ params }) => {
  const t = await getTranslations();
  const organization = await getOrganizationByEnvironmentId(params.environmentId);

  if (!organization) {
    throw new Error(t("common.organization_not_found"));
  }

  const isAIEnabled = await getIsAIEnabled(organization);

  if (isAIEnabled) {
    return redirect(`/environments/${params.environmentId}/experience`);
  }

  return redirect(`/environments/${params.environmentId}/surveys`);
};

export default Page;
