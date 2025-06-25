"use client";

import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getTeamDetailsAction, getTeamRoleAction } from "@/modules/ee/teams/team-list/actions";
import { CreateTeamButton } from "@/modules/ee/teams/team-list/components/create-team-button";
import { ManageTeamButton } from "@/modules/ee/teams/team-list/components/manage-team-button";
import { TeamSettingsModal } from "@/modules/ee/teams/team-list/components/team-settings/team-settings-modal";
import { TOrganizationProject } from "@/modules/ee/teams/team-list/types/project";
import {
  TOrganizationMember,
  TOtherTeam,
  TTeamDetails,
  TTeamRole,
  TUserTeam,
} from "@/modules/ee/teams/team-list/types/team";
import { Badge } from "@/modules/ui/components/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";
import toast from "react-hot-toast";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface TeamsTableProps {
  teams: { userTeams: TUserTeam[]; otherTeams: TOtherTeam[] };
  organizationId: string;
  orgMembers: TOrganizationMember[];
  orgProjects: TOrganizationProject[];
  membershipRole?: TOrganizationRole;
  currentUserId: string;
}

export const TeamsTable = ({
  teams,
  organizationId,
  orgMembers,
  orgProjects,
  membershipRole,
  currentUserId,
}: TeamsTableProps) => {
  const { t } = useTranslate();
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TTeamDetails>();
  const [userTeamRole, setUserTeamRole] = useState<TTeamRole | undefined>();

  const { isOwner, isManager } = getAccessFlags(membershipRole);

  const isOwnerOrManager = isOwner || isManager;

  const handleManageTeam = async (teamId: string) => {
    const teamDetailsResponse = await getTeamDetailsAction({ teamId });
    const teamRoleResult = await getTeamRoleAction({ teamId });

    setUserTeamRole(teamRoleResult?.data ?? undefined);

    if (teamDetailsResponse?.data) {
      setSelectedTeam(teamDetailsResponse.data);
      setOpenSettingsModal(true);
    } else {
      const errorMessage = getFormattedErrorMessage(teamDetailsResponse);
      toast.error(errorMessage);
    }
  };

  const { userTeams, otherTeams } = teams;

  const allTeams = [...userTeams, ...otherTeams];

  return (
    <>
      {isOwnerOrManager && (
        <div className="mb-4 flex justify-end">
          <CreateTeamButton organizationId={organizationId} />
        </div>
      )}

      <div className="overflow-hidden rounded-lg" aria-label="Teams list">
        <Table>
          <TableHeader role="rowgroup">
            <TableRow className="bg-slate-100" role="row">
              <TableHead className="font-medium text-slate-500">
                {t("environments.settings.teams.team_name")}
              </TableHead>
              <TableHead className="font-medium text-slate-500">{t("common.size")}</TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-b">
            {allTeams.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center hover:bg-transparent">
                  {t("environments.settings.teams.empty_teams_state")}
                </TableCell>
              </TableRow>
            )}
            {userTeams.map((team) => (
              <TableRow key={team.id} id={team.name} className="hover:bg-transparent">
                <TableCell>{team.name}</TableCell>
                <TableCell>
                  {team.memberCount} {team.memberCount === 1 ? t("common.member") : t("common.members")}
                </TableCell>
                <TableCell>
                  <Badge
                    type="success"
                    size={"tiny"}
                    text={t("environments.settings.teams.you_are_a_member")}
                  />
                </TableCell>
                <TableCell className="flex justify-end">
                  <ManageTeamButton
                    disabled={!isOwnerOrManager && team.userRole !== "admin"}
                    onClick={() => {
                      handleManageTeam(team.id);
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
            {otherTeams.map((team) => (
              <TableRow key={team.id} id={team.name} className="hover:bg-transparent">
                <TableCell>{team.name}</TableCell>
                <TableCell>
                  {team.memberCount} {team.memberCount === 1 ? t("common.member") : t("common.members")}
                </TableCell>
                <TableCell></TableCell>
                <TableCell className="flex justify-end">
                  <ManageTeamButton
                    disabled={!isOwnerOrManager}
                    onClick={() => {
                      handleManageTeam(team.id);
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {openSettingsModal && selectedTeam && (
        <TeamSettingsModal
          open={openSettingsModal}
          setOpen={setOpenSettingsModal}
          team={selectedTeam}
          orgMembers={orgMembers}
          orgProjects={orgProjects}
          membershipRole={membershipRole}
          userTeamRole={userTeamRole}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
};
