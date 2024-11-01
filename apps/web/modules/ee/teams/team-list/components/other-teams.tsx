"use client";

import { joinTeamAction } from "@/modules/ee/teams/team-list/actions";
import { TOtherTeam } from "@/modules/ee/teams/team-list/types/teams";
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
        <CardTitle>Other Teams</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100">
                <TableHead>Team Name</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center">
                    No other teams found
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
                      Join Team
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
