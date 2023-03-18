import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { EditTeamName, EditMembers } from "./editMembers";

export default function MembersSettingsPage() {
  return (
    <div>
      <SettingsTitle title="Team Members" />
      <SettingsCard title="Manage members" description="Add or remove members in your team.">
        <EditMembers />
      </SettingsCard>
      <SettingsCard title="Team Name" description="Change the name of your team. Just in case.">
        <EditTeamName />
      </SettingsCard>
    </div>
  );
}
