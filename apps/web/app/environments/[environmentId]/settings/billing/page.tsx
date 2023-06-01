import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { Button } from "@formbricks/ui";
import { getServerSession } from "next-auth";
import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import PricingTable from "./PricingTable";

const proPlan = false;

export default async function ProfileSettingsPage({ params }) {
  const session = await getServerSession(authOptions);
  return (
    <div>
      <SettingsTitle title="Billing & Plan" />
      {proPlan ? (
        <SettingsCard
          title="Manage subscription"
          description="View, update and cancel your subscription in the billing portal.">
          <Button variant="darkCTA">Billing Portal</Button>
        </SettingsCard>
      ) : (
        <PricingTable environmentId={params.environmentId} session={session} />
      )}
    </div>
  );
}
