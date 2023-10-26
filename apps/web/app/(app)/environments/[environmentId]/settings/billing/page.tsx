export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";

import { authOptions } from "@formbricks/lib/authOptions";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import SettingsTitle from "../components/SettingsTitle";
import PricingTable from "./components/PricingTable";
import { getBillingDetails } from "@/app/(app)/environments/[environmentId]/settings/billing/actions";

export default async function ProfileSettingsPage({ params }) {
  if (!IS_FORMBRICKS_CLOUD) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  const team = await getTeamByEnvironmentId(params.environmentId);
  if (!team) {
    throw new Error("Team not found");
  }
  const billingDetails = await getBillingDetails(team.id);

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
        <PricingTable team={team} environmentId={params.environmentId} billingDetails={billingDetails} />
      </div>
    </>
  );
}
