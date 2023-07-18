import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { EditMemberships } from "./EditMemberships";
import EditTeamName from "./EditTeamName";

export default function MembersSettingsPage({ params }) {
  return (
    <div>
      <SettingsTitle title="Team" />
      <SettingsCard title="Manage members" description="Add or remove members in your team.">
        <EditMemberships environmentId={params.environmentId} />
      </SettingsCard>
      <SettingsCard title="Team Name" description="Give your team a descriptive name.">
        <EditTeamName environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
