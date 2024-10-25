"use client";

import { removeAccessAction } from "@/modules/ee/teams/team-access/actions";
import { TProductTeam } from "@/modules/ee/teams/team-access/types/teams";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { AlertDialog } from "@formbricks/ui/components/AlertDialog";
import { Button } from "@formbricks/ui/components/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui/components/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@formbricks/ui/components/Table";

interface AccessTableProps {
  teams: TProductTeam[];
  environmentId: string;
  productId: string;
}

export const AccessTable = ({ teams, environmentId, productId }: AccessTableProps) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [removeAccessModalOpen, setRemoveAccessModalOpen] = useState<boolean>(false);

  const router = useRouter();

  const removeAccess = async (teamId: string) => {
    const removeAccessActionResponse = await removeAccessAction({ productId, teamId });
    if (removeAccessActionResponse?.data) {
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(removeAccessActionResponse);
      toast.error(errorMessage);
    }
  };

  const handleRemoveAccess = (teamId: string) => {
    removeAccess(teamId);
    setRemoveAccessModalOpen(false);
    setSelectedTeamId(null);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team Name</TableHead>
            <TableHead>Permission level</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((team) => (
            <TableRow key={team.id}>
              <TableCell>
                <Link href={`/environments/${environmentId}/settings/teams/${team.id}`}>{team.name}</Link>(
                {team.memberCount} members)
              </TableCell>
              <TableCell>
                <Select value={team.permission} onValueChange={() => {}}>
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Select type" className="text-sm" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={"read"}>read</SelectItem>
                    <SelectItem value={"readWrite"}>read & write</SelectItem>
                    <SelectItem value={"manage"}>manage</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedTeamId(team.id);
                    setRemoveAccessModalOpen(true);
                  }}>
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {removeAccessModalOpen && selectedTeamId && (
        <AlertDialog
          open={removeAccessModalOpen}
          setOpen={setRemoveAccessModalOpen}
          headerText="Remove Access"
          mainText="Are you sure you want to remove access for this team?"
          confirmBtnLabel="Confirm"
          onDecline={() => {
            setSelectedTeamId(null);
            setRemoveAccessModalOpen(false);
          }}
          onConfirm={() => handleRemoveAccess(selectedTeamId)}
        />
      )}
    </>
  );
};
