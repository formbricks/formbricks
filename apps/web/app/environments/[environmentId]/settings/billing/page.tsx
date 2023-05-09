import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { Button } from "@formbricks/ui";
import PricingTable from "./PricingTable";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

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
          <Button variant="primary">Billing Portal</Button>
        </SettingsCard>
      ) : (
        <PricingTable environmentId={params.environmentId} session={session} />
      )}
    </div>
  );
}
