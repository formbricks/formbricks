"use client";

import { TProjectTeam } from "@/modules/ee/teams/project-teams/types/team";
import { TeamPermissionMapping } from "@/modules/ee/teams/utils/teams";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { useTranslate } from "@tolgee/react";

interface AccessTableProps {
  teams: TProjectTeam[];
}

export const AccessTable = ({ teams }: AccessTableProps) => {
  const { t } = useTranslate();

  return (
    <div className="overflow-hidden rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-100">
            <TableHead className="font-medium text-slate-500">
              {t("environments.project.teams.team_name")}
            </TableHead>
            <TableHead className="font-medium text-slate-500">{t("common.size")}</TableHead>
            <TableHead className="font-medium text-slate-500">
              {t("environments.project.teams.permission")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&_tr:last-child]:border-b">
          {teams.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={3} className="text-center">
                {t("environments.project.teams.no_teams_found")}
              </TableCell>
            </TableRow>
          )}
          {teams.map((team) => (
            <TableRow key={team.id} className="border-slate-200 hover:bg-transparent">
              <TableCell className="font-medium">{team.name}</TableCell>
              <TableCell>
                {team.memberCount} {team.memberCount === 1 ? t("common.member") : t("common.members")}
              </TableCell>
              <TableCell>
                <p className="capitalize">{TeamPermissionMapping[team.permission]}</p>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
