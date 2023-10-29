export const revalidate = REVALIDATION_INTERVAL;

import { IS_FORMBRICKS_CLOUD, REVALIDATION_INTERVAL } from "@formbricks/lib/constants";

import { getTeamUsage } from "@/app/(app)/environments/[environmentId]/settings/billing/lib/getCurrentUsage";
import { authOptions } from "@formbricks/lib/authOptions";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
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

  const { peopleCount, responseCount } = await getTeamUsage(team.id);

  return (
    <>
      <div>
        <SettingsTitle title="Billing & Plan" />
        <PricingTable
          team={team}
          environmentId={params.environmentId}
          peopleCount={peopleCount}
          responseCount={responseCount}
        />
      </div>
    </>
  );
}
