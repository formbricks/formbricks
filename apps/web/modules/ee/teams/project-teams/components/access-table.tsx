"use client";

import { TProjectTeam } from "@/modules/ee/teams/project-teams/types/teams";
import { TeamPermissionMapping } from "@/modules/ee/teams/utils/teams";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { useTranslations } from "next-intl";
import Link from "next/link";

interface AccessTableProps {
  teams: TProjectTeam[];
  environmentId: string;
  projectId: string;
  isOwnerOrManager: boolean;
}

export const AccessTable = ({ teams, environmentId, isOwnerOrManager }: AccessTableProps) => {
  const t = useTranslations();

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
            <TableRow>
              <TableCell colSpan={3} className="text-center">
                {t("environments.project.teams.no_teams_found")}
              </TableCell>
            </TableRow>
          )}
          {teams.map((team) => (
            <TableRow key={team.id} className="border-slate-200">
              <TableCell className="font-medium">
                {isOwnerOrManager ? (
                  <Link href={`/environments/${environmentId}/settings/teams/${team.id}`}>{team.name}</Link>
                ) : (
                  team.name
                )}
              </TableCell>
              <TableCell>
                {team.memberCount} {team.memberCount === 1 ? "member" : "members"}{" "}
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
