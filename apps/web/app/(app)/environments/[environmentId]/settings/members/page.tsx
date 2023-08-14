import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { EditMemberships } from "./EditMemberships";
import EditTeamName from "./EditTeamName";
import DeleteTeam from "./DeleteTeam";
import { getTeamByEnvironmentId } from "@formbricks/lib/services/team";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

export default async function MembersSettingsPage({ params }: { params: { environmentId: string } }) {
  const session = await getServerSession(authOptions);
  const team = session ? await getTeamByEnvironmentId(params.environmentId) : null;

  if (!session || !team) {
    return null;
  }

  const currentUserId = session.user?.id;

  return (
    <div>
      <SettingsTitle title="Team" />
      <SettingsCard title="Manage members" description="Add or remove members in your team.">
        <EditMemberships team={team} currentUserId={currentUserId} />
      </SettingsCard>
      <SettingsCard title="Team Name" description="Give your team a descriptive name.">
        <EditTeamName team={team} environmentId={params.environmentId} />
      </SettingsCard>
      <SettingsCard
        title="Delete Team"
        description="Delete team with all its products including all surveys, responses, people, actions and attributes">
        <DeleteTeam environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
