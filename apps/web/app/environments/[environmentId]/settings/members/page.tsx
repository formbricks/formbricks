import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { EditMembers } from "./EditMembers";
import { EditTeamName } from "./EditTeamName";

export default function MembersSettingsPage({ params }) {
  return (
    <div>
      <SettingsTitle title="Team Members" />
      <SettingsCard title="Manage members" description="Add or remove members in your team.">
        <EditMembers environmentId={params.environmentId} />
      </SettingsCard>
      <SettingsCard title="Team Name" description="Change the name of your team. Just in case.">
        <EditTeamName />
      </SettingsCard>
    </div>
  );
}
