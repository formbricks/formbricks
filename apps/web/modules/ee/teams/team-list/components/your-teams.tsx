"use client";

import { leaveTeamAction } from "@/modules/ee/teams/team-list/actions";
import { TUserTeam } from "@/modules/ee/teams/team-list/types/teams";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
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
}

export const YourTeams = ({ teams }: YourTeamsProps) => {
  const router = useRouter();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [leaveTeamModalOpen, setLeaveTeamModalOpen] = useState<boolean>(false);

  const handleLeaveTeam = async (teamId: string) => {
    const leaveTeamActionResponse = await leaveTeamAction({ teamId });
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
                {teams.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      You are not part of any team.
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
