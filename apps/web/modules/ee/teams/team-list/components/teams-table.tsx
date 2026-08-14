"use client";

import type { TFunction } from "i18next";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getTeamDetailsAction, getTeamRoleAction } from "@/modules/ee/teams/team-list/actions";
import { CreateTeamButton } from "@/modules/ee/teams/team-list/components/create-team-button";
import { ManageTeamButton } from "@/modules/ee/teams/team-list/components/manage-team-button";
import { TeamSettingsModal } from "@/modules/ee/teams/team-list/components/team-settings/team-settings-modal";
import {
  TOrganizationMember,
  TOtherTeam,
  TTeamDetails,
  TTeamRole,
  TUserTeam,
} from "@/modules/ee/teams/team-list/types/team";
import { TOrganizationWorkspace } from "@/modules/ee/teams/team-list/types/workspace";
import { Badge } from "@/modules/ui/components/badge";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";

/** A team plus whether the current user is in it — the only thing the two source lists differ by. */
type TTeamRow = { team: TUserTeam; isMember: true } | { team: TOtherTeam; isMember: false };

/**
 * Owners and managers can manage any team. Everyone else can only manage a team they are an admin of,
 * which by definition means a team they belong to.
 */
const isManageDisabled = (row: TTeamRow, isOwnerOrManager: boolean): boolean => {
  if (isOwnerOrManager) return false;
  return !row.isMember || row.team.userRole !== "admin";
};

interface TeamsTableProps {
  teams: { userTeams: TUserTeam[]; otherTeams: TOtherTeam[] };
  organizationId: string;
  orgMembers: TOrganizationMember[];
  orgWorkspaces: TOrganizationWorkspace[];
  membershipRole?: TOrganizationRole;
  currentUserId: string;
}

/**
 * Defined at module level rather than inside the component: an inline `cell` that returns JSX reads as a
 * nested component definition to Sonar (typescript:S6478), and re-declaring the array per render buys
 * nothing.
 */
const getTeamColumns = ({
  t,
  isOwnerOrManager,
  onManage,
}: Readonly<{
  t: TFunction;
  isOwnerOrManager: boolean;
  onManage: (teamId: string) => void;
}>): TSettingsTableColumn<TTeamRow>[] => [
  {
    id: "name",
    header: t("workspace.settings.teams.team_name"),
    headerClassName: "w-[40%]",
    cell: (row) => row.team.name,
  },
  {
    id: "size",
    header: t("common.size"),
    headerClassName: "w-[20%]",
    cell: (row) => t("common.count_members", { count: row.team.memberCount }),
  },
  {
    id: "membership",
    header: null,
    // A column header is announced for every row in the column, so it has to be neutral —
    // "You are a member" would claim membership on the rows that have no badge.
    srLabel: t("common.membership"),
    headerClassName: "w-[20%]",
    cell: (row) =>
      row.isMember ? (
        <Badge type="success" size="tiny" text={t("workspace.settings.teams.you_are_a_member")} />
      ) : null,
  },
  {
    id: "actions",
    header: null,
    srLabel: t("common.actions"),
    headerClassName: "w-[20%]",
    stopRowClick: true,
    // The flex goes on a wrapper inside the cell, not on `cellClassName`: that class lands on the `<td>`,
    // and `display: flex` there stops it being a table-cell, which kills the shared `align-middle` and
    // leaves the button baseline-aligned. `align: "right"` is no help either — the wrapper is block-level.
    cell: (row) => (
      <div className="flex justify-end">
        <ManageTeamButton
          disabled={isManageDisabled(row, isOwnerOrManager)}
          onClick={() => {
            onManage(row.team.id);
          }}
        />
      </div>
    ),
  },
];

export const TeamsTable = ({
  teams,
  organizationId,
  orgMembers,
  orgWorkspaces,
  membershipRole,
  currentUserId,
}: Readonly<TeamsTableProps>) => {
  const { t } = useTranslation();
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

  // One row list, tagged with whether the current user belongs to the team. The two lists used to be
  // mapped separately into a shared <TableBody>, which meant duplicating all four cells to vary two of
  // them; the tag lets the membership badge and the manage-permission rule branch per row instead.
  const rows: TTeamRow[] = [
    ...userTeams.map((team) => ({ team, isMember: true as const })),
    ...otherTeams.map((team) => ({ team, isMember: false as const })),
  ];

  return (
    <>
      {isOwnerOrManager && (
        // The table is edge-to-edge, so the control above it carries the card's gutter itself.
        <div className="mb-4 flex justify-end px-4 pt-4">
          <CreateTeamButton organizationId={organizationId} />
        </div>
      )}

      <SettingsTable
        columns={getTeamColumns({ t, isOwnerOrManager, onManage: handleManageTeam })}
        rows={rows}
        getRowId={(row) => row.team.id}
        emptyMessage={t("workspace.settings.teams.empty_teams_state")}
        // A constant testid, not one built from the team name: names are user-supplied and not unique,
        // so a name-keyed testid would reintroduce the collision that dropping `id={team.name}` fixed.
        // Specs narrow by row text instead.
        getRowProps={() => ({ "data-testid": "team-row" })}
        aria-label={t("common.teams")}
      />
      {openSettingsModal && selectedTeam && (
        <TeamSettingsModal
          open={openSettingsModal}
          setOpen={setOpenSettingsModal}
          team={selectedTeam}
          orgMembers={orgMembers}
          orgWorkspaces={orgWorkspaces}
          membershipRole={membershipRole}
          userTeamRole={userTeamRole}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
};
