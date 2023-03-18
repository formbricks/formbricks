import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { EditProductName } from "./editProduct";

export default function ProfileSettingsPage({ params }) {
  return (
    <div>
      <SettingsTitle title="Product Settings" />
      <SettingsCard title="Product Name" description="Change your products name.">
        <EditProductName environmentId={params.environmentId} />
      </SettingsCard>
      {/* <SettingsCard
        title="Recontact Waiting Time"
        description="Control how frequently users can be surveyed.">
        <EditWaitingTime />
      </SettingsCard> */}
    </div>
  );
}
