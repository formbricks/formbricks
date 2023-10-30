export const revalidate = REVALIDATION_INTERVAL;

import {
  IS_FORMBRICKS_CLOUD,
  PRICING_APPSURVEYS_FREE_RESPONSES,
  REVALIDATION_INTERVAL,
} from "@formbricks/lib/constants";

import { authOptions } from "@formbricks/lib/authOptions";
import {
  getMonthlyActiveTeamPeopleCount,
  getMonthlyTeamResponseCount,
  getTeamByEnvironmentId,
} from "@formbricks/lib/team/service";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import SettingsTitle from "../components/SettingsTitle";
import PricingTable from "./components/PricingTable";
import { PRICING_USERTARGETING_FREE_MTU } from "@formbricks/lib/constants";

export default async function ProfileSettingsPage({ params }) {
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

  const [peopleCount, responseCount] = await Promise.all([
    getMonthlyActiveTeamPeopleCount(team.id),
    getMonthlyTeamResponseCount(team.id),
  ]);

  return (
    <>
      <div>
        <SettingsTitle title="Billing & Plan" />
        <PricingTable
          team={team}
          environmentId={params.environmentId}
          peopleCount={peopleCount}
          responseCount={responseCount}
          userTargetingFreeMtu={PRICING_USERTARGETING_FREE_MTU}
          inAppSurveyFreeResponses={PRICING_APPSURVEYS_FREE_RESPONSES}
        />
      </div>
    </>
  );
}
