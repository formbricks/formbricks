import { redirect } from "next/navigation";
import { STRIPE_PRICE_LOOKUP_KEYS } from "@formbricks/lib/constants";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { upgradePlanAction } from "../actions";

const Page = async ({ params }) => {
  const organization = await getOrganizationByEnvironmentId(params.environmentId);
  if (!organization) {
    throw new Error("Organization not found");
  }

  const { status, newPlan, url } = await upgradePlanAction(
    organization.id,
    params.environmentId,
    STRIPE_PRICE_LOOKUP_KEYS.UNLIMITED_199
  );

  if (status != 200) {
    throw new Error("Something went wrong");
  }
  if (newPlan && url) {
    redirect(url);
  } else if (!newPlan) {
    redirect(`/billing-confirmation?environmentId=${params.environmentId}`);
  } else {
    throw new Error("Something went wrong");
  }
};

export default Page;
