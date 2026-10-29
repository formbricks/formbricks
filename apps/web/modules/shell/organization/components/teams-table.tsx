"use client";

import { useTranslation } from "react-i18next";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { Badge } from "@/modules/ui/components/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import type { TTeamListItem } from "../lib/team-directory";
import { TABLE_HEAD_CLASS, TableFrame } from "./section-heading";

interface TeamsTableProps {
  teams: TTeamListItem[];
  isOwnerOrManager: boolean;
}

/** The teams of the organization, read-only: changing one is the agent's job (the page says so). */
export const TeamsTable = ({ teams, isOwnerOrManager }: Readonly<TeamsTableProps>) => {
  const { t } = useTranslation();

  const permissionLabels: Record<TTeamPermission, string> = {
    read: t("shell.organization.teams.permission_read"),
    readWrite: t("shell.organization.teams.permission_read_write"),
    manage: t("shell.organization.teams.permission_manage"),
  };

  return (
    <TableFrame>
      <Table aria-label={t("common.teams")}>
        <TableHeader>
          <TableRow>
            <TableHead className={TABLE_HEAD_CLASS}>{t("common.team")}</TableHead>
            {isOwnerOrManager && (
              <TableHead className={`${TABLE_HEAD_CLASS} hidden md:table-cell`}>
                {t("shell.organization.teams.workspace_access")}
              </TableHead>
            )}
            <TableHead className={TABLE_HEAD_CLASS}>{t("common.members")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((team) => (
            <TableRow key={team.id}>
              <TableCell className="font-medium text-slate-800">{team.name}</TableCell>
              {isOwnerOrManager && (
                <TableCell className="hidden md:table-cell">
                  {!team.access || team.access.length === 0 ? (
                    <span className="text-slate-500">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {team.access.map((access) => (
                        <Badge
                          key={access.workspaceId}
                          type="gray"
                          size="normal"
                          text={t("shell.organization.teams.access_chip", {
                            workspace: access.workspaceName,
                            permission: permissionLabels[access.permission],
                          })}
                        />
                      ))}
                    </div>
                  )}
                </TableCell>
              )}
              <TableCell>{team.memberCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  );
};
