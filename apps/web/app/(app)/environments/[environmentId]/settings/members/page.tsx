import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import { EditMemberships } from "./EditMemberships";
import EditTeamName from "./EditTeamName";
import DeleteTeam from "./DeleteTeam";
import { getTeamByEnvironmentId } from "@formbricks/lib/services/team";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getAllMembershipsByUserId, getMembershipByUserId } from "@formbricks/lib/services/membership";

export default async function MembersSettingsPage({ params }: { params: { environmentId: string } }) {
  const session = await getServerSession(authOptions);
  const team = session ? await getTeamByEnvironmentId(params.environmentId) : null;

  const currentUserMembership =
    session && team ? await getMembershipByUserId(session?.user.id, team.id) : null;

  const allMemberships = session ? await getAllMembershipsByUserId(session.user.id) : [];

  const isDeleteDisabled = allMemberships.length <= 1;
  const currentUserRole = currentUserMembership?.role;

  if (!session || !team) {
    return null;
  }

  const currentUserId = session.user?.id;

  return (
    <div>
      <SettingsTitle title="Team" />
      <SettingsCard title="Manage members" description="Add or remove members in your team.">
        {currentUserMembership && (
          <EditMemberships
            team={team}
            currentUserId={currentUserId}
            allMemberships={allMemberships}
            currentUserMembership={currentUserMembership}
          />
        )}
      </SettingsCard>
      <SettingsCard title="Team Name" description="Give your team a descriptive name.">
        <EditTeamName team={team} environmentId={params.environmentId} />
      </SettingsCard>
      <SettingsCard
        title="Delete Team"
        description="Delete team with all its products including all surveys, responses, people, actions and attributes">
        <DeleteTeam
          team={team}
          isDeleteDisabled={isDeleteDisabled}
          isUserOwner={currentUserRole === "owner"}
        />
      </SettingsCard>
    </div>
  );
}
