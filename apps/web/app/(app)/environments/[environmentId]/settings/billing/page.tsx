export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";

import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import SettingsTitle from "../SettingsTitle";
import PricingTable from "./PricingTable";

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

  return (
    <>
      <div>
        <SettingsTitle title="Billing & Plan" />
        <PricingTable team={team} />
      </div>
    </>
  );
}
