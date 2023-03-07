import SettingsCard from "@/components/settings/SettingsCard";
import SettingsTitle from "@/components/settings/SettingsTitle";
import { EditBrandColor } from "./editLookAndFeel";

export default function ProfileSettingsPage() {
  return (
    <div>
      <SettingsTitle title="Look & Feel" />
      <SettingsCard title="Brand Color" description="Match the surveys with your user interface.">
        <EditBrandColor />
      </SettingsCard>
    </div>
  );
}
