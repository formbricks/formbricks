import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { upgradePlanAction } from "../actions";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { StripePriceLookupKeys } from "@formbricks/ee/billing/lib/constants";

export default async function UnlimitedPage({ params }) {
  if (!IS_FORMBRICKS_CLOUD) {
    notFound();
  }

  const session = await getServerSession(authOptions);

  const team = await getTeamByEnvironmentId(params.environmentId);

  if (!session) {
    throw new Error("Unauthorized");
  }

  if (!team) {
    throw new Error("Team not found");
  }

  const { status, newPlan, url } = await upgradePlanAction(team.id, params.environmentId, [
    StripePriceLookupKeys.inAppSurveyUnlimited,
    StripePriceLookupKeys.linkSurveyUnlimited,
    StripePriceLookupKeys.userTargetingUnlimited,
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
}
