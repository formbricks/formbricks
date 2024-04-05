import { PRICING_APPSURVEYS_FREE_RESPONSES, PRICING_USERTARGETING_FREE_MTU } from "@formbricks/lib/constants";
import {
  getMonthlyActiveTeamPeopleCount,
  getMonthlyTeamResponseCount,
  getTeamByEnvironmentId,
} from "@formbricks/lib/team/service";

import SettingsTitle from "../components/SettingsTitle";
import PricingTable from "./components/PricingTable";

export default async function BillingPage({ params }) {
  const team = await getTeamByEnvironmentId(params.environmentId);
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
