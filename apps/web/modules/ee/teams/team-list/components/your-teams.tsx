"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { removeTeamMemberAction } from "@/modules/ee/teams/team-details/actions";
import { TUserTeam } from "@/modules/ee/teams/team-list/types/teams";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { AlertDialog } from "@formbricks/ui/components/AlertDialog";
import { Button } from "@formbricks/ui/components/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@formbricks/ui/components/Card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@formbricks/ui/components/Table";

interface YourTeamsProps {
  teams: TUserTeam[];
  currentUserId: string;
  isOwnerOrManager: boolean;
}

export const YourTeams = ({ teams, currentUserId, isOwnerOrManager }: YourTeamsProps) => {
  const router = useRouter();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [leaveTeamModalOpen, setLeaveTeamModalOpen] = useState<boolean>(false);
  const t = useTranslations();
  const handleLeaveTeam = async (teamId: string) => {
    const leaveTeamActionResponse = await removeTeamMemberAction({ userId: currentUserId, teamId });
    if (leaveTeamActionResponse?.data) {
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(leaveTeamActionResponse);
      toast.error(errorMessage);
    }
    setLeaveTeamModalOpen(false);
    setSelectedTeamId(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("environments.settings.teams.your_teams")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("common.role")}</TableHead>
                  {isOwnerOrManager && <TableHead>{t("common.actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      {t("environments.settings.teams.you_are_not_part_of_any_team")}
                    </TableCell>
                  </TableRow>
                )}
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>
                      <Link href={`teams/${team.id}`} className="font-semibold hover:underline">
                        {team.name}
                      </Link>{" "}
                      ({team.memberCount} {t("common.members")})
                    </TableCell>
                    <TableCell className="capitalize">{team.userRole}</TableCell>
                    {isOwnerOrManager && (
                      <TableCell>
                        <Button
                          variant="warn"
                          size="sm"
                          onClick={() => {
                            setSelectedTeamId(team.id);
                            setLeaveTeamModalOpen(true);
                          }}>
                          {t("environments.settings.teams.leave_team")}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {leaveTeamModalOpen && selectedTeamId && (
        <AlertDialog
          open={leaveTeamModalOpen}
          setOpen={setLeaveTeamModalOpen}
          headerText={t("environments.settings.teams.leave_team")}
          mainText={t("environments.settings.teams.leave_team_confirmation")}
          confirmBtnLabel={t("common.confirm")}
          onDecline={() => {
            setSelectedTeamId(null);
            setLeaveTeamModalOpen(false);
          }}
          onConfirm={() => handleLeaveTeam(selectedTeamId)}
        />
      )}
    </>
  );
};
