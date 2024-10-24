"use client";

import { TUserTeam } from "@/modules/ee/teams/team-list/types/teams";
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

interface YourTeamsProps {
  teams: TUserTeam[];
  leaveTeam: (teamId: string) => void;
}

export const YourTeams = ({ teams, leaveTeam }: YourTeamsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Teams</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
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
                <TableCell className="capitalize">{team.userRole}</TableCell>
                <TableCell>
                  <Button variant="alert" size="sm" className="text-white" onClick={() => leaveTeam(team.id)}>
                    Leave Team
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
