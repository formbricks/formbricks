import TeamActions from "@/app/(app)/environments/[environmentId]/settings/members/components/EditMemberships/TeamActions";
import { authOptions } from "@formbricks/lib/authOptions";
import { getMembershipsByUserId, getMembershipByUserIdTeamId } from "@formbricks/lib/membership/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { Skeleton } from "@formbricks/ui/Skeleton";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
import SettingsCard from "../components/SettingsCard";
import SettingsTitle from "../components/SettingsTitle";
import DeleteTeam from "./components/DeleteTeam";
import { EditMemberships } from "./components/EditMemberships";
import EditTeamName from "./components/EditTeamName";
import { INVITE_DISABLED } from "@formbricks/lib/constants";

const MembersLoading = () => (
  <div className="rounded-lg border border-slate-200">
    <div className="grid-cols-20 grid h-12 content-center rounded-t-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
      <div className="col-span-2"></div>
      <div className="col-span-5">Fullname</div>
      <div className="col-span-5">Email</div>
      <div className="col-span-3">Role</div>
      <div className="col-span-5"></div>
    </div>

    <div className="p-4">
      {[1, 2, 3].map((_) => (
        <div className="grid-cols-20 grid h-12 content-center rounded-t-lg bg-white p-4 text-left text-sm font-semibold text-slate-900">
          <Skeleton className="col-span-2 h-10 w-10 rounded-full" />
          <Skeleton className="col-span-5 h-8 w-24" />
          <Skeleton className="col-span-5 h-8 w-24" />
          <Skeleton className="col-span-3 h-8 w-24" />
        </div>
      ))}
    </div>
  </div>
);

export default async function MembersSettingsPage({ params }: { params: { environmentId: string } }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Unauthenticated");
  }
  const team = await getTeamByEnvironmentId(params.environmentId);

  if (!team) {
    throw new Error("Team not found");
  }

  const currentUserMembership = await getMembershipByUserIdTeamId(session?.user.id, team.id);
  const userMemberships = await getMembershipsByUserId(session.user.id);

  const isDeleteDisabled = userMemberships.length <= 1 || currentUserMembership?.role !== "owner";
  const currentUserRole = currentUserMembership?.role;

  const isLeaveTeamDisabled = userMemberships.length <= 1;
  const isUserAdminOrOwner = currentUserRole === "admin" || currentUserRole === "owner";

  return (
    <div>
      <SettingsTitle title="Team" />
      <SettingsCard title="Manage members" description="Add or remove members in your team.">
        {currentUserRole && (
          <TeamActions
            team={team}
            isAdminOrOwner={isUserAdminOrOwner}
            role={currentUserRole}
            isLeaveTeamDisabled={isLeaveTeamDisabled}
            isInviteDisabled={INVITE_DISABLED}
          />
        )}

        {currentUserMembership && (
          <Suspense fallback={<MembersLoading />}>
            <EditMemberships
              team={team}
              currentUserId={session.user?.id}
              allMemberships={userMemberships}
              currentUserMembership={currentUserMembership}
            />
          </Suspense>
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
