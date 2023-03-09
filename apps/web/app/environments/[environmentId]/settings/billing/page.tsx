import SettingsCard from "@/components/settings/SettingsCard";
import SettingsTitle from "@/components/settings/SettingsTitle";
import { Button } from "@/components/ui/Button";

export default function ProfileSettingsPage() {
  return (
    <div>
      <SettingsTitle title="Billing & Plan" />
      <SettingsCard
        title="Manage subscription"
        description="View, update and cancel your subscription in the billing portal.">
        <Button variant="primary">Billing Portal</Button>
      </SettingsCard>
    </div>
  );
}
