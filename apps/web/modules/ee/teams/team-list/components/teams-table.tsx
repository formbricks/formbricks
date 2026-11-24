"use client";

import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags } from "@/lib/membership/utils";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { CreateTeamButton } from "@/modules/ee/teams/team-list/components/create-team-button";
import { ManageTeamButton } from "@/modules/ee/teams/team-list/components/manage-team-button";
import { TeamSettingsModal } from "@/modules/ee/teams/team-list/components/team-settings/team-settings-modal";
import { TeamsQueryClientProvider } from "@/modules/ee/teams/team-list/components/teams-query-client-provider";
import { getTeam } from "@/modules/ee/teams/team-list/lib/api-client";
import {
  TOrganizationMember,
  TOtherTeam,
  TTeamDetails,
  TTeamRole,
  TUserTeam,
} from "@/modules/ee/teams/team-list/types/team";
import { TOrganizationWorkspace } from "@/modules/ee/teams/team-list/types/workspace";
import { Badge } from "@/modules/ui/components/badge";
import { ListTable, TableToolbar } from "@/modules/ui/components/table-toolbar";
import { useTableColumnState } from "@/modules/ui/components/table-toolbar/hooks/use-table-column-state";
import { buildColumnSettings } from "@/modules/ui/components/table-toolbar/lib/column-settings";

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
  /** Access Control and Dashboards: team dashboard limits are shown only then (ENG-7483). */
  isDashboardAccessEnabled?: boolean;
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
}>): ColumnDef<TTeamRow>[] => [
  {
    id: "name",
    header: t("workspace.settings.teams.team_name"),
    size: 260,
    cell: ({ row }) => <span className="truncate font-medium text-slate-900">{row.original.team.name}</span>,
  },
  {
    id: "size",
    header: t("common.size"),
    size: 140,
    cell: ({ row }) => t("common.count_members", { count: row.original.team.memberCount }),
  },
  {
    id: "membership",
    // A column header is announced for every row in the column, so it has to be neutral —
    // "You are a member" would claim membership on the rows that have no badge.
    header: t("common.membership"),
    size: 160,
    cell: ({ row }) =>
      row.original.isMember ? (
        <Badge type="success" size="tiny" text={t("workspace.settings.teams.you_are_a_member")} />
      ) : null,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">{t("common.actions")}</span>,
    size: 140,
    cell: ({ row }) => (
      <div className="flex w-full justify-end">
        <ManageTeamButton
          disabled={isManageDisabled(row.original, isOwnerOrManager)}
          onClick={() => {
            onManage(row.original.team.id);
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
  isDashboardAccessEnabled = false,
}: Readonly<TeamsTableProps>) => {
  const { t } = useTranslation();
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TTeamDetails>();
  const [userTeamRole, setUserTeamRole] = useState<TTeamRole | undefined>();

  const { isOwner, isManager } = getAccessFlags(membershipRole);

  const isOwnerOrManager = isOwner || isManager;

  const handleManageTeam = async (teamId: string) => {
    try {
      // One read carries the team and the current user's role in it.
      const { currentUserRole, ...team } = await getTeam(teamId);
      setUserTeamRole(currentUserRole ?? undefined);
      setSelectedTeam(team);
      setOpenSettingsModal(true);
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    }
  };

  const { userTeams, otherTeams } = teams;

  // One row list, tagged with whether the current user belongs to the team. The two lists used to be
  // mapped separately into a shared <TableBody>, which meant duplicating all four cells to vary two of
  // them; the tag lets the membership badge and the manage-permission rule branch per row instead.
  const rows = useMemo<TTeamRow[]>(
    () => [
      ...userTeams.map((team) => ({ team, isMember: true as const })),
      ...otherTeams.map((team) => ({ team, isMember: false as const })),
    ],
    [userTeams, otherTeams]
  );

  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  // Memoized: the table treats a new `data` array as new data and resets its state, which re-renders
  // and builds another array — an endless loop that freezes the page.
  const filteredRows = useMemo(
    () => (query === "" ? rows : rows.filter((row) => row.team.name.toLowerCase().includes(query))),
    [rows, query]
  );

  const columnIds = ["name", "size", "membership", "actions"];
  const columnState = useTableColumnState({ storagePrefix: `${organizationId}-teams`, columnIds });
  const columns = getTeamColumns({ t, isOwnerOrManager, onManage: handleManageTeam });

  const table = useReactTable({
    data: filteredRows,
    columns,
    getRowId: (row) => row.team.id,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnOrder: columnState.columnOrder,
      columnVisibility: columnState.columnVisibility,
      columnSizing: columnState.columnSizing,
    },
    ...columnState.sizingOptions,
  });

  const columnLabels = [
    { id: "name", label: t("workspace.settings.teams.team_name") },
    { id: "size", label: t("common.size") },
    { id: "membership", label: t("common.membership") },
  ];

  return (
    <>
      <div className="space-y-3 px-4 pt-4">
        <TableToolbar
          settings={{
            columns: {
              items: buildColumnSettings(
                columnLabels,
                columnState.columnOrder,
                columnState.columnVisibility,
                ["name"]
              ),
              onVisibilityChange: (id, visible) =>
                columnState.setColumnVisibility((current) => ({ ...current, [id]: visible })),
              onMove: columnState.moveColumn,
            },
          }}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t("workspace.settings.teams.search_teams"),
          }}
          actions={isOwnerOrManager ? <CreateTeamButton organizationId={organizationId} /> : undefined}
        />
        <div className="-mx-4">
          <ListTable
            table={table}
            testId="teams-table"
            isLoading={false}
            hasFilters={query !== ""}
            onClearFilters={() => setSearch("")}
            emptyContent={
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {t("workspace.settings.teams.empty_teams_state")}
              </p>
            }
          />
        </div>
      </div>
      {openSettingsModal && selectedTeam && (
        <TeamsQueryClientProvider>
          <TeamSettingsModal
            open={openSettingsModal}
            setOpen={setOpenSettingsModal}
            team={selectedTeam}
            orgMembers={orgMembers}
            orgWorkspaces={orgWorkspaces}
            membershipRole={membershipRole}
            userTeamRole={userTeamRole}
            currentUserId={currentUserId}
            isDashboardAccessEnabled={isDashboardAccessEnabled}
          />
        </TeamsQueryClientProvider>
      )}
    </>
  );
};
