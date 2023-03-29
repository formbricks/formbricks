import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { Button } from "@formbricks/ui";
import PricingTable from "./PricingTable";

const proPlan = false;

export default function ProfileSettingsPage() {
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
        <PricingTable />
      )}
    </div>
  );
}
