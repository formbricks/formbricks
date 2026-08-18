"use client";

import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { TeamPermissionMapping } from "@/modules/ee/teams/utils/teams";
import { TWorkspaceTeam } from "@/modules/ee/teams/workspace-teams/types/team";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";

interface AccessTableProps {
  teams: TWorkspaceTeam[];
}

const getWorkspaceTeamColumns = (t: TFunction): TSettingsTableColumn<TWorkspaceTeam>[] => [
  {
    id: "name",
    header: t("workspace.teams.team_name"),
    headerClassName: "w-[30%]",
    cellClassName: "font-medium",
    cell: (team) => team.name,
  },
  {
    id: "size",
    header: t("common.size"),
    headerClassName: "w-[15%]",
    cell: (team) => t("common.count_members", { count: team.memberCount }),
  },
  {
    id: "teamId",
    header: t("common.team_id"),
    headerClassName: "w-[30%]",
    cell: (team) => <IdBadge id={team.id} />,
  },
  {
    id: "permission",
    header: t("workspace.teams.permission"),
    headerClassName: "w-[25%]",
    cellClassName: "capitalize",
    cell: (team) => TeamPermissionMapping[team.permission],
  },
];

export const AccessTable = ({ teams }: Readonly<AccessTableProps>) => {
  const { t } = useTranslation();

  return (
    <SettingsTable
      columns={getWorkspaceTeamColumns(t)}
      rows={teams}
      getRowId={(team) => team.id}
      emptyMessage={t("workspace.teams.no_teams_found")}
      aria-label={t("common.team_access")}
    />
  );
};
