"use client";

import { removeAccessAction, updateAccessPermissionAction } from "@/modules/ee/teams/team-access/actions";
import { TProductTeam, TTeamPermission, ZTeamPermission } from "@/modules/ee/teams/team-access/types/teams";
import { TeamPermissionMapping } from "@/modules/ee/teams/utils/teams";
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
  isOwnerOrManager: boolean;
}

export const AccessTable = ({ teams, environmentId, productId, isOwnerOrManager }: AccessTableProps) => {
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

  const handlePermissionChange = async (teamId: string, permission: TTeamPermission) => {
    const updateAccessPermissionActionResponse = await updateAccessPermissionAction({
      productId,
      teamId,
      permission,
    });
    if (updateAccessPermissionActionResponse?.data) {
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updateAccessPermissionActionResponse);
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
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100">
              <TableHead>Team Name</TableHead>
              <TableHead>Permission</TableHead>
              {isOwnerOrManager && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  No teams added
                </TableCell>
              </TableRow>
            )}
            {teams.map((team) => (
              <TableRow key={team.id}>
                <TableCell>
                  <Link href={`/environments/${environmentId}/settings/teams/${team.id}`}>{team.name}</Link> (
                  {team.memberCount} members)
                </TableCell>
                <TableCell>
                  {isOwnerOrManager ? (
                    <Select
                      value={team.permission}
                      onValueChange={(val: TTeamPermission) => {
                        handlePermissionChange(team.id, val);
                      }}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select type" className="text-sm" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ZTeamPermission.Enum.read}>Read</SelectItem>
                        <SelectItem value={ZTeamPermission.Enum.readWrite}>Read & write</SelectItem>
                        <SelectItem value={ZTeamPermission.Enum.manage}>Manage</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="capitalize">{TeamPermissionMapping[team.permission]}</p>
                  )}
                </TableCell>
                {isOwnerOrManager && (
                  <TableCell>
                    <Button
                      variant="warn"
                      size="sm"
                      onClick={() => {
                        setSelectedTeamId(team.id);
                        setRemoveAccessModalOpen(true);
                      }}>
                      Remove
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
