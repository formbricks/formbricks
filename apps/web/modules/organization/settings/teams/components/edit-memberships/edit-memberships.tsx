import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getTeamIdsByUserIds } from "@/modules/ee/teams/team-list/lib/team";
import { TOrganizationTeam } from "@/modules/ee/teams/team-list/types/team";
import { MembersInfo } from "@/modules/organization/settings/teams/components/edit-memberships/members-info";
import { getInvitesByOrganizationId } from "@/modules/organization/settings/teams/lib/invite";
import { getMembershipByOrganizationId } from "@/modules/organization/settings/teams/lib/membership";

interface EditMembershipsProps {
  organization: TOrganization;
  currentUserId: string;
  role: TOrganizationRole;
  isAccessControlAllowed: boolean;
  isUserManagementDisabledFromUi: boolean;
  teams: TOrganizationTeam[];
  isOwnerOrManager: boolean;
  userAdminTeamIds?: string[];
}

export const EditMemberships = async ({
  organization,
  currentUserId,
  role,
  isAccessControlAllowed,
  isUserManagementDisabledFromUi,
  teams,
  isOwnerOrManager,
  userAdminTeamIds,
}: EditMembershipsProps) => {
  const members = await getMembershipByOrganizationId(organization.id);
  const invites = await getInvitesByOrganizationId(organization.id);
  const t = await getTranslate();

  const memberUserIds = (members ?? []).map((m) => m.userId);
  const memberTeamIdsMap =
    memberUserIds.length > 0 ? await getTeamIdsByUserIds(memberUserIds, organization.id) : {};

  const assignableTeams = isOwnerOrManager
    ? teams
    : teams.filter((team) => userAdminTeamIds?.includes(team.id));

  return (
    <div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 w-full max-w-full grid-cols-12 items-center gap-x-4 rounded-t-lg bg-slate-100 px-4 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-2 overflow-hidden">{t("common.full_name")}</div>
          <div className="col-span-3 overflow-hidden">{t("common.email")}</div>

          {isAccessControlAllowed && <div className="col-span-2 whitespace-nowrap">{t("common.role")}</div>}

          <div className="col-span-2 whitespace-nowrap">{t("common.status")}</div>

          {!isUserManagementDisabledFromUi && (
            <div className="col-span-3 whitespace-nowrap text-center">{t("common.actions")}</div>
          )}
        </div>

        {role && (
          <MembersInfo
            organization={organization}
            currentUserId={currentUserId}
            invites={invites ?? []}
            members={members ?? []}
            currentUserRole={role}
            isAccessControlAllowed={isAccessControlAllowed}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
            isUserManagementDisabledFromUi={isUserManagementDisabledFromUi}
            assignableTeams={assignableTeams}
            memberTeamIdsMap={memberTeamIdsMap}
          />
        )}
      </div>
    </div>
  );
};
