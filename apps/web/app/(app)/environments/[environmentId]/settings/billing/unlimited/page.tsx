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

  const paymentUrl = await upgradePlanAction(team.id, params.environmentId, [
    StripePriceLookupKeys.inAppSurveyUnlimited199,
    StripePriceLookupKeys.linkSurveyUnlimited199,
    StripePriceLookupKeys.userTargetingUnlimited199,
  ]);
  if (!paymentUrl || paymentUrl.length === 0) {
    throw new Error("Failed to create payment");
  }

  redirect(paymentUrl);
}
