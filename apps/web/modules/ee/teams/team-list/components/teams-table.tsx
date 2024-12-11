"use client";

import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getTeamDetailsAction } from "@/modules/ee/teams/team-list/actions";
import { CreateTeamButton } from "@/modules/ee/teams/team-list/components/create-team-button";
import { TeamSettingsModal } from "@/modules/ee/teams/team-list/components/team-settings/team-settings-modal";
import { TOrganizationProject } from "@/modules/ee/teams/team-list/types/project";
import {
  TOrganizationMember,
  TOtherTeam,
  TTeamDetails,
  TUserTeam,
} from "@/modules/ee/teams/team-list/types/teams";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface YourTeamsProps {
  teams: { userTeams: TUserTeam[]; otherTeams: TOtherTeam[] };
  organizationId: string;
  isOwnerOrManager: boolean;
  orgMembers: TOrganizationMember[];
  orgProjects: TOrganizationProject[];
}

export const TeamsTable = ({
  teams,
  organizationId,
  isOwnerOrManager,
  orgMembers,
  orgProjects,
}: YourTeamsProps) => {
  const t = useTranslations();
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TTeamDetails>();

  const handleManageTeam = async (teamId: string) => {
    const teamDetailsResponse = await getTeamDetailsAction({ teamId });
    if (teamDetailsResponse?.data) {
      setSelectedTeam(teamDetailsResponse.data);
      setOpenSettingsModal(true);
    }
  };

  const { userTeams, otherTeams } = teams;

  const allTeams = [...userTeams, ...otherTeams];

  return (
    <>
      <SettingsCard
        title={t("environments.settings.teams.teams")}
        description={t("environments.settings.teams.teams_description")}>
        {isOwnerOrManager && (
          <div className="mb-4 flex justify-end">
            <CreateTeamButton organizationId={organizationId} />
          </div>
        )}

        <div className="overflow-hidden rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100">
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
                  <TableCell colSpan={4} className="text-center">
                    {t("environments.settings.teams.empty_teams_state")}
                  </TableCell>
                </TableRow>
              )}
              {userTeams.map((team) => (
                <TableRow key={team.id} id={team.name}>
                  <TableCell>{team.name}</TableCell>
                  <TableCell>
                    {team.memberCount} {team.memberCount === 1 ? t("common.member") : t("common.members")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="success" size={"tiny"}>
                      {t("environments.settings.teams.your_team")}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        handleManageTeam(team.id);
                      }}>
                      {t("environments.settings.teams.manage_team")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {otherTeams.map((team) => (
                <TableRow key={team.id} id={team.name}>
                  <TableCell>{team.name}</TableCell>
                  <TableCell>
                    {team.memberCount} {team.memberCount === 1 ? t("common.member") : t("common.members")}
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell className="flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        handleManageTeam(team.id);
                      }}>
                      {t("environments.settings.teams.manage_team")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SettingsCard>
      {openSettingsModal && selectedTeam && (
        <TeamSettingsModal
          open={openSettingsModal}
          setOpen={setOpenSettingsModal}
          team={selectedTeam}
          orgMembers={orgMembers}
          orgProjects={orgProjects}
        />
      )}
    </>
  );
};
