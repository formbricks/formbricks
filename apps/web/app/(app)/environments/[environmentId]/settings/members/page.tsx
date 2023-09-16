import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { EditMemberships } from "./EditMemberships";
import EditTeamName from "./EditTeamName";
import DeleteTeam from "./DeleteTeam";
import { INVITE_DISABLED } from "@formbricks/lib/constants";

export default function MembersSettingsPage({ params }) {
  return (
    <div>
      <SettingsTitle title="Team" />
      <SettingsCard title="Manage members" description="Add or remove members in your team.">
        <EditMemberships environmentId={params.environmentId} invitesEnabled={!INVITE_DISABLED} />
      </SettingsCard>
      <SettingsCard title="Team Name" description="Give your team a descriptive name.">
        <EditTeamName environmentId={params.environmentId} />
      </SettingsCard>
      <SettingsCard
        title="Delete Team"
        description="Delete team with all its products including all surveys, responses, people, actions and attributes">
        <DeleteTeam environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
