"use client";

import { joinTeamAction } from "@/modules/ee/teams/team-list/actions";
import { TOtherTeam } from "@/modules/ee/teams/team-list/types/teams";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
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

interface OtherTeamsProps {
  teams: TOtherTeam[];
}

export const OtherTeams = ({ teams }: OtherTeamsProps) => {
  const t = useTranslations();
  const router = useRouter();

  const joinTeam = async (teamId: string) => {
    const joinTeamActionResponse = await joinTeamAction({ teamId });
    if (joinTeamActionResponse?.data) {
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(joinTeamActionResponse);
      toast.error(errorMessage);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("environments.settings.teams.other_teams")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100">
                <TableHead>{t("environments.settings.teams.team_name")}</TableHead>
                <TableHead>{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center">
                    {t("environments.settings.teams.no_other_teams_found")}
                  </TableCell>
                </TableRow>
              )}
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell>
                    <Link href={`teams/${team.id}`} className="font-semibold hover:underline">
                      {team.name}
                    </Link>{" "}
                    ({team.memberCount} members)
                  </TableCell>
                  <TableCell>
                    <Button variant="secondary" size="sm" onClick={() => joinTeam(team.id)}>
                      {t("environments.settings.teams.join_team")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
