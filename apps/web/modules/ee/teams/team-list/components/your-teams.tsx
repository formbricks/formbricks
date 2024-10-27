"use client";

import { TUserTeam } from "@/modules/ee/teams/team-list/types/teams";
import Link from "next/link";
import { useState } from "react";
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
  leaveTeam: (teamId: string) => void;
}

export const YourTeams = ({ teams, leaveTeam }: YourTeamsProps) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [leaveTeamModalOpen, setLeaveTeamModalOpen] = useState<boolean>(false);

  const handleLeaveTeam = (teamId: string) => {
    leaveTeam(teamId);
    setLeaveTeamModalOpen(false);
    setSelectedTeamId(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Your Teams</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
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
                      <Button
                        variant="warn"
                        size="sm"
                        onClick={() => {
                          setSelectedTeamId(team.id);
                          setLeaveTeamModalOpen(true);
                        }}>
                        Leave Team
                      </Button>
                    </TableCell>
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
          headerText="Leave Team"
          mainText="Are you sure you want to leave this team?"
          confirmBtnLabel="Confirm"
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
