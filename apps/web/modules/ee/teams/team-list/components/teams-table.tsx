"use client";

import { CreateTeamButton } from "@/modules/ee/teams/team-list/components/create-team-button";
import { TOtherTeam, TUserTeam } from "@/modules/ee/teams/team-list/types/teams";
import { Badge } from "@/modules/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { useTranslations } from "next-intl";
import Link from "next/link";

interface YourTeamsProps {
  teams: { userTeams: TUserTeam[]; otherTeams: TOtherTeam[] };
  currentUserId: string;
  isOwnerOrManager: boolean;
  organizationId: string;
}

export const TeamsTable = ({ teams, organizationId, isOwnerOrManager }: YourTeamsProps) => {
  const t = useTranslations();

  const { userTeams, otherTeams } = teams;

  const allTeams = [...userTeams, ...otherTeams];
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("common.teams")}</CardTitle>
          {isOwnerOrManager && <CreateTeamButton organizationId={organizationId} />}
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTeams.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      {t("environments.settings.teams.empty_teams_state")}
                    </TableCell>
                  </TableRow>
                )}
                {userTeams.map((team) => (
                  <TableRow key={team.id} id={team.name}>
                    <TableCell>
                      <Link href={`teams/${team.id}`} className="font-semibold hover:underline">
                        {team.name}
                      </Link>{" "}
                      ({team.memberCount} {t("common.members")})
                    </TableCell>
                    <TableCell className="flex justify-end">
                      <Badge text={t("environments.settings.teams.your_team")} type="success" size={"tiny"} />
                    </TableCell>
                  </TableRow>
                ))}
                {otherTeams.map((team) => (
                  <TableRow key={team.id} id={team.name}>
                    <TableCell>
                      {isOwnerOrManager ? (
                        <Link href={`teams/${team.id}`} className="font-semibold hover:underline">
                          {team.name}{" "}
                        </Link>
                      ) : (
                        team.name
                      )}
                      ({team.memberCount} {t("common.members")})
                    </TableCell>
                    <TableCell>-</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
