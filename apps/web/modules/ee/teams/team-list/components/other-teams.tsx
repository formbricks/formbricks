"use client";

import { TOtherTeam } from "@/modules/ee/teams/team-list/types/teams";
import Link from "next/link";
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
  joinTeam: (teamId: string) => void;
}

export const OtherTeams = ({ teams, joinTeam }: OtherTeamsProps) => {
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
