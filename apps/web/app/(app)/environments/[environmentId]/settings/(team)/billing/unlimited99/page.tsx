import { redirect } from "next/navigation";

import { StripePriceLookupKeys } from "@formbricks/ee/billing/lib/constants";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";

import { upgradePlanAction } from "../actions";

const Page = async ({ params }) => {
  const team = await getTeamByEnvironmentId(params.environmentId);
  if (!team) {
    throw new Error("Team not found");
  }

  const { status, newPlan, url } = await upgradePlanAction(team.id, params.environmentId, [
    StripePriceLookupKeys.inAppSurveyUnlimitedPlan33,
    StripePriceLookupKeys.linkSurveyUnlimitedPlan33,
    StripePriceLookupKeys.userTargetingUnlimitedPlan33,
  ]);
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
