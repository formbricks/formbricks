export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import SettingsTitle from "../SettingsTitle";
import PricingTable from "./PricingTable";
import { getTeamByEnvironmentId } from "@formbricks/lib/services/team";

export default async function ProfileSettingsPage({ params }) {
  const session = await getServerSession(authOptions);
  const team = await getTeamByEnvironmentId(params.environmentId);

  return (
    <>
      {team && session && (
        <div>
          <SettingsTitle title="Billing & Plan" />
          <PricingTable team={team} />
        </div>
      )}
    </>
  );
}
