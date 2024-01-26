import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import { IS_FORMBRICKS_CLOUD, PRICING_APPSURVEYS_FREE_RESPONSES } from "@formbricks/lib/constants";
import { PRICING_USERTARGETING_FREE_MTU } from "@formbricks/lib/constants";
import { getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import {
  getMonthlyActiveTeamPeopleCount,
  getMonthlyTeamResponseCount,
  getTeamByEnvironmentId,
} from "@formbricks/lib/team/service";
import { ErrorComponent } from "@formbricks/ui/ErrorComponent";

import SettingsTitle from "../components/SettingsTitle";
import PricingTable from "./components/PricingTable";

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
  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);
  const { isAdmin, isOwner } = getAccessFlags(currentUserMembership?.role);
  const isPricingDisabled = !isOwner && !isAdmin;

  return (
    <>
      <div>
        <SettingsTitle title="Billing & Plan" />
        {!isPricingDisabled ? (
          <PricingTable
            team={team}
            environmentId={params.environmentId}
            peopleCount={peopleCount}
            responseCount={responseCount}
            userTargetingFreeMtu={PRICING_USERTARGETING_FREE_MTU}
            inAppSurveyFreeResponses={PRICING_APPSURVEYS_FREE_RESPONSES}
          />
        ) : (
          <ErrorComponent />
        )}
      </div>
    </>
  );
}
