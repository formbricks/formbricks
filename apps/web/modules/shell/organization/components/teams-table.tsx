"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TOrganizationMember } from "@/modules/ee/teams/team-list/types/team";
import type { TOrganizationWorkspace } from "@/modules/ee/teams/team-list/types/workspace";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import type { TTeamListItem } from "../lib/team-directory";
import { TABLE_HEAD_CLASS, TableFrame } from "./section-heading";
import { TeamSettingsDialog } from "./team-settings-dialog";

interface TeamsTableProps {
  teams: TTeamListItem[];
  orgMembers: TOrganizationMember[];
  orgWorkspaces: TOrganizationWorkspace[];
  isOwnerOrManager: boolean;
  currentUserId: string;
}

export const TeamsTable = ({
  teams,
  orgMembers,
  orgWorkspaces,
  isOwnerOrManager,
  currentUserId,
}: Readonly<TeamsTableProps>) => {
  const { t } = useTranslation();
  const [managedTeam, setManagedTeam] = useState<TTeamListItem | null>(null);

  const permissionLabels: Record<TTeamPermission, string> = {
    read: t("shell.organization.teams.permission_read"),
    readWrite: t("shell.organization.teams.permission_read_write"),
    manage: t("shell.organization.teams.permission_manage"),
  };

  // Owners and managers manage any team; anyone else only a team they administer.
  const canManage = (team: TTeamListItem) => isOwnerOrManager || team.viewerRole === "admin";

  return (
    <>
      <TableFrame>
        <Table aria-label={t("common.teams")}>
          <TableHeader>
            <TableRow>
              <TableHead className={TABLE_HEAD_CLASS}>{t("common.team")}</TableHead>
              <TableHead className={`${TABLE_HEAD_CLASS} hidden md:table-cell`}>
                {t("shell.organization.teams.workspace_access")}
              </TableHead>
              <TableHead className={TABLE_HEAD_CLASS}>{t("common.members")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("common.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => (
              <TableRow key={team.id}>
                <TableCell className="font-medium text-slate-800">{team.name}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {team.access.length === 0 ? (
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
                <TableCell>{team.memberCount}</TableCell>
                <TableCell className="text-right">
                  {canManage(team) && (
                    <Button variant="outline" size="sm" onClick={() => setManagedTeam(team)}>
                      {t("common.manage")}
                      <span className="sr-only">{team.name}</span>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableFrame>

      {managedTeam && (
        <TeamSettingsDialog
          key={managedTeam.id}
          teamId={managedTeam.id}
          teamName={managedTeam.name}
          open
          onOpenChange={(open) => {
            if (!open) setManagedTeam(null);
          }}
          orgMembers={orgMembers}
          orgWorkspaces={orgWorkspaces}
          isOwnerOrManager={isOwnerOrManager}
          viewerTeamRole={managedTeam.viewerRole}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
};
