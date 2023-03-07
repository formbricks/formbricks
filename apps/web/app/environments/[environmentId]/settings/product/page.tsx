import SettingsCard from "@/components/settings/SettingsCard";
import SettingsTitle from "@/components/settings/SettingsTitle";
import { EditProductName, EditWaitingTime } from "./editProduct";

export default function ProfileSettingsPage() {
  return (
    <div>
      <SettingsTitle title="Product Settings" />
      <SettingsCard title="Product Name" description="Change your products name.">
        <EditProductName />
      </SettingsCard>
      <SettingsCard
        title="Recontact Waiting Time"
        description="Control how frequently users can be surveyed.">
        <EditWaitingTime />
      </SettingsCard>
    </div>
  );
}
